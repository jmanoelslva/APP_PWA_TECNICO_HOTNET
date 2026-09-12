import asyncio
import base64
from typing import Any

from aiohttp import ClientSession, ClientTimeout
from fastapi import APIRouter, Cookie, Depends, Response
from pydantic import BaseModel

from ..brbyteapi.controllr import AsyncControllr
from ..brbyteapi.controllr.login import ControllrLogin
from ..config import CONTROLLR_URL, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS
from ..deps import AuthContext, get_auth_context
from ..sessions import create_session, delete_session, get_session
from ..where import OPER_EQ, corpo as montar_corpo, where_and

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class TecnicoDto(BaseModel):
    username: str
    user_pk: int | None = None
    financeiro_liberado: bool = False


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


async def _verificar_liberacao_financeiro(controllr: AsyncControllr) -> bool:
    """
    Não existe um campo solto tipo "liberado: true/false" no cadastro do
    técnico (acl_user) para o módulo financeiro — a liberação é decidida
    pelo Controllr por role, permissão a permissão (confirmado ao vivo em
    /web_auth/acl_perm/list: a role "Técnico" tem invoice_invoice.show e
    invoice_observation.show/create com view_act_allow=0, mas a role
    "Técnico Suporte N1" tem tudo =1 — mesmo dado nunca é exposto para uma
    conta comum de técnico, só para quem já tem acesso ao módulo de
    usuários). Em vez de tentar replicar essa lógica de permissões aqui
    (frágil: quebraria se o Controllr mudasse o nome/estrutura dos nodes),
    pergunta pro próprio Controllr da forma mais direta possível: faz uma
    leitura real e inofensiva com o Basic Auth do próprio técnico. Um 403
    "Access Denied" é a mesma resposta já confirmada noutro fluxo deste
    app para uma ação sem liberação de ACL (ver CONTROLLR_API_NOTES.md,
    fechamento de OS).

    IMPORTANTE: a consulta usa `client.client_pk = -1` (nunca existe) em
    vez de ir sem "where" nenhum — todo outro endpoint deste app sempre
    filtra por cliente/contrato/ticket específico, nunca lista a tabela
    inteira; um `invoice_list` sem filtro precisou escanear/juntar tantas
    faturas que passou dos 10s de timeout (confirmado em produção: login
    ficando lento e a liberação sempre caindo em False pela exceção do
    timeout, nunca pelo 403 de verdade). Com um filtro por PK que bate
    índice, a checagem responde na hora tanto pra quem tem liberação
    (resultado vazio) quanto pra quem não tem (403, antes mesmo da
    consulta rodar).
    """
    where = where_and({"field": "client.client_pk", "oper": OPER_EQ, "value": -1})
    try:
        resposta = await controllr.invoice_list(montar_corpo(where, limit=1))
    except Exception:
        return False
    return resposta.status != 403


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response) -> LoginResponse:
    resultado_login = await ControllrLogin.login(CONTROLLR_URL, payload.username, payload.password)
    if not resultado_login.success:
        return LoginResponse(success=False, message="Usuário ou senha incorretos.")

    credenciais = f"{payload.username}:{payload.password}".encode("utf-8")
    basic_auth = "Basic " + base64.b64encode(credenciais).decode("ascii")

    controllr = AsyncControllr(authorization=basic_auth, server_url=CONTROLLR_URL)

    async def _resolver_user_pk() -> int | None:
        try:
            resultado = await controllr.user_list("limit=200")
            if resultado.success:
                return _find_user_pk(resultado.results, payload.username)
        except Exception:
            # Login já foi validado acima; falha aqui só significa que
            # "Minhas OS" vai cair para "Todas" até resolvermos o campo
            # certo do ACL.
            pass
        return None

    # As duas chamadas são independentes entre si — rodar em paralelo evita
    # dobrar a espera do login por causa da checagem extra de financeiro.
    user_pk, financeiro_liberado = await asyncio.gather(
        _resolver_user_pk(), _verificar_liberacao_financeiro(controllr)
    )

    sessao = create_session(
        username=payload.username,
        basic_auth=basic_auth,
        user_pk=user_pk,
        controllr_cookie=resultado_login.cookie_header,
        financeiro_liberado=financeiro_liberado,
    )
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=sessao.session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_SECONDS,
        path="/",
    )
    return LoginResponse(
        success=True,
        tecnico=TecnicoDto(username=payload.username, user_pk=user_pk, financeiro_liberado=financeiro_liberado),
    )


@router.post("/logout")
async def logout(
    response: Response,
    tecsession: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict[str, bool]:
    sessao = get_session(tecsession)
    if sessao is not None and sessao.controllr_cookie:
        # Encerra de verdade a sessão que o Controllr criou no momento do
        # /login (mesmo endpoint usado pelo painel administrativo,
        # confirmado numa captura ao vivo: POST /session/logout, sem
        # corpo, carregando o cookie da sessão a encerrar). Só faz
        # sentido com o COOKIE dessa sessão específica — chamar isso com
        # o Basic Auth do técnico (usado nas outras chamadas deste
        # backend) não derruba nada, porque Basic Auth não cria sessão
        # nenhuma no Controllr para existir algo a encerrar. Best-effort:
        # falhar aqui não pode impedir o logout local, que é o que de
        # fato protege a conta (apaga a sessão deste backend e o cookie
        # do navegador).
        try:
            timeout = ClientTimeout(10)
            async with ClientSession() as http:
                async with http.post(
                    f"{CONTROLLR_URL}/session/logout",
                    headers={"Cookie": sessao.controllr_cookie},
                    timeout=timeout,
                ):
                    pass
        except Exception:
            pass

    delete_session(tecsession)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"success": True}


@router.get("/me", response_model=TecnicoDto)
async def me(ctx: AuthContext = Depends(get_auth_context)) -> TecnicoDto:
    return TecnicoDto(
        username=ctx.session.username,
        user_pk=ctx.session.user_pk,
        financeiro_liberado=ctx.session.financeiro_liberado,
    )
