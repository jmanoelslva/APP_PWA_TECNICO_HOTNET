from dataclasses import dataclass

from fastapi import Cookie, Depends, HTTPException

from .brbyteapi.controllr import AsyncControllr
from .config import CONTROLLR_URL, SESSION_COOKIE_NAME
from .sessions import TechnicianSession, get_session


def get_current_session(
    tecsession: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> TechnicianSession:
    session = get_session(tecsession)
    if session is None:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inexistente.")
    return session


@dataclass
class AuthContext:
    session: TechnicianSession
    controllr: AsyncControllr


def get_auth_context(session: TechnicianSession = Depends(get_current_session)) -> AuthContext:
    controllr = AsyncControllr(authorization=session.basic_auth, server_url=CONTROLLR_URL)
    return AuthContext(session=session, controllr=controllr)
