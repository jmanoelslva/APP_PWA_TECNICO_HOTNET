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
    mesmo mecanismo do painel administrativo, autenticado por esse mesmo
    cookie usado em toda chamada deste backend — ver
    app/deps.py::get_auth_context). Usado tanto por /auth/logout quanto
    por get_current_session quando a checagem de liveness detecta sessão
    inválida — sem isso nos dois lugares, a sessão local some daqui mas
    fica "presa" ativa no Controllr até o lease dele expirar sozinho
    (foi exatamente o que aconteceu quando só get_session era limpo aqui:
    a próxima chamada a /auth/logout não achava mais sessão local pra
    fechar, e cada login seguinte criava mais uma sessão nova no
    Controllr, sem nunca fechar as anteriores).
    """
    # Nomes dos cookies (nunca o valor — é o token de sessão) logados pra
    # cruzar com o cookie guardado no login, enquanto investigamos por que
    # uma segunda sessão continua aparecendo no Controllr mesmo com essa
    # chamada rodando.
    nomes_cookie = [par.split("=", 1)[0] for par in cookie.split("; ") if par]
    try:
        timeout = ClientTimeout(10)
        async with ClientSession() as http:
            async with http.post(
                f"{CONTROLLR_URL}/session/logout",
                headers={"Cookie": cookie},
                timeout=timeout,
            ) as resposta:
                corpo_bruto = await resposta.text()
                if resposta.status >= 400:
                    logger.warning(
                        "Falha ao encerrar sessão de %s no Controllr (cookies %s): HTTP %s — corpo: %s",
                        username, nomes_cookie, resposta.status, corpo_bruto[:300],
                    )
                else:
                    # .warning (não .info) de propósito: sem logging.basicConfig
                    # configurado neste projeto, o logger raiz fica em WARNING
                    # por padrão — .info não apareceria em lugar nenhum.
                    logger.warning(
                        "Sessão de %s encerrada no Controllr (cookies %s): HTTP %s — corpo: %s",
                        username, nomes_cookie, resposta.status, corpo_bruto[:300],
                    )
    except Exception:
        logger.exception("Erro ao chamar /session/logout no Controllr para %s (cookies %s)", username, nomes_cookie)


async def _controllr_sessao_viva(cookie: str) -> bool:
    """
    Confirma se o cookie de sessão do Controllr (criado no /login, guardado
    em TechnicianSession.controllr_cookie e usado em toda chamada deste
    backend) ainda é aceito por ele.

    Existe como checagem proativa e periódica (CONTROLLR_LIVENESS_CHECK_SECONDS)
    em vez de só deixar a próxima chamada de dado falhar sozinha: uma
    sessão encerrada manualmente no painel (ou expirada por inatividade)
    ainda assim viraria um erro genérico de "não foi possível carregar"
    numa tela qualquer, sem a mensagem clara de sessão expirada nem o
    redirecionamento pro login que o 401 daqui dispara no frontend.

    /web_auth/acl_perm/list (lista as PRÓPRIAS permissões do usuário) é o
    endpoint usado — precisa funcionar para qualquer sessão válida
    independente do cargo/ACL, já que o próprio painel usa isso pra decidir
    o que exibir para qualquer usuário logado. Um candidato mais leve,
    /sys/message/count, foi testado antes só numa sessão de admin (que tem
    acesso a tudo) e se mostrou restrito por ACL de módulo — retornava
    "Access Denied" (HTTP 403) pra um técnico comum mesmo com a sessão
    perfeitamente viva, derrubando todo mundo à toa.
    """
    try:
        timeout = ClientTimeout(10)
        async with ClientSession() as http:
            async with http.post(
                f"{CONTROLLR_URL}/web_auth/acl_perm/list",
                headers={"Cookie": cookie},
                timeout=timeout,
            ) as resposta:
                corpo_bruto = await resposta.text()
                if resposta.status >= 400:
                    logger.warning(
                        "Liveness Controllr: HTTP %s — corpo: %s", resposta.status, corpo_bruto[:500]
                    )
                    return False
                try:
                    corpo = await resposta.json(content_type=None)
                except Exception:
                    logger.warning(
                        "Liveness Controllr: HTTP %s sem JSON válido — corpo: %s",
                        resposta.status,
                        corpo_bruto[:500],
                    )
                    return False
                viva = bool(corpo.get("success", False))
                if not viva:
                    logger.warning("Liveness Controllr: success=false — corpo: %s", corpo_bruto[:500])
                return viva
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
    if (agora - session.controllr_checked_at) > CONTROLLR_LIVENESS_CHECK_SECONDS:
        if not await _controllr_sessao_viva(session.controllr_cookie):
            # Best-effort: a sessão já não responde como válida, mas ainda
            # assim tenta fechá-la de verdade no Controllr — sem isso ela
            # fica "presa" ativa lá até o lease expirar sozinho (ver
            # encerrar_sessao_controllr).
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
