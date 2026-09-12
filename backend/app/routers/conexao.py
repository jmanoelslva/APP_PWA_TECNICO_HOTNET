from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ..audit import registrar_auditoria
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_GTE, OPER_ILIKE, OPER_IN, OPER_IS_NOT, OPER_LTE, corpo, where_and, where_eq

router = APIRouter(prefix="/cpe", tags=["conexao"])


@router.get("/offline")
async def listar_cpe_offline(
    start: int = Query(default=0),
    limit: int = Query(default=20, le=100),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """
    Lista clientes com contrato ativo (contract_status IN [1], ver seção
    6 de CONTROLLR_API_NOTES.md), CPE habilitado (cpe_status = 1) e sem
    sessão RADIUS ativa (cpe_sessions = 0).
    """
    where = where_and(
        {"field": "contract_status", "oper": OPER_IN, "value": [1]},
        {"field": "cpe_status", "oper": OPER_EQ, "value": 1},
        {"field": "cpe_sessions", "oper": OPER_EQ, "value": 0},
    )
    resposta = await ctx.controllr.cpe_list(
        corpo(where, start=start, limit=limit, sort="cpe_username", dir="ASC"),
        model_return=True,
        model_extended=True,
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar os clientes offline.", resposta))
    return {"success": True, "results": [cpe.model_dump(mode="json") for cpe in resposta.results], "total": resposta.total}


@router.get("/busca")
async def buscar_cpe(
    client_pk: int | None = Query(default=None),
    contract_pk: int | None = Query(default=None),
    cpe_pk: int | None = Query(default=None),
    username: str | None = Query(default=None, description="Usuário PPPoE do CPE — mesma busca que sai da tela do cliente"),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not client_pk and not contract_pk and not cpe_pk and not username:
        raise HTTPException(status_code=400, detail="Informe client_pk, contract_pk, cpe_pk ou username.")

    # "aaa_cpe.client_pk"/"aaa_cpe.contract_pk" — nome real da tabela é
    # "aaa_cpe", não "cpe". "contract_pk"/"client_pk" sem prefixo são
    # ambíguos em /aaa_ctl/cpe/list (colidem com a tabela de contrato) e
    # não filtram de verdade sem o prefixo; cpe_pk é coluna própria, sem
    # ambiguidade. username usa ILIKE com "%termo%" (busca parcial) em
    # vez de EQUAL.
    if cpe_pk:
        where = where_eq("cpe_pk", cpe_pk)
        resposta = await ctx.controllr.cpe_list(corpo(where, limit=20), model_return=True, model_extended=True)
    elif contract_pk:
        where = where_eq("aaa_cpe.contract_pk", contract_pk)
        resposta = await ctx.controllr.cpe_list(corpo(where, limit=20), model_return=True, model_extended=True)
    elif username:
        # client_status=0 = ativo — sem esse filtro, a busca por usuário
        # PPPoE traz conexões de clientes desabilitados junto com as
        # habilitadas.
        where = where_and(
            {"field": "client_status", "oper": OPER_EQ, "value": 0},
            {"field": "cpe_username", "oper": OPER_ILIKE, "value": f"%{username.strip()}%"},
        )
        resposta = await ctx.controllr.cpe_list(
            corpo(where, page=1, start=0, limit=15, sort="cpe_username", dir="ASC"),
            model_return=True,
            model_extended=True,
        )
    else:
        where = where_eq("aaa_cpe.client_pk", client_pk)
        resposta = await ctx.controllr.cpe_list(corpo(where, limit=20), model_return=True, model_extended=True)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível buscar os CPEs.", resposta))
    return {"success": True, "results": [cpe.model_dump(mode="json") for cpe in resposta.results]}


@router.get("/{cpe_pk}/sessao")
async def sessao_online_cpe(cpe_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    resposta = await ctx.controllr.session_online_list_wizard(search_term="cpe_pk", search_value=str(cpe_pk))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível consultar a sessão online.", resposta))
    return {"success": True, "results": resposta.results}


# /aaa_ctl/session_history/list — sem doc oficial. O where é cpe_pk (=)
# AND session_username (ILIKE, opcional) AND um grupo aninhado
# [session_date_close >=, AND, session_date_close <=] para o período. Sem
# período (data_inicio/data_fim ausentes), usa session_date_close IS NOT
# NULL, sem faixa (equivalente ao preset "Desde o Início" do painel).
@router.get("/{cpe_pk}/historico-sessoes")
async def historico_sessoes_cpe(
    cpe_pk: int,
    username: str | None = Query(default=None, description="Filtra pelo usuário PPPoE (contém, mesmo comportamento do painel)"),
    data_inicio: str | None = Query(default=None, description="'YYYY-MM-DD HH:MM:SS' — início do período (inclusive)"),
    data_fim: str | None = Query(default=None, description="'YYYY-MM-DD HH:MM:SS' — fim do período (inclusive)"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=15, ge=1, le=100),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    condicoes: list[Any] = [{"field": "cpe_pk", "oper": OPER_EQ, "value": cpe_pk}]
    if username:
        condicoes.append({"field": "session_username", "oper": OPER_ILIKE, "value": f"%{username.strip()}%"})
    if data_inicio and data_fim:
        condicoes.append(
            [
                {"field": "session_date_close", "oper": OPER_GTE, "value": data_inicio},
                {"field": "AND"},
                {"field": "session_date_close", "oper": OPER_LTE, "value": data_fim},
            ]
        )
    else:
        condicoes.append({"field": "session_date_close", "oper": OPER_IS_NOT, "value": None})

    resposta = await ctx.controllr.call_api_post(
        "/aaa_ctl/session_history/list",
        corpo(
            where_and(*condicoes),
            start=(page - 1) * limit,
            limit=limit,
            page=page,
            sort="session_date_close",
            dir="DESC",
        ),
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível consultar o histórico de conexão.", resposta))
    return {"success": True, "results": resposta.results}


class WifiCpePayload(BaseModel):
    wifi_encryption_type: int | None = None
    wifi_encryption_password: str | None = None


@router.put("/{cpe_pk}/wifi")
async def atualizar_wifi_cpe(
    cpe_pk: int, payload: WifiCpePayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    # cpe_wifi_encryption_type/cpe_wifi_encryption_password, doc oficial
    # em apidoc.brbyte.com/#post-/aaa_ctl/cpe/update. Sem enum documentado
    # para "type" (a doc só diz que é number) — o valor é editado cru,
    # sem tradução para nome de protocolo.
    campos: dict[str, Any] = {"cpe_pk": cpe_pk}
    if payload.wifi_encryption_type is not None:
        campos["cpe_wifi_encryption_type"] = payload.wifi_encryption_type
    if payload.wifi_encryption_password is not None:
        campos["cpe_wifi_encryption_password"] = payload.wifi_encryption_password
    resposta = await ctx.controllr.cpe_update(urlencode(campos))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o Wi-Fi.", resposta))
    # Sem a senha em si no log — só o registro de que foi alterada.
    registrar_auditoria(request, ctx.session, "cpe.editar_wifi", {"cpe_pk": cpe_pk})
    return {"success": True, "results": resposta.results}


class CpeDetalhesPayload(BaseModel):
    # Campos de /aaa_ctl/cpe/update. None aqui significa "não mexe nesse
    # campo" — para limpar um valor (ex: observação), o front manda
    # string vazia, não None (mesmo padrão de EnderecoPayload).
    cpe_obs: str | None = None
    dp_pk: int | None = None
    cpe_dp_port: int | None = None
    cpe_access_login: str | None = None
    cpe_access_password: str | None = None
    cpe_access_port: int | None = None


@router.put("/{cpe_pk}/detalhes")
async def atualizar_detalhes_cpe(
    cpe_pk: int, payload: CpeDetalhesPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    campos: dict[str, Any] = {"cpe_pk": cpe_pk, **payload.model_dump(exclude_none=True)}
    resposta = await ctx.controllr.cpe_update(urlencode(campos))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o CPE.", resposta))
    # Só grava auditoria quando a credencial de acesso ao roteador muda —
    # editar CTO/observação não é uma ação sensível o bastante pra entrar
    # no mesmo log (senão fica ruído demais pra achar o que importa).
    if payload.cpe_access_login is not None or payload.cpe_access_password is not None or payload.cpe_access_port is not None:
        registrar_auditoria(
            request,
            ctx.session,
            "cpe.editar_acesso_roteador",
            {"cpe_pk": cpe_pk, "cpe_access_login": payload.cpe_access_login, "cpe_access_port": payload.cpe_access_port},
        )
    return {"success": True, "results": resposta.results}
