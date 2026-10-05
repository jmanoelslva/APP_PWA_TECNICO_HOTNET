from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from .. import contexto_auditoria as contexto
from ..audit import registrar_auditoria
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro

router = APIRouter(tags=["enderecos"])


class EnderecoPayload(BaseModel):
    # client_pk, address_zipcode, address_siafi, address e address_default
    # são obrigatórios em /controllrctl/addresses/update e /create (doc
    # oficial); sem "address_siafi" a chamada falha. Ao editar um endereço
    # existente, o frontend reenvia o valor já carregado (campo não
    # editável na tela).
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
    # Localização do endereço em si (diferente de cpe_latitude/
    # cpe_longitude, a localização do equipamento — ver
    # atualizar_localizacao_cpe abaixo). Campos opcionais em
    # /controllrctl/addresses/update.
    address_latitude: str | None = None
    address_longitude: str | None = None


def _corpo(payload: EnderecoPayload, extras: dict[str, Any] | None = None) -> str:
    campos = {k: v for k, v in payload.model_dump().items() if v is not None}
    if extras:
        campos.update(extras)
    return urlencode(campos)


def _sem_vazios(alvo: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in alvo.items() if v not in (None, "", [])}


@router.post("/enderecos")
async def criar_endereco(
    payload: EnderecoPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    resposta = await ctx.controllr.address_create(_corpo(payload))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível criar o endereço.", resposta))
    registrar_auditoria(request, ctx.session, "endereco.criar", _sem_vazios({
        "client_pk": payload.client_pk,
        "cliente": await contexto.nome_cliente(ctx, payload.client_pk),
        "endereco": contexto.texto_endereco(payload.model_dump()),
    }))
    return {"success": True, "results": resposta.results}


@router.put("/enderecos/{address_pk}")
async def atualizar_endereco(
    address_pk: int, payload: EnderecoPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    # Como estava, lido no Controllr antes de gravar (para o antes → depois).
    antes = await contexto.endereco(ctx, address_pk)
    resposta = await ctx.controllr.address_update(_corpo(payload, {"address_pk": address_pk}))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar o endereço.", resposta))
    depois = payload.model_dump()
    mudou = contexto.alteracoes(antes, depois, contexto.CAMPOS_ENDERECO)
    local_antes = contexto.localizacao((antes or {}).get("address_latitude"), (antes or {}).get("address_longitude"))
    local_depois = contexto.localizacao(payload.address_latitude, payload.address_longitude)
    if antes and local_depois and local_depois != local_antes:
        mudou.append({"rotulo": "Localização", "depois": local_depois, **({"antes": local_antes} if local_antes else {})})
    client_pk = payload.client_pk or (antes or {}).get("client_pk")
    registrar_auditoria(request, ctx.session, "endereco.editar", _sem_vazios({
        "client_pk": client_pk,
        "cliente": await contexto.nome_cliente(ctx, client_pk),
        "address_pk": address_pk,
        "endereco": contexto.texto_endereco({**(antes or {}), **{k: v for k, v in depois.items() if v is not None}}),
        "alteracoes": mudou,
    }))
    return {"success": True, "results": resposta.results}


@router.delete("/enderecos/{address_pk}")
async def excluir_endereco(
    address_pk: int, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    antes = await contexto.endereco(ctx, address_pk)
    resposta = await ctx.controllr.address_delete(address_pk)
    # Antes respondia 200 com success=false — a tela podia dizer "excluído"
    # sem ter excluído. Agora falha como as outras rotas.
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível excluir o endereço.", resposta))
    client_pk = (antes or {}).get("client_pk")
    registrar_auditoria(request, ctx.session, "endereco.excluir", _sem_vazios({
        "client_pk": client_pk,
        "cliente": await contexto.nome_cliente(ctx, client_pk),
        "address_pk": address_pk,
        "endereco": contexto.texto_endereco(antes),
    }))
    return {"success": True}


class LocalizacaoPayload(BaseModel):
    address_latitude: str
    address_longitude: str


@router.put("/cpe/{cpe_pk}/localizacao")
async def atualizar_localizacao_cpe(
    cpe_pk: int, payload: LocalizacaoPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    # Campo certo é cpe_latitude/cpe_longitude (apidoc.brbyte.com/#post-
    # /aaa_ctl/cpe/update) — "address_latitude"/"address_longitude" não
    # existe nesse endpoint.
    corpo = urlencode({
        "cpe_pk": cpe_pk,
        "cpe_latitude": payload.address_latitude,
        "cpe_longitude": payload.address_longitude,
    })
    resposta = await ctx.controllr.cpe_update(corpo)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar a localização.", resposta))
    registrar_auditoria(request, ctx.session, "cpe.localizacao", {
        "cpe_pk": cpe_pk,
        "alteracoes": [{"rotulo": "Localização do equipamento",
                        "depois": contexto.localizacao(payload.address_latitude, payload.address_longitude)}],
    })
    return {"success": True, "results": resposta.results}
