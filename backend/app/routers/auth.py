import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel

from .. import limite_login
from ..audit import obter_ip_origem, registrar_auditoria
from ..brbyteapi.controllr.login import ControllrLogin
from ..config import CONTROLLR_URL, LOGIN_BLOQUEIO_MINUTOS, COOKIE_SEGURO, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME
from ..brbyteapi.controllr.controllr import AsyncControllr
from ..deps import AuthContext, encerrar_sessao_controllr, get_auth_context
from ..sessions import TechnicianSession, create_session, definir_nome, delete_session, get_session
from ..where import corpo

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    username: str
    password: str


class TecnicoDto(BaseModel):
    username: str
    # Nome cadastrado no Controllr (ex.: "Pedro Carlos"); None quando o
    # técnico não tem permissão de ler /web_auth/acl_user ou não há nome.
    nome: str | None = None


class LoginResponse(BaseModel):
    success: bool
    message: str | None = None
    tecnico: TecnicoDto | None = None


def nome_do_usuario(registros: list[dict[str, Any]], username: str) -> str:
    """user_name do registro cujo user_username é o do técnico; "" se não houver."""
    alvo = username.strip().casefold()
    for registro in registros:
        if str(registro.get("user_username") or "").strip().casefold() == alvo:
            return str(registro.get("user_name") or "").strip()
    return ""


async def resolver_nome(sessao: TechnicianSession) -> str | None:
    """
    Consulta uma única vez por sessão o nome do técnico no Controllr. A lista
    de usuários é pequena e o filtro é feito aqui (mesmo cuidado do antigo
    _find_user_pk). Sem permissão, erro ou demora: grava "" e segue com o
    username — nunca atrapalha o login.
    """
    if sessao.nome is None:
        nome = ""
        try:
            controllr = AsyncControllr(cookie=sessao.controllr_cookie, server_url=CONTROLLR_URL)
            resposta = await asyncio.wait_for(controllr.user_list(corpo(start=0, limit=500)), timeout=5)
            if resposta.success:
                nome = nome_do_usuario(resposta.results, sessao.username)
        except Exception:
            logger.info("Nome do técnico %s indisponível no Controllr; usando o username", sessao.username)
        definir_nome(sessao, nome)
    return sessao.nome or None


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, response: Response) -> LoginResponse:
    ip = obter_ip_origem(request)
    # Bloqueado: nem chega a tentar no Controllr (ver limite_login.py).
    if limite_login.bloqueado(ip, payload.username):
        logger.warning("Login bloqueado por excesso de tentativas: usuário %r, IP %s", payload.username, ip)
        return LoginResponse(
            success=False,
            message=f"Muitas tentativas erradas. Aguarde {LOGIN_BLOQUEIO_MINUTOS} minutos e tente de novo.",
        )
    resultado_login = await ControllrLogin.login(CONTROLLR_URL, payload.username, payload.password)
    if getattr(resultado_login, "indisponivel", False):
        # Não conta como tentativa errada: a senha nem foi conferida.
        logger.warning("Controllr indisponível no login de %r", payload.username)
        return LoginResponse(success=False, message="Servidor indisponível. Tente de novo em instantes.")
    if not resultado_login.success:
        limite_login.falhou(ip, payload.username)
        logger.info("Login recusado pelo Controllr: usuário %r, IP %s", payload.username, ip)
        return LoginResponse(success=False, message="Usuário ou senha incorretos.")
    limite_login.acertou(ip, payload.username)

    if resultado_login.cookie_header is None:
        # Toda chamada ao Controllr usa esse cookie (ver
        # deps.py::get_auth_context) — sem ele o login não pode prosseguir.
        logger.error("Login de %s sem cookie de sessão do Controllr", payload.username)
        return LoginResponse(success=False, message="Não foi possível iniciar a sessão. Tente novamente.")

    sessao = create_session(
        username=payload.username,
        controllr_cookie=resultado_login.cookie_header,
    )
    registrar_auditoria(request, sessao, "auth.login")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sessao.session_id,
        httponly=True,
        secure=COOKIE_SEGURO,
        samesite="lax",
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    # Sem buscar o nome aqui: o login continua sem a lista de usuários (1.14.2).
    # O app pede /auth/me logo depois, em segundo plano, e o nome vem por lá.
    return LoginResponse(success=True, tecnico=TecnicoDto(username=payload.username))


@router.post("/logout")
async def logout(
    response: Response,
    tecsession: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict[str, bool]:
    sessao = get_session(tecsession)
    if sessao is not None:
        await encerrar_sessao_controllr(sessao.username, sessao.controllr_cookie)

    delete_session(tecsession)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", secure=COOKIE_SEGURO, httponly=True, samesite="lax")
    return {"success": True}


@router.get("/me", response_model=TecnicoDto)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> TecnicoDto:
    return TecnicoDto(username=ctx.session.username, nome=await resolver_nome(ctx.session))
