from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro

router = APIRouter(tags=["enderecos"])


class EnderecoPayload(BaseModel):
    # client_pk, address_zipcode, address_siafi, address e address_default
    # são obrigatórios pra criar/atualizar no Controllr de verdade
    # (confirmado na doc oficial, apidoc.brbyte.com/#post-/controllrctl/addresses/update
    # e /create) — sem "address_siafi" especificamente a chamada falha;
    # como o técnico normalmente está EDITANDO um endereço já existente,
    # o frontend deve sempre reenviar o valor já carregado (não editável
    # na tela), não pedir isso de novo pro técnico.
    client_pk: int | None = None
    address: str | None = None
    address_number: str | None = None
    address_neighborhood: str | None = None
    address_zipcode: str | None = None
    address_province: str | None = None
    address_state: str | None = None
    address_siafi: int | None = None
    address_default: int | None = None
    address_completation: str | None = None
    address_identification: str | None = None


def _corpo(payload: EnderecoPayload, extras: dict[str, Any] | None = None) -> str:
    campos = {k: v for k, v in payload.model_dump().items() if v is not None}
    if extras:
        campos.update(extras)
    return urlencode(campos)


@router.post("/enderecos")
async def criar_endereco(payload: EnderecoPayload, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    resposta = await ctx.controllr.address_create(_corpo(payload))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível criar o endereço.", resposta))
    return {"success": True, "results": resposta.results}


@router.put("/enderecos/{address_pk}")
async def atualizar_endereco(
    address_pk: int, payload: EnderecoPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    resposta = await ctx.controllr.address_update(_corpo(payload, {"address_pk": address_pk}))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o endereço.", resposta))
    return {"success": True, "results": resposta.results}


@router.delete("/enderecos/{address_pk}")
async def excluir_endereco(address_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    resposta = await ctx.controllr.address_delete(address_pk)
    return {"success": resposta.success}


class LocalizacaoPayload(BaseModel):
    address_latitude: str
    address_longitude: str


@router.put("/cpe/{cpe_pk}/localizacao")
async def atualizar_localizacao_cpe(
    cpe_pk: int, payload: LocalizacaoPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    # Campo certo é cpe_latitude/cpe_longitude — confirmado na doc oficial
    # (apidoc.brbyte.com/#post-/aaa_ctl/cpe/update). "address_latitude"/
    # "address_longitude" (usado antes) não existe nesse endpoint — o
    # Controllr provavelmente ignorava o campo desconhecido, então a
    # localização nunca era salva de verdade, sem erro nenhum pra avisar.
    corpo = urlencode({
        "cpe_pk": cpe_pk,
        "cpe_latitude": payload.address_latitude,
        "cpe_longitude": payload.address_longitude,
    })
    resposta = await ctx.controllr.cpe_update(corpo)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar a localização.", resposta))
    return {"success": True, "results": resposta.results}
