"""
Log de auditoria próprio — não depende do Controllr.

O Controllr autentica cada ação pelo cookie de sessão do próprio técnico
(ver deps.py — cada sessão carrega o cookie criado no login dele, não uma
conta compartilhada), então "quem fez" já está resolvido do lado de lá. O
Controllr não registra o IP de origem corretamente: como este backend
fala com ele por trás de um proxy, o IP que chega lá é sempre o do
servidor, e a API não aceita um cabeçalho tipo X-Forwarded-For para
repassar o IP real. A auditoria por IP é resolvida aqui: técnico + IP
real + ação, gravado localmente.

Arquivo local em JSON Lines (uma linha por evento) — mesma abordagem
simples de sessions.py (uso interno, poucos técnicos, sem banco próprio).
"""

import ipaddress
import json
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import Request

from .config import AUDIT_LOG_PATH, AUDITORIA_RETENCAO_MESES
from .sessions import TechnicianSession


def _ip_valido(valor: str | None) -> str | None:
    if not valor:
        return None
    valor = valor.strip()
    try:
        ipaddress.ip_address(valor)
    except ValueError:
        return None  # vazio, "(null)", "unknown"...
    return valor


def obter_ip_origem(request: Request) -> str:
    """
    IP real de quem está usando o app, sem confiar em cabeçalho que o
    navegador possa mandar:

    1. X-Real-IP — o nosso proxy (Nginx ou Apache) sobrescreve com o IP da
       conexão (ver deploy/*.conf.example);
    2. o ÚLTIMO IP do X-Forwarded-For — é o que o nosso proxy acrescenta; os
       anteriores vêm do navegador e podem ser inventados;
    3. o IP da conexão TCP (dev, sem proxy na frente).

    CF-Connecting-IP não é usado: sem Cloudflare na frente, qualquer um
    manda esse cabeçalho com o IP que quiser.
    """
    real = _ip_valido(request.headers.get("x-real-ip"))
    if real:
        return real
    encaminhado = (request.headers.get("x-forwarded-for") or "").split(",")
    ultimo = _ip_valido(encaminhado[-1]) if encaminhado else None
    if ultimo:
        return ultimo
    return request.client.host if request.client else "desconhecido"


# ------------------------------------------------------------------ gravação

# Um arquivo por mês (auditoria-2026-10.jsonl, na pasta de AUDIT_LOG_PATH);
# os de mais de AUDITORIA_RETENCAO_MESES meses são apagados ao virar o mês.
_lock = threading.Lock()
_ultimo_mes_limpo: str | None = None


def _pasta() -> Path:
    return Path(AUDIT_LOG_PATH).parent


def _arquivo_do_mes(mes: str) -> Path:
    return _pasta() / f"{Path(AUDIT_LOG_PATH).stem}-{mes}.jsonl"


def _mes_do_arquivo(arq: Path) -> str | None:
    """"auditoria-2026-10.jsonl" → "2026-10"; o arquivo único antigo → None."""
    partes = arq.stem.rsplit("-", 2)
    return "-".join(partes[-2:]) if len(partes) == 3 else None


def _limpar_antigos(mes_atual: str) -> None:
    ano, mes = map(int, mes_atual.split("-"))
    total = ano * 12 + (mes - 1) - AUDITORIA_RETENCAO_MESES
    limite = f"{total // 12:04d}-{total % 12 + 1:02d}"
    for arq in _pasta().glob(f"{Path(AUDIT_LOG_PATH).stem}-*.jsonl"):
        mes_arq = _mes_do_arquivo(arq)
        if mes_arq and mes_arq < limite:
            arq.unlink(missing_ok=True)


def registrar_auditoria(
    request: Request,
    session: TechnicianSession,
    acao: str,
    alvo: dict[str, Any] | None = None,
) -> None:
    global _ultimo_mes_limpo
    evento = {
        "quando": time.strftime("%Y-%m-%d %H:%M:%S"),
        "tecnico": session.username,
        "ip": obter_ip_origem(request),
        "acao": acao,
        "alvo": alvo or {},
    }
    mes = evento["quando"][:7]
    with _lock:
        _pasta().mkdir(parents=True, exist_ok=True)
        if _ultimo_mes_limpo != mes:
            _limpar_antigos(mes)
            _ultimo_mes_limpo = mes
        with _arquivo_do_mes(mes).open("a", encoding="utf-8") as arquivo:
            arquivo.write(json.dumps(evento, ensure_ascii=False) + "\n")


# ------------------------------------------------------------------ consulta


def consultar(
    tecnico: str | None = None,
    acao: str | None = None,
    de: str | None = None,
    ate: str | None = None,
    limite: int = 200,
) -> tuple[list[dict[str, Any]], bool]:
    """Eventos mais recentes primeiro (datas "AAAA-MM-DD", inclusivas).
    Lê também o arquivo único antigo (antes da divisão por mês)."""
    arquivos = sorted(_pasta().glob(f"{Path(AUDIT_LOG_PATH).stem}-*.jsonl"), reverse=True)
    antigo = Path(AUDIT_LOG_PATH)
    if antigo.exists():
        arquivos.append(antigo)
    t = (tecnico or "").strip().lower()
    a = (acao or "").strip().lower()
    out: list[dict[str, Any]] = []
    for arq in arquivos:
        mes_arq = _mes_do_arquivo(arq)
        if mes_arq and ((de and mes_arq < de[:7]) or (ate and mes_arq > ate[:7])):
            continue
        try:
            linhas = arq.read_text(encoding="utf-8").splitlines()
        except OSError:
            continue
        for linha in reversed(linhas):
            try:
                ev = json.loads(linha)
            except ValueError:
                continue
            dia = str(ev.get("quando", ""))[:10]
            if (de and dia < de) or (ate and dia > ate):
                continue
            if t and t not in str(ev.get("tecnico", "")).lower():
                continue
            if a and not str(ev.get("acao", "")).lower().startswith(a):
                continue
            out.append(ev)
            if len(out) > limite:
                break
        if len(out) > limite:
            break
    out.sort(key=lambda e: str(e.get("quando", "")), reverse=True)
    return out[:limite], len(out) > limite
