"""
Log de auditoria próprio — não depende do Controllr.

O Controllr autentica cada ação com o Basic Auth do próprio técnico (ver
deps.py — cada sessão carrega a credencial dele, não uma conta
compartilhada), então "quem fez" já está resolvido do lado de lá. O
Controllr não registra o IP de origem corretamente: como este backend
fala com ele por trás de um proxy, o IP que chega lá é sempre o do
servidor, e a API não aceita um cabeçalho tipo X-Forwarded-For para
repassar o IP real. A auditoria por IP é resolvida aqui: técnico + IP
real + ação, gravado localmente.

Arquivo local em JSON Lines (uma linha por evento) — mesma abordagem
simples de sessions.py (uso interno, poucos técnicos, sem banco próprio).
"""

import json
import time
from pathlib import Path
from typing import Any

from fastapi import Request

from .config import AUDIT_LOG_PATH
from .sessions import TechnicianSession


# Alguns proxies/CDNs mandam o cabeçalho mesmo sem valor de verdade —
# vazio ou com um placeholder tipo "(null)"/"unknown" em vez de omitir o
# cabeçalho. Esses valores são descartados para não gravar um "IP"
# inválido no log.
_VALORES_INVALIDOS = {"", "(null)", "null", "unknown", "-"}


def obter_ip_origem(request: Request) -> str:
    """
    Tenta, em ordem: CF-Connecting-IP (se houver Cloudflare na frente),
    X-Real-IP (setado pelo nosso nginx, ver deploy/nginx.conf.example —
    "proxy_set_header X-Real-IP $remote_addr") e X-Forwarded-For (primeiro
    IP da lista "cliente, proxy1, proxy2..."). Cai no IP da conexão TCP
    só se nenhum desses vier preenchido — dev sem proxy na frente, ou
    proxy que não define nenhum dos três.
    """
    x_forwarded_for = request.headers.get("x-forwarded-for") or ""
    candidatos = [
        request.headers.get("cf-connecting-ip"),
        request.headers.get("x-real-ip"),
        x_forwarded_for.split(",")[0].strip(),
    ]
    for candidato in candidatos:
        if candidato and candidato.strip().lower() not in _VALORES_INVALIDOS:
            return candidato.strip()
    return request.client.host if request.client else "desconhecido"


def registrar_auditoria(
    request: Request,
    session: TechnicianSession,
    acao: str,
    alvo: dict[str, Any] | None = None,
) -> None:
    evento = {
        "quando": time.strftime("%Y-%m-%d %H:%M:%S"),
        "tecnico": session.username,
        "user_pk": session.user_pk,
        "ip": obter_ip_origem(request),
        "acao": acao,
        "alvo": alvo or {},
    }
    caminho = Path(AUDIT_LOG_PATH)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with caminho.open("a", encoding="utf-8") as arquivo:
        arquivo.write(json.dumps(evento, ensure_ascii=False) + "\n")
