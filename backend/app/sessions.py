"""
Store de sessão do técnico, em memória (processo único).

Guarda o cookie de sessão que o POST /login do Controllr retorna (mesmo
mecanismo do painel administrativo, cookie BRBOSCookie) e o user_pk do
ACL do técnico, associados a um session_id opaco que vira o valor do
cookie TECSESSION no navegador. Esse cookie do Controllr é usado em TODA
chamada de API deste backend (ver deps.py::get_auth_context) — não Basic
Auth por requisição como antes: autenticar cada chamada por Basic Auth
fazia o Controllr abrir e manter uma segunda sessão "implícita" para esse
uso, sem token nenhum pra guardar e fechar depois, aparecendo como sessão
duplicada na lista de usuários online do painel administrativo. Com tudo
pelo mesmo cookie, existe só a sessão de verdade, a mesma que /auth/logout
encerra e que a checagem periódica de liveness confirma (ver
CONTROLLR_LIVENESS_CHECK_SECONDS em config.py).

Não há TTL próprio aqui: uma TechnicianSession vive enquanto o cookie de
sessão do Controllr continuar sendo aceito por ele — o Controllr é quem
decide quando expirar por inatividade. Sessões também não sobrevivem a um
restart do processo — um técnico logado precisa logar de novo se o
backend reiniciar. Aceitável para uso interno com poucos técnicos
simultâneos; trocar por Redis se o volume crescer.
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
