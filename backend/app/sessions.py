"""
Store de sessão do técnico, em memória (processo único).

Guarda o header "Authorization: Basic ..." resolvido no login (não a senha
em si) e o user_pk do ACL do técnico, associados a um session_id opaco que
vira o valor do cookie TECSESSION no navegador. Toda chamada de API deste
backend ao Controllr usa esse Basic Auth, por requisição, sem estado — o
Controllr não mantém sessão para esse Basic Auth (POST /session/logout
com só o header Basic, sem cookie, não encerra nada, pois não há sessão
associada a esse header).

Guarda também o cookie de sessão que o próprio POST /login do Controllr
retorna (mesmo mecanismo do painel administrativo, BRBOSCookie), usado
só para encerrar essa sessão no /auth/logout — nenhuma outra chamada de
API usa esse cookie.

Sessões não sobrevivem a um restart do processo — um técnico logado
precisa logar de novo se o backend reiniciar. Aceitável para uso interno
com poucos técnicos simultâneos; trocar por Redis se o volume crescer.
"""

import secrets
import time
from dataclasses import dataclass

from .config import SESSION_TTL_SECONDS


@dataclass
class TechnicianSession:
    session_id: str
    username: str
    basic_auth: str
    user_pk: int | None
    created_at: float
    controllr_cookie: str | None = None
    # Última vez que confirmamos com o Controllr que controllr_cookie ainda
    # é uma sessão válida lá (ver deps.py::get_current_session) — 0.0 força
    # a primeira checagem já na próxima requisição autenticada.
    controllr_checked_at: float = 0.0

    def expired(self) -> bool:
        return (time.time() - self.created_at) > SESSION_TTL_SECONDS


_sessions: dict[str, TechnicianSession] = {}


def create_session(
    username: str, basic_auth: str, user_pk: int | None, controllr_cookie: str | None = None
) -> TechnicianSession:
    session_id = secrets.token_urlsafe(32)
    session = TechnicianSession(
        session_id=session_id,
        username=username,
        basic_auth=basic_auth,
        user_pk=user_pk,
        created_at=time.time(),
        controllr_cookie=controllr_cookie,
    )
    _sessions[session_id] = session
    return session


def get_session(session_id: str | None) -> TechnicianSession | None:
    if not session_id:
        return None
    session = _sessions.get(session_id)
    if session is None:
        return None
    if session.expired():
        _sessions.pop(session_id, None)
        return None
    return session


def delete_session(session_id: str | None) -> None:
    if session_id:
        _sessions.pop(session_id, None)
