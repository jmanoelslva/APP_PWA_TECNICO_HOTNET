import logging
import time
from dataclasses import dataclass

from aiohttp import ClientSession, ClientTimeout
from fastapi import Cookie, Depends, HTTPException

from .brbyteapi.controllr import AsyncControllr
from .config import CONTROLLR_LIVENESS_CHECK_SECONDS, CONTROLLR_URL, SESSION_COOKIE_NAME
from .sessions import TechnicianSession, delete_session, get_session

logger = logging.getLogger(__name__)


async def encerrar_sessao_controllr(username: str, cookie: str) -> None:
    """
    Encerra no Controllr a sessão criada no /login (POST /session/logout,
    mesmo mecanismo do painel administrativo). Usado por /auth/logout e
    por get_current_session quando a liveness detecta sessão inválida —
    sem isso, a sessão fica presa ativa no Controllr até o lease expirar.
    """
    try:
        timeout = ClientTimeout(10)
        async with ClientSession() as http:
            async with http.post(
                f"{CONTROLLR_URL}/session/logout",
                headers={"Cookie": cookie},
                timeout=timeout,
            ) as resposta:
                if resposta.status >= 400:
                    corpo = await resposta.text()
                    logger.warning(
                        "Falha ao encerrar sessão de %s no Controllr: HTTP %s — %s",
                        username, resposta.status, corpo[:300],
                    )
    except Exception:
        logger.exception("Erro ao chamar /session/logout no Controllr para %s", username)


async def _controllr_sessao_viva(cookie: str) -> bool:
    """
    Confirma se o cookie de sessão ainda é aceito pelo Controllr — sem
    isso, uma sessão morta só seria percebida quando alguma chamada de
    dado falhasse sozinha, com um erro genérico em vez do 401 que
    redireciona pro login.

    Usa /web_auth/acl_perm/list (lista as próprias permissões do
    usuário) por precisar funcionar pra qualquer sessão válida,
    independente do cargo — /sys/message/count, testado antes, é
    restrito por ACL de módulo e retorna 403 pra técnicos comuns.
    """
    try:
        timeout = ClientTimeout(10)
        async with ClientSession() as http:
            async with http.post(
                f"{CONTROLLR_URL}/web_auth/acl_perm/list",
                headers={"Cookie": cookie},
                timeout=timeout,
            ) as resposta:
                if resposta.status >= 400:
                    logger.warning("Liveness Controllr: HTTP %s", resposta.status)
                    return False
                try:
                    corpo = await resposta.json(content_type=None)
                except Exception:
                    logger.warning("Liveness Controllr: resposta sem JSON válido")
                    return False
                return bool(corpo.get("success", False))
    except Exception:
        logger.exception("Falha ao checar liveness da sessão do técnico no Controllr")
        # Falha de rede/timeout não é sessão encerrada — não desloga por
        # instabilidade, só tenta de novo na próxima checagem.
        return True


async def get_current_session(
    tecsession: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> TechnicianSession:
    session = get_session(tecsession)
    if session is None:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inexistente.")

    # Throttlado — CONTROLLR_LIVENESS_CHECK_SECONDS é o quanto uma sessão
    # encerrada no Controllr ainda funciona aqui antes de ser detectada.
    agora = time.time()
    if (agora - session.controllr_checked_at) > CONTROLLR_LIVENESS_CHECK_SECONDS:
        if not await _controllr_sessao_viva(session.controllr_cookie):
            await encerrar_sessao_controllr(session.username, session.controllr_cookie)
            delete_session(tecsession)
            raise HTTPException(status_code=401, detail="Sessão encerrada no Controllr.")
        session.controllr_checked_at = agora

    return session


@dataclass
class AuthContext:
    session: TechnicianSession
    controllr: AsyncControllr


def get_auth_context(session: TechnicianSession = Depends(get_current_session)) -> AuthContext:
    controllr = AsyncControllr(cookie=session.controllr_cookie, server_url=CONTROLLR_URL)
    return AuthContext(session=session, controllr=controllr)
