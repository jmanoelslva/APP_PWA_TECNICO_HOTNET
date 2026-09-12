"""
Store de sessão do técnico, em memória (processo único).

Guarda o cookie de sessão do POST /login do Controllr (BRBOSCookie) e o
user_pk do ACL, associados a um session_id opaco que vira o valor do
cookie TECSESSION no navegador. Esse cookie é usado em toda chamada de
API deste backend (ver deps.py::get_auth_context) — Basic Auth por
requisição abria uma segunda sessão "implícita" no Controllr, sem token
pra fechar, duplicada na lista de usuários online do painel.

Sem TTL próprio: uma TechnicianSession vive enquanto o cookie continuar
sendo aceito pelo Controllr, e não sobrevive a um restart do processo.
Aceitável para uso interno com poucos técnicos simultâneos; trocar por
Redis se o volume crescer.
"""

import secrets
import time
from dataclasses import dataclass


@dataclass
class TechnicianSession:
    session_id: str
    username: str
    controllr_cookie: str
    user_pk: int | None
    created_at: float
    # Última vez que confirmamos com o Controllr que controllr_cookie ainda
    # é uma sessão válida lá (ver deps.py::get_current_session) — 0.0 força
    # a primeira checagem já na próxima requisição autenticada.
    controllr_checked_at: float = 0.0


_sessions: dict[str, TechnicianSession] = {}


def create_session(username: str, controllr_cookie: str, user_pk: int | None) -> TechnicianSession:
    session_id = secrets.token_urlsafe(32)
    session = TechnicianSession(
        session_id=session_id,
        username=username,
        controllr_cookie=controllr_cookie,
        user_pk=user_pk,
        created_at=time.time(),
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str | None) -> TechnicianSession | None:
    if not session_id:
        return None
    return _sessions.get(session_id)


def delete_session(session_id: str | None) -> None:
    if session_id:
        _sessions.pop(session_id, None)
