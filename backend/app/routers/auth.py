import logging
from typing import Any

from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel

from ..brbyteapi.controllr import AsyncControllr
from ..brbyteapi.controllr.login import ControllrLogin
from ..config import CONTROLLR_URL, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME
from ..deps import AuthContext, encerrar_sessao_controllr, get_auth_context
from ..sessions import create_session, delete_session, get_session

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    username: str
    password: str


class TecnicoDto(BaseModel):
    username: str
    user_pk: int | None = None


class LoginResponse(BaseModel):
    success: bool
    message: str | None = None
    tecnico: TecnicoDto | None = None


def _find_user_pk(records: list[dict[str, Any]], username: str) -> int | None:
    """
    O pacote brbyteapi não documenta o campo de login em web_auth/acl_user
    (só expõe user_list(body) genérico) — em vez de arriscar um nome de
    campo errado no filtro "where", busca o registro cujo(s) valor(es)
    batem com o username informado e lê o pk a partir das chaves comuns.
    """
    alvo = username.strip().lower()
    for registro in records:
        valores = {str(v).strip().lower() for v in registro.values() if isinstance(v, (str, int))}
        if alvo in valores:
            for chave_pk in ("user_pk", "acl_user_pk", "pk"):
                if chave_pk in registro:
                    try:
                        return int(registro[chave_pk])
                    except (TypeError, ValueError):
                        continue
    return None


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response) -> LoginResponse:
    resultado_login = await ControllrLogin.login(CONTROLLR_URL, payload.username, payload.password)
    if not resultado_login.success:
        return LoginResponse(success=False, message="Usuário ou senha incorretos.")

    if resultado_login.cookie_header is None:
        # Toda chamada deste backend ao Controllr usa esse cookie (ver
        # deps.py::get_auth_context) — sem ele não tem como autenticar
        # nada, então o login não pode prosseguir. Login validado acima
        # (usuário/senha corretos) mas sem cookie é falha do lado do
        # Controllr/ControllrLogin.login, não do técnico.
        logger.error("Login de %s sem cookie de sessão do Controllr — não é possível autenticar chamadas", payload.username)
        return LoginResponse(success=False, message="Não foi possível iniciar a sessão. Tente novamente.")

    # Nomes dos cookies (nunca o valor) — cruzar com o log de
    # encerrar_sessao_controllr caso a sessão pareça duplicada de novo.
    nomes_cookie = [par.split("=", 1)[0] for par in resultado_login.cookie_header.split("; ") if par]
    logger.warning("Login de %s — cookies de sessão do Controllr: %s", payload.username, nomes_cookie)

    controllr = AsyncControllr(cookie=resultado_login.cookie_header, server_url=CONTROLLR_URL)
    user_pk: int | None = None
    try:
        resultado = await controllr.user_list("limit=200")
        if resultado.success:
            user_pk = _find_user_pk(resultado.results, payload.username)
    except Exception:
        # Login já foi validado acima; falha aqui só significa que "Minhas
        # OS" vai cair para "Todas" até resolvermos o campo certo do ACL.
        user_pk = None

    sessao = create_session(
        username=payload.username,
        controllr_cookie=resultado_login.cookie_header,
        user_pk=user_pk,
    )
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sessao.session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_COOKIE_MAX_AGE_SECONDS,
        path="/",
    )
    return LoginResponse(success=True, tecnico=TecnicoDto(username=payload.username, user_pk=user_pk))


@router.post("/logout")
async def logout(
    response: Response,
    tecsession: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict[str, bool]:
    sessao = get_session(tecsession)
    if sessao is not None:
        await encerrar_sessao_controllr(sessao.username, sessao.controllr_cookie)

    delete_session(tecsession)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"success": True}


@router.get("/me", response_model=TecnicoDto)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> TecnicoDto:
    return TecnicoDto(username=ctx.session.username, user_pk=ctx.session.user_pk)
