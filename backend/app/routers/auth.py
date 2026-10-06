import logging

from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel

from .. import limite_login
from ..audit import obter_ip_origem
from ..brbyteapi.controllr.login import ControllrLogin
from ..config import CONTROLLR_URL, LOGIN_BLOQUEIO_MINUTOS, COOKIE_SEGURO, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME
from ..deps import AuthContext, encerrar_sessao_controllr, get_auth_context
from ..sessions import create_session, delete_session, get_session

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    username: str
    password: str


class TecnicoDto(BaseModel):
    username: str


class LoginResponse(BaseModel):
    success: bool
    message: str | None = None
    tecnico: TecnicoDto | None = None


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
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sessao.session_id,
        httponly=True,
        secure=COOKIE_SEGURO,
        samesite="lax",
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
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
    return TecnicoDto(username=ctx.session.username)
