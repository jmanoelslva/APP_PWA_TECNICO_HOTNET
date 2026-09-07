import base64
from typing import Any

from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel

from ..brbyteapi.controllr import AsyncControllr
from ..brbyteapi.controllr.login import ControllrLogin
from ..config import CONTROLLR_URL, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS
from ..deps import AuthContext, get_auth_context
from ..sessions import create_session, delete_session, get_session

router = APIRouter(prefix="/auth", tags=["auth"])


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
    autenticado = await ControllrLogin.login(CONTROLLR_URL, payload.username, payload.password)
    if not autenticado:
        return LoginResponse(success=False, message="Usuário ou senha incorretos.")

    credenciais = f"{payload.username}:{payload.password}".encode("utf-8")
    basic_auth = "Basic " + base64.b64encode(credenciais).decode("ascii")

    controllr = AsyncControllr(authorization=basic_auth, server_url=CONTROLLR_URL)
    user_pk: int | None = None
    try:
        resultado = await controllr.user_list("limit=200")
        if resultado.success:
            user_pk = _find_user_pk(resultado.results, payload.username)
    except Exception:
        # Login já foi validado acima; falha aqui só significa que "Minhas
        # OS" vai cair pra "Todas" até resolvermos o campo certo do ACL.
        user_pk = None

    sessao = create_session(username=payload.username, basic_auth=basic_auth, user_pk=user_pk)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sessao.session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
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
        # Avisa o próprio Controllr que a sessão do técnico encerrou
        # (mesmo endpoint usado pelo painel administrativo, apesar de
        # aqui a gente não manter cookie de sessão com ele — chamada por
        # cortesia). Best-effort: falhar aqui não pode impedir o logout
        # local, que é o que de fato protege a conta (apaga a sessão
        # deste backend e o cookie do navegador).
        try:
            controllr = AsyncControllr(authorization=sessao.basic_auth, server_url=CONTROLLR_URL)
            await controllr.call_api_post("/session/logout")
        except Exception:
            pass

    delete_session(tecsession)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"success": True}


@router.get("/me", response_model=TecnicoDto)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> TecnicoDto:
    return TecnicoDto(username=ctx.session.username, user_pk=ctx.session.user_pk)
