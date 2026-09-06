import asyncio
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/onu", tags=["onu"])

# Tempos de espera confirmados num script de monitoramento já em uso
# interno na empresa (bot Telegram): a OLT precisa desse intervalo pra
# de fato recarregar antes que reler a ONU traga dado novo — pedir os
# dados imediatamente depois do reconnect ainda devolveria o valor
# antigo. Ajustar o `deploy/nginx.conf.example`/`apache-vhost.conf.example`
# (proxy_read_timeout/ProxyTimeout) se esses valores mudarem, senão o
# reverse proxy pode cortar a requisição antes do backend responder.
ESPERA_APOS_RECONECTAR_OLT_S = 15
ESPERA_APOS_ATUALIZAR_ONU_S = 30


def _corpo_busca_wizard(search_term: str, search_value: str, sort: str) -> str:
    """
    Formato "wizard" confirmado tanto num script de monitoramento já em
    produção na empresa (busca por "onu_serial") quanto capturando a
    própria tela de fibra do painel Controllr no DevTools (busca por
    "onu_wancfg_pppoe_username", sort "onu_pk") — bem mais confiável que
    filtrar /fiber_ctl/onu/list por "cpe_pk" no "where": esse campo é
    ambíguo (o endpoint também traz client_pk/contract_number via join)
    e o Controllr parece simplesmente ignorar o filtro quebrado,
    devolvendo a ONU de QUALQUER cliente em vez de vazio ou erro.
    """
    campos = {
        "olt_pk": 0,
        "dp_pk": -1,
        "search_term": search_term,
        "search_value": search_value,
        "frame_id": -1,
        "slot_id": -1,
        "port_id": -1,
        "onu_id": -1,
        "duplicate_serial": -1,
        "signal_min_limit": 128,
        "signal_max_limit": 128,
        "page": 1,
        "start": 0,
        "limit": 15,
        "sort": sort,
        "dir": "ASC",
    }
    return urlencode(campos)


@router.get("/busca")
async def buscar_onu(
    serial: str | None = Query(default=None, description="Serial da ONU, impresso no equipamento"),
    username: str | None = Query(default=None, description="Usuário PPPoE do CPE do cliente — jeito confiável de achar a ONU dele"),
    cpe_pk: int | None = Query(default=None),
    olt_pk: int | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not serial and not username and not cpe_pk and not olt_pk:
        raise HTTPException(status_code=400, detail="Informe serial, username, cpe_pk ou olt_pk.")

    if serial:
        corpo_requisicao = _corpo_busca_wizard("onu_serial", serial.strip().upper(), sort="onu_ponid")
    elif username:
        corpo_requisicao = _corpo_busca_wizard("onu_wancfg_pppoe_username", username.strip(), sort="onu_pk")
    else:
        # "cpe_pk" puro é ambíguo aqui (ver docstring acima) — mantido só
        # como opção de baixo nível; prefira "username" pra achar a ONU
        # de um cliente específico. Filtro client-side de segurança
        # abaixo garante nunca devolver a ONU de outro cpe_pk mesmo que
        # esse "where" seja ignorado.
        campo, valor = ("olt_pk", olt_pk) if not cpe_pk else ("cpe_pk", cpe_pk)
        corpo_requisicao = corpo(where_eq(campo, valor), limit=20)

    resposta = await ctx.controllr.onu_list(corpo_requisicao, model_return=True, model_extended=True)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível consultar a ONU.", resposta))

    resultados = resposta.results
    if cpe_pk is not None:
        resultados = [onu for onu in resultados if onu.cpe_pk == cpe_pk]

    return {"success": True, "results": [onu.model_dump(mode="json") for onu in resultados]}


@router.post("/{onu_pk}/atualizar")
async def atualizar_info_onu(
    onu_pk: int,
    olt_pk: int = Query(...),
    onu_serial: str = Query(...),
    slot_id: int = Query(...),
    port_id: int = Query(...),
    onu_id: int = Query(...),
    frame_id: int = Query(default=1),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    # Reconecta a OLT antes de atualizar — confirmado pelo time de rede:
    # isso só força o sistema a reler a OLT (não derruba as ONUs
    # conectadas), e é o que garante que a atualização abaixo traga o
    # dado mais recente de verdade, não um valor em cache. Mesmo fluxo e
    # tempos de espera do script de monitoramento já usado internamente
    # (reconectar → aguardar a OLT recarregar → atualizar a ONU →
    # aguardar refletir → devolver os dados novos pro chamador reler).
    await ctx.controllr.call_api_post("/fiber_ctl/olt/reconnect", urlencode({"olt_pk": olt_pk}))
    await asyncio.sleep(ESPERA_APOS_RECONECTAR_OLT_S)

    resposta = await ctx.controllr.onu_update_info(
        olt_pk=olt_pk, onu_serial=onu_serial, slot_id=slot_id, port_id=port_id, onu_id=onu_id, frame_id=frame_id
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar a ONU.", resposta))

    await asyncio.sleep(ESPERA_APOS_ATUALIZAR_ONU_S)
    return {"success": True, "results": resposta.results}
