from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/cpe", tags=["conexao"])


@router.get("/busca")
async def buscar_cpe(
    client_pk: int | None = Query(default=None),
    contract_pk: int | None = Query(default=None),
    cpe_pk: int | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not client_pk and not contract_pk and not cpe_pk:
        raise HTTPException(status_code=400, detail="Informe client_pk, contract_pk ou cpe_pk.")

    # "aaa_cpe.client_pk" — nome real da tabela é "aaa_cpe", não "cpe"
    # (confirmado no app cliente de referência, que filtra
    # aaa_ctl/connection/session por "aaa_cpe.cpe_pk"). cpe_pk/contract_pk
    # não têm esse problema (colunas próprias, sem ambiguidade de join).
    campo, valor = (
        ("cpe_pk", cpe_pk) if cpe_pk else ("contract_pk", contract_pk) if contract_pk else ("aaa_cpe.client_pk", client_pk)
    )
    resposta = await ctx.controllr.cpe_list(corpo(where_eq(campo, valor), limit=20), model_return=True, model_extended=True)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível buscar os CPEs.", resposta))
    return {"success": True, "results": [cpe.model_dump(mode="json") for cpe in resposta.results]}


@router.get("/{cpe_pk}/sessao")
async def sessao_online_cpe(cpe_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    resposta = await ctx.controllr.session_online_list_wizard(search_term="cpe_pk", search_value=str(cpe_pk))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível consultar a sessão online.", resposta))
    return {"success": True, "results": resposta.results}


class WifiCpePayload(BaseModel):
    wifi_encryption_type: int | None = None
    wifi_encryption_password: str | None = None


@router.put("/{cpe_pk}/wifi")
async def atualizar_wifi_cpe(
    cpe_pk: int, payload: WifiCpePayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    # cpe_wifi_encryption_type/cpe_wifi_encryption_password — confirmado na
    # doc oficial (apidoc.brbyte.com/#post-/aaa_ctl/cpe/update). Não há
    # enum documentado pro "type" (a doc só diz que é number), então o
    # técnico edita o valor cru mesmo, sem tradução inventada por nós.
    campos: dict[str, Any] = {"cpe_pk": cpe_pk}
    if payload.wifi_encryption_type is not None:
        campos["cpe_wifi_encryption_type"] = payload.wifi_encryption_type
    if payload.wifi_encryption_password is not None:
        campos["cpe_wifi_encryption_password"] = payload.wifi_encryption_password
    resposta = await ctx.controllr.cpe_update(urlencode(campos))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o Wi-Fi.", resposta))
    return {"success": True, "results": resposta.results}


class CpeDetalhesPayload(BaseModel):
    # Todos confirmados como campos de verdade em /aaa_ctl/cpe/update na
    # doc oficial. None aqui significa "não mexe nesse campo" — pra
    # limpar um valor (ex: observação), o front manda string vazia, não
    # None (mesmo padrão já usado em EnderecoPayload).
    cpe_obs: str | None = None
    dp_pk: int | None = None
    cpe_dp_port: int | None = None
    cpe_access_login: str | None = None
    cpe_access_password: str | None = None
    cpe_access_port: int | None = None


@router.put("/{cpe_pk}/detalhes")
async def atualizar_detalhes_cpe(
    cpe_pk: int, payload: CpeDetalhesPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    campos: dict[str, Any] = {"cpe_pk": cpe_pk, **payload.model_dump(exclude_none=True)}
    resposta = await ctx.controllr.cpe_update(urlencode(campos))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o CPE.", resposta))
    return {"success": True, "results": resposta.results}
