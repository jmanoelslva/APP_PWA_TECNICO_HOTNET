import logging
import time
from dataclasses import dataclass

from aiohttp import ClientSession, ClientTimeout
from fastapi import Cookie, Depends, HTTPException

from .brbyteapi.controllr import AsyncControllr
from .config import CONTROLLR_LIVENESS_CHECK_SECONDS, CONTROLLR_URL, SESSION_COOKIE_NAME
from .sessions import TechnicianSession, delete_session, get_session

logger = logging.getLogger(__name__)


async def _controllr_sessao_viva(cookie: str) -> bool:
    """
    Confirma se o cookie de sessão do Controllr (criado no /login, guardado
    em TechnicianSession.controllr_cookie) ainda é aceito por ele.

    Existe porque as demais chamadas deste backend ao Controllr usam Basic
    Auth por requisição, que não depende de sessão nenhuma (ver
    CONTROLLR_API_NOTES.md, seção 8.5) — então nunca detectariam sozinhas um
    admin encerrando a sessão do técnico manualmente pelo painel.
    /sys/message/count é o endpoint usado por exigir sessão válida com o
    menor payload de resposta entre os candidatos (o painel administrativo
    também chama esse endpoint a cada carregamento de página).
    """
    # FAIL-OPEN temporário: logando em detalhe em vez de derrubar a sessão
    # numa resposta que não seja um success:true claro. A checagem nunca foi
    # confirmada contra o Controllr de verdade nessa chamada servidor-a-
    # servidor (só via fetch do próprio navegador, que manda outros cookies/
    # headers junto) — voltou "sessão encerrada" para todo mundo já na
    # primeira navegação após o login. Assim que os logs mostrarem o motivo
    # real (status/corpo abaixo), volta a derrubar de verdade.
    try:
        timeout = ClientTimeout(10)
        async with ClientSession() as http:
            async with http.post(
                f"{CONTROLLR_URL}/sys/message/count",
                headers={"Cookie": cookie},
                timeout=timeout,
            ) as resposta:
                corpo_bruto = await resposta.text()
                if resposta.status >= 400:
                    logger.warning(
                        "Liveness Controllr: HTTP %s — corpo: %s", resposta.status, corpo_bruto[:500]
                    )
                    return True
                try:
                    corpo = await resposta.json(content_type=None)
                except Exception:
                    logger.warning(
                        "Liveness Controllr: HTTP %s sem JSON válido — corpo: %s",
                        resposta.status,
                        corpo_bruto[:500],
                    )
                    return True
                if not corpo.get("success", False):
                    logger.warning("Liveness Controllr: success=false — corpo: %s", corpo_bruto[:500])
                return True
    except Exception:
        logger.exception("Falha ao checar liveness da sessão do técnico no Controllr")
        # Falha de rede/timeout não é a mesma coisa que sessão encerrada —
        # não desloga o técnico por um problema transitório de conexão,
        # só tenta de novo na próxima checagem.
        return True


async def get_current_session(
    tecsession: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> TechnicianSession:
    session = get_session(tecsession)
    if session is None:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inexistente.")

    # Throttlado (não a cada request) pra não dobrar toda chamada deste
    # backend com uma ida extra ao Controllr — CONTROLLR_LIVENESS_CHECK_SECONDS
    # é o quanto um técnico deslogado manualmente no painel ainda consegue
    # usar o app antes disso ser detectado.
    agora = time.time()
    if session.controllr_cookie and (agora - session.controllr_checked_at) > CONTROLLR_LIVENESS_CHECK_SECONDS:
        if not await _controllr_sessao_viva(session.controllr_cookie):
            delete_session(tecsession)
            raise HTTPException(status_code=401, detail="Sessão encerrada no Controllr.")
        session.controllr_checked_at = agora

    return session


@dataclass
class AuthContext:
    session: TechnicianSession
    controllr: AsyncControllr


def get_auth_context(session: TechnicianSession = Depends(get_current_session)) -> AuthContext:
    controllr = AsyncControllr(authorization=session.basic_auth, server_url=CONTROLLR_URL)
    return AuthContext(session=session, controllr=controllr)
