"""
Avisos de OS nova no celular do técnico (Web Push).

Guarda, em arquivos JSON na pasta AVISOS_DADOS_DIR:
- inscricoes.json — celulares que ativaram os avisos, por login do técnico
  (o mesmo login do app, que é o staff_username da OS);
- os_vistas.json — OS já vistas por técnico, para avisar só das novas e não
  repetir depois de reiniciar o serviço.

Quem procura OS nova e chama enviar_para() é app/vigia_os.py. Mesmo jeito
simples de audit.py: processo único, poucos técnicos, sem banco próprio.
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from pywebpush import WebPushException, webpush_async

from .config import AVISOS_DADOS_DIR, VAPID_CONTATO, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY

logger = logging.getLogger(__name__)
_lock = threading.Lock()


def configurado() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY)


# ------------------------------------------------------------------ arquivos


def _arquivo(nome: str) -> Path:
    return Path(AVISOS_DADOS_DIR) / nome


def _ler(nome: str, padrao: Any) -> Any:
    try:
        return json.loads(_arquivo(nome).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return padrao
    except (OSError, ValueError):
        logger.exception("Avisos: %s ilegível, começando do zero", nome)
        return padrao


def _gravar(nome: str, dados: Any) -> None:
    """Grava num arquivo temporário e troca: um desligamento no meio não corrompe."""
    destino = _arquivo(nome)
    destino.parent.mkdir(parents=True, exist_ok=True)
    temporario = destino.with_suffix(".tmp")
    temporario.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    os.replace(temporario, destino)


def _login(usuario: str) -> str:
    return usuario.strip().lower()


# ------------------------------------------------------------------ inscrições


def inscrever(usuario: str, inscricao: dict[str, Any]) -> None:
    """Liga os avisos neste celular para o técnico. O mesmo celular (endpoint)
    só fica com um técnico: quem entrou por último."""
    endpoint = inscricao["endpoint"]
    with _lock:
        todas: dict[str, list[dict[str, Any]]] = _ler("inscricoes.json", {})
        for login in list(todas):
            todas[login] = [i for i in todas[login] if i["endpoint"] != endpoint]
            if not todas[login]:
                del todas[login]
        todas.setdefault(_login(usuario), []).append({**inscricao, "desde": time.strftime("%Y-%m-%d %H:%M:%S")})
        _gravar("inscricoes.json", todas)


def remover(endpoint: str, usuario: str | None = None) -> None:
    """Desliga os avisos deste celular (de um técnico só, se informado)."""
    with _lock:
        todas: dict[str, list[dict[str, Any]]] = _ler("inscricoes.json", {})
        for login in list(todas):
            if usuario is not None and login != _login(usuario):
                continue
            todas[login] = [i for i in todas[login] if i["endpoint"] != endpoint]
            if not todas[login]:
                del todas[login]
        _gravar("inscricoes.json", todas)


def inscricoes_de(usuario: str) -> list[dict[str, Any]]:
    with _lock:
        return list(_ler("inscricoes.json", {}).get(_login(usuario), []))


# ------------------------------------------------------------------ OS vistas


def ler_vistas() -> dict[str, Any] | None:
    """{"chaves": [...]} já gravado, ou None na primeira vez (nada visto ainda)."""
    with _lock:
        return _ler("os_vistas.json", None)


def gravar_vistas(chaves: set[str]) -> None:
    with _lock:
        _gravar("os_vistas.json", {"chaves": sorted(chaves)})


# ------------------------------------------------------------------ texto


def _quando(op_date_sched: str | None, agora: datetime) -> str | None:
    try:
        data = datetime.strptime(str(op_date_sched)[:16], "%Y-%m-%d %H:%M")
    except ValueError:
        return None
    hora = data.strftime("%H:%M")
    if data.date() == agora.date():
        return f"hoje {hora}"
    if data.date() == (agora + timedelta(days=1)).date():
        return f"amanhã {hora}"
    return data.strftime("%d/%m %H:%M")


def texto_os(os_: dict[str, Any], agora: datetime | None = None) -> dict[str, str]:
    """Título e corpo do aviso. Sem nome do cliente: aparece na tela bloqueada."""
    tipo = (os_.get("task_name") or os_.get("op_desc") or "OS").strip()
    partes = [p for p in ((os_.get("address_neighborhood") or "").strip(),
                          _quando(os_.get("op_date_sched"), agora or datetime.now())) if p]
    corpo = f"{tipo} — {', '.join(partes)}" if partes else tipo
    ticket = os_.get("ticket_pk")
    return {
        "titulo": "Nova OS",
        "corpo": corpo,
        "url": f"/os/{ticket}" if ticket else "/suporte",
        "tag": f"os-{os_.get('op_pk')}",
    }


# ------------------------------------------------------------------ envio


async def enviar(inscricao: dict[str, Any], aviso: dict[str, str], usuario: str = "") -> bool:
    """Manda o aviso a um celular. Se o serviço de push diz que ele não existe
    mais (404/410), sai da lista."""
    try:
        await webpush_async(
            subscription_info={"endpoint": inscricao["endpoint"], "keys": inscricao["keys"]},
            data=json.dumps(aviso, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_CONTATO},
            ttl=6 * 3600,
            timeout=15,
        )
        return True
    except WebPushException as erro:
        status = getattr(erro.response, "status", None) or getattr(erro.response, "status_code", None)
        if status in (404, 410):
            logger.info("Avisos: celular de %s não existe mais, removendo", usuario)
            remover(inscricao["endpoint"])
        else:
            logger.warning("Avisos: falha ao enviar para %s (HTTP %s)", usuario, status)
    except Exception:
        logger.exception("Avisos: erro ao enviar para %s", usuario)
    return False


async def enviar_para(usuario: str, aviso: dict[str, str]) -> int:
    """Manda o aviso a todos os celulares do técnico. Devolve quantos foram."""
    enviados = 0
    for inscricao in inscricoes_de(usuario):
        enviados += await enviar(inscricao, aviso, usuario)
    return enviados
