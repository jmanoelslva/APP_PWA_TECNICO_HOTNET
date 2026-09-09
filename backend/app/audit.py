"""
Log de auditoria PRÓPRIO — não depende do Controllr.

Motivo (decidido com o usuário): o Controllr autentica cada ação com o
Basic Auth do próprio técnico (ver deps.py — cada sessão carrega a
credencial dele, não uma conta compartilhada), então "quem fez" já está
resolvido do lado de lá. O que o Controllr NÃO registra corretamente é o
IP de origem: como esse backend fala com o Controllr por trás de um
proxy, o IP que chega lá é sempre o do nosso servidor — e a API dele não
aceita um cabeçalho tipo X-Forwarded-For para repassar o IP de verdade.
Como isso depende do lado do Controllr (fora do nosso controle), a
auditoria por IP é resolvida aqui: technician + IP real + ação, gravado
localmente, sem depender de nada externo.

Arquivo local em JSON Lines (uma linha por evento) — mesma filosofia
simples de sessions.py (uso interno, poucos técnicos, sem banco próprio).
"""

import json
import time
from pathlib import Path
from typing import Any

from fastapi import Request

from .config import AUDIT_LOG_PATH
from .sessions import TechnicianSession


def obter_ip_origem(request: Request) -> str:
    """
    X-Real-IP é setado pelo NOSSO nginx (ver deploy/nginx.conf.example,
    "proxy_set_header X-Real-IP $remote_addr") — confiável nesse deploy
    porque o backend só é alcançável através dele (127.0.0.1:8000, sem
    porta pública própria), nunca por quem chama de fora. Em dev (sem
    nginx, direto via proxy do Vite) cai no IP da conexão TCP mesmo.
    """
    ip_real = request.headers.get("x-real-ip")
    if ip_real:
        return ip_real
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
