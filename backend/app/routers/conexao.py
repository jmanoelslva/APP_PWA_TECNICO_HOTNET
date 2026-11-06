from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from .. import contexto_auditoria as contexto
from ..audit import registrar_auditoria
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_GTE, OPER_ILIKE, OPER_IN, OPER_IS_NOT, OPER_LTE, corpo, where_and, where_eq

router = APIRouter(prefix="/cpe", tags=["conexao"])


@router.get("/offline")
async def listar_cpe_offline(
    start: int = Query(default=0, ge=0),
    # Até 500 por página: a tela carrega a lista inteira para agrupar por
    # tempo offline e por CTO; páginas grandes terminam em 1 ou 2 idas.
    limit: int = Query(default=20, ge=1, le=500),
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
    dp_pk: int | None = Query(default=None, description="CTO — conexões cadastradas nela (portas ocupadas)"),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not client_pk and not contract_pk and not cpe_pk and not username and not dp_pk:
        raise HTTPException(status_code=400, detail="Informe client_pk, contract_pk, cpe_pk, username ou dp_pk.")

    # "aaa_cpe.client_pk"/"aaa_cpe.contract_pk" — nome real da tabela é
    # "aaa_cpe", não "cpe". "contract_pk"/"client_pk" sem prefixo são
    # ambíguos em /aaa_ctl/cpe/list (colidem com a tabela de contrato) e
    # não filtram de verdade sem o prefixo; cpe_pk é coluna própria, sem
    # ambiguidade. username usa ILIKE com "%termo%" (busca parcial) em
    # vez de EQUAL.
    if cpe_pk:
        where = where_eq("cpe_pk", cpe_pk)
        resposta = await ctx.controllr.cpe_list(corpo(where, limit=20), model_return=True, model_extended=True)
    elif dp_pk:
        # "aaa_cpe.dp_pk": "dp_pk" sem prefixo é ambíguo (erro 42702, a
        # tabela da CTO entra no join) — confirmado ao vivo em 06/11.
        where = where_eq("aaa_cpe.dp_pk", dp_pk)
        resposta = await ctx.controllr.cpe_list(
            corpo(where, limit=200, sort="cpe_dp_port", dir="ASC"), model_return=True, model_extended=True
        )
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
    # total = sessões no período inteiro (não só nesta página) — confirmado
    # ao vivo em 06/11 com limit=1.
    return {"success": True, "results": resposta.results, "total": resposta.total}


class ContextoAuditoriaCpe(BaseModel):
    """Como a conexão estava na tela antes de salvar — só vai para a
    auditoria, nunca para o Controllr. Senhas do Wi-Fi e de acesso ao
    roteador: gravadas (anterior e nova), por decisão do usuário em 06/11 —
    os técnicos já as veem no app."""

    cliente: str | None = Field(default=None, max_length=128)
    pppoe: str | None = Field(default=None, max_length=64)
    wifi_tipo_anterior: int | None = None
    senha_wifi_alterada: bool | None = None
    senha_wifi_anterior: str | None = Field(default=None, max_length=128)
    login_anterior: str | None = Field(default=None, max_length=64)
    porta_anterior: int | None = None
    senha_acesso_alterada: bool | None = None
    senha_acesso_anterior: str | None = Field(default=None, max_length=128)


def _alvo_cpe(cpe_pk: int, contexto: ContextoAuditoriaCpe | None, **depois: Any) -> dict[str, Any]:
    alvo = {"cpe_pk": cpe_pk, **(contexto.model_dump() if contexto else {}), **depois}
    return {k: v for k, v in alvo.items() if v not in (None, "")}


CAMPOS_CTO = {"dp_name": "CTO", "cpe_dp_port": "Porta da CTO", "cpe_obs": "Observação"}


def _alteracoes_cpe(antes: dict[str, Any] | None, enviado: dict[str, Any]) -> list[dict[str, Any]]:
    """Antes → depois de CTO, porta e observação. Observação apagada aparece
    como "(vazia)". Sem o "antes" (Controllr não respondeu), só o novo valor."""
    depois = {k: v for k, v in enviado.items() if v is not None}
    if antes:
        lista = contexto.alteracoes(antes, depois, CAMPOS_CTO)
    else:
        lista = [{"rotulo": CAMPOS_CTO[k], "depois": v} for k, v in depois.items()]
    return [{**item, "depois": item["depois"] if item["depois"] != "" else "(vazia)"} for item in lista]


class WifiCpePayload(BaseModel):
    wifi_encryption_type: int | None = None
    wifi_encryption_password: str | None = None
    auditoria: ContextoAuditoriaCpe | None = None


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
    # Senha anterior (vem da tela) e nova no registro. Salvar de novo sem
    # mudar tipo nem senha não vira registro.
    a = payload.auditoria
    sem_mudanca = (
        a is not None
        and a.senha_wifi_alterada is False
        and payload.wifi_encryption_type == a.wifi_tipo_anterior
    )
    if not sem_mudanca:
        registrar_auditoria(request, ctx.session, "cpe.editar_wifi",
                            _alvo_cpe(cpe_pk, a, wifi_tipo=payload.wifi_encryption_type,
                                      wifi_senha=payload.wifi_encryption_password))
    return {"success": True, "results": resposta.results}


def _acesso_sem_mudanca(payload: "CpeDetalhesPayload") -> bool:
    """Login, porta e senha iguais ao que a tela tinha: salvar de novo não
    vira registro. Sem o contexto da tela, não dá para saber: registra."""
    a = payload.auditoria
    if a is None or a.senha_acesso_alterada is not False:
        return False
    return (payload.cpe_access_login or "") == (a.login_anterior or "") and payload.cpe_access_port == a.porta_anterior


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
    auditoria: ContextoAuditoriaCpe | None = None


@router.put("/{cpe_pk}/detalhes")
async def atualizar_detalhes_cpe(
    cpe_pk: int, payload: CpeDetalhesPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    campos: dict[str, Any] = {"cpe_pk": cpe_pk, **payload.model_dump(exclude_none=True, exclude={"auditoria"})}
    muda_cto = payload.dp_pk is not None or payload.cpe_dp_port is not None
    muda_obs = payload.cpe_obs is not None
    # CTO e observação: o "antes" vem do Controllr (a tela não manda contexto).
    antes = await contexto.cpe(ctx, cpe_pk) if muda_cto or muda_obs else None
    resposta = await ctx.controllr.cpe_update(urlencode(campos))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o CPE.", resposta))
    if muda_cto or muda_obs:
        # Relê para ter o nome da CTO nova; sem resposta, fica o que foi enviado.
        depois = await contexto.cpe(ctx, cpe_pk) or {}
        enviado = {
            "dp_name": depois.get("dp_name") or payload.dp_pk,
            "cpe_dp_port": payload.cpe_dp_port,
            "cpe_obs": payload.cpe_obs,
        }
        if payload.dp_pk is None:
            enviado.pop("dp_name")
        base = antes or depois
        lista = _alteracoes_cpe(antes, enviado)
        # Salvar de novo sem mudar nada (visto ao vivo em 06/11: "Salvar CTO"
        # tocado duas vezes) não é alteração: sem registro. Sem o "antes" não
        # dá para saber, então registra.
        if lista or not antes:
            registrar_auditoria(request, ctx.session, "cpe.editar_cto" if muda_cto else "cpe.editar_observacao", {
                k: v for k, v in {
                    "cpe_pk": cpe_pk,
                    "cliente": base.get("client_complete_name") or (payload.auditoria.cliente if payload.auditoria else None),
                    "pppoe": base.get("cpe_username") or (payload.auditoria.pppoe if payload.auditoria else None),
                    "alteracoes": lista,
                }.items() if v not in (None, "", [])
            })
    if (
        payload.cpe_access_login is not None or payload.cpe_access_password is not None or payload.cpe_access_port is not None
    ) and not _acesso_sem_mudanca(payload):
        registrar_auditoria(
            request,
            ctx.session,
            "cpe.editar_acesso_roteador",
            _alvo_cpe(cpe_pk, payload.auditoria,
                      cpe_access_login=payload.cpe_access_login, cpe_access_port=payload.cpe_access_port,
                      cpe_access_password=payload.cpe_access_password),
        )
    return {"success": True, "results": resposta.results}
