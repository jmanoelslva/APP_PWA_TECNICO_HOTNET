import base64
import logging
from typing import Any

from aiohttp import ClientSession, ClientTimeout
from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel

from ..brbyteapi.controllr import AsyncControllr
from ..brbyteapi.controllr.login import ControllrLogin
from ..config import CONTROLLR_URL, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS
from ..deps import AuthContext, get_auth_context
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
        # OS" vai cair para "Todas" até resolvermos o campo certo do ACL.
        user_pk = None

    sessao = create_session(
        username=payload.username,
        basic_auth=basic_auth,
        user_pk=user_pk,
        controllr_cookie=resultado_login.cookie_header,
    )
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
        if sessao.controllr_cookie:
            # Encerra a sessão que o Controllr criou no momento do /login
            # (mesmo endpoint usado pelo painel administrativo: POST
            # /session/logout, sem corpo, com o cookie da sessão a encerrar).
            # Exige o COOKIE dessa sessão específica — o Basic Auth usado nas
            # demais chamadas deste backend não cria sessão no Controllr, então
            # não há nada para encerrar por esse caminho. Best-effort: uma
            # falha aqui não impede o logout local, que apaga a sessão deste
            # backend e o cookie do navegador — mas fica logada, porque uma
            # falha silenciosa aqui já causou uma vez a sessão continuar
            # "ativa" no Controllr até o lease dele expirar sozinho, mesmo
            # com o técnico já deslogado do app (ver CONTROLLR_API_NOTES.md,
            # seção 8.5).
            try:
                timeout = ClientTimeout(10)
                async with ClientSession() as http:
                    async with http.post(
                        f"{CONTROLLR_URL}/session/logout",
                        headers={"Cookie": sessao.controllr_cookie},
                        timeout=timeout,
                    ) as resposta_controllr:
                        if resposta_controllr.status >= 400:
                            logger.warning(
                                "Falha ao encerrar sessão do técnico %s no Controllr: HTTP %s",
                                sessao.username,
                                resposta_controllr.status,
                            )
            except Exception:
                logger.exception("Erro ao chamar /session/logout no Controllr para %s", sessao.username)
        else:
            # Sem cookie guardado, não há como encerrar a sessão do
            # Controllr — a sessão local ainda é apagada abaixo, mas essa
            # sessão específica no Controllr só vai cair pelo lease dele.
            logger.warning("Logout de %s sem controllr_cookie salvo — sessão pode ficar ativa no Controllr", sessao.username)

    delete_session(tecsession)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"success": True}


@router.get("/me", response_model=TecnicoDto)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> TecnicoDto:
    return TecnicoDto(username=ctx.session.username, user_pk=ctx.session.user_pk)
