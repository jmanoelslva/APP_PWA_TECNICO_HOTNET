"""
Store de sessão do técnico (processo único).

Guarda o cookie de sessão do POST /login do Controllr (BRBOSCookie),
associado a um session_id opaco que vira o valor do
cookie TECSESSION no navegador. Esse cookie é usado em toda chamada de
API deste backend (ver deps.py::get_auth_context) — Basic Auth por
requisição abria uma segunda sessão "implícita" no Controllr, sem token
pra fechar, duplicada na lista de usuários online do painel.

Sem TTL próprio: uma TechnicianSession vive enquanto o cookie continuar
sendo aceito pelo Controllr (que expira a sessão por inatividade).

Sobrevive a reinício: com SESSOES_CHAVE no backend.env (gerada pelo
install.sh), as sessões são gravadas cifradas (Fernet) em SESSOES_ARQUIVO
a cada login/saída e relidas ao subir. Assim atualizar o app não derruba
os técnicos — na volta, a primeira requisição de cada um confere com o
Controllr se a sessão ainda vale (controllr_checked_at = 0). Sem a chave
(dev), fica só em memória, como antes. Arquivo ilegível ou chave trocada:
começa vazio (todo mundo entra de novo), nunca derruba o serviço.
"""

import json
import logging
import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path

from .config import SESSION_COOKIE_MAX_AGE_SECONDS, SESSOES_ARQUIVO, SESSOES_CHAVE

logger = logging.getLogger(__name__)


@dataclass
class TechnicianSession:
    session_id: str
    username: str
    controllr_cookie: str
    created_at: float
    # Última vez que confirmamos com o Controllr que controllr_cookie ainda
    # é uma sessão válida lá (ver deps.py::get_current_session) — 0.0 força
    # a primeira checagem já na próxima requisição autenticada.
    controllr_checked_at: float = 0.0


_sessions: dict[str, TechnicianSession] = {}
# Outros cookies que valem a pena manter entre reinícios (ex.: o do vigia de
# OS, para o usuário de consulta não sair e entrar no Controllr a cada deploy).
_extras: dict[str, str] = {}


def _cifra():
    if not SESSOES_CHAVE:
        return None
    try:
        from cryptography.fernet import Fernet

        return Fernet(SESSOES_CHAVE.encode())
    except Exception:
        logger.exception("SESSOES_CHAVE inválida: sessões só em memória")
        return None


_fernet = _cifra()


def persistente() -> bool:
    return _fernet is not None


def _gravar() -> None:
    if _fernet is None:
        return
    dados = {
        "sessoes": [
            {"id": s.session_id, "usuario": s.username, "cookie": s.controllr_cookie, "criada": s.created_at}
            for s in _sessions.values()
        ],
        "extras": _extras,
    }
    try:
        arquivo = Path(SESSOES_ARQUIVO)
        arquivo.parent.mkdir(parents=True, exist_ok=True)
        temporario = arquivo.with_suffix(".tmp")
        temporario.write_bytes(_fernet.encrypt(json.dumps(dados).encode()))
        os.chmod(temporario, 0o600)
        temporario.replace(arquivo)
    except Exception:
        # Falha ao gravar não pode derrubar login/saída: só perde a sessão
        # num próximo reinício.
        logger.exception("Não foi possível gravar as sessões em %s", SESSOES_ARQUIVO)


def carregar() -> None:
    """Relê as sessões gravadas (chamado uma vez ao subir o serviço)."""
    if _fernet is None:
        return
    arquivo = Path(SESSOES_ARQUIVO)
    if not arquivo.exists():
        return
    try:
        dados = json.loads(_fernet.decrypt(arquivo.read_bytes()))
    except Exception:
        logger.warning("Sessões gravadas ilegíveis (chave trocada?): todos entram de novo")
        return
    agora = time.time()
    _sessions.clear()
    for s in dados.get("sessoes", []):
        if agora - float(s["criada"]) > SESSION_COOKIE_MAX_AGE_SECONDS:
            continue
        _sessions[s["id"]] = TechnicianSession(
            session_id=s["id"], username=s["usuario"], controllr_cookie=s["cookie"], created_at=float(s["criada"])
        )
    _extras.clear()
    _extras.update({str(k): str(v) for k, v in dados.get("extras", {}).items()})
    logger.info("Sessões relidas após reinício: %d", len(_sessions))


def create_session(username: str, controllr_cookie: str) -> TechnicianSession:
    session_id = secrets.token_urlsafe(32)
    session = TechnicianSession(
        session_id=session_id,
        username=username,
        controllr_cookie=controllr_cookie,
        created_at=time.time(),
    )
    _sessions[session_id] = session
    _gravar()
    return session


def get_session(session_id: str | None) -> TechnicianSession | None:
    if not session_id:
        return None
    return _sessions.get(session_id)


def delete_session(session_id: str | None) -> None:
    if session_id and _sessions.pop(session_id, None) is not None:
        _gravar()


def ler_extra(nome: str) -> str | None:
    return _extras.get(nome)


def guardar_extra(nome: str, valor: str | None) -> None:
    if valor is None:
        if _extras.pop(nome, None) is not None:
            _gravar()
    elif _extras.get(nome) != valor:
        _extras[nome] = valor
        _gravar()
