import asyncio
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/onu", tags=["onu"])

# Tempos de espera confirmados num script de monitoramento já em uso
# interno na empresa (bot Telegram): a OLT precisa desse intervalo para
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
        # como opção de baixo nível; prefira "username" para achar a ONU
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
    # aguardar refletir → devolver os dados novos para o chamador reler).
    await ctx.controllr.call_api_post("/fiber_ctl/olt/reconnect", urlencode({"olt_pk": olt_pk}))
    await asyncio.sleep(ESPERA_APOS_RECONECTAR_OLT_S)

    resposta = await ctx.controllr.onu_update_info(
        olt_pk=olt_pk, onu_serial=onu_serial, slot_id=slot_id, port_id=port_id, onu_id=onu_id, frame_id=frame_id
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar a ONU.", resposta))

    await asyncio.sleep(ESPERA_APOS_ATUALIZAR_ONU_S)
    return {"success": True, "results": resposta.results}


# Endpoints não documentados na doc oficial — achados lendo o handler real
# dos ícones de ação da tela "ONU - Registrado" do painel (Ext.ComponentQuery,
# sem precisar disparar a ação de verdade: os handlers ficam acessíveis como
# funções JS mesmo sem clicar "Sim" na confirmação). Corpo dos dois:
# olt_pk/frame_id/slot_id/port_id/onu_id — mesmos identificadores OSPO já
# usados por onu_update_info acima, sem o serial.
@router.post("/{onu_pk}/reiniciar")
async def reiniciar_onu(
    onu_pk: int,
    olt_pk: int = Query(...),
    slot_id: int = Query(...),
    port_id: int = Query(...),
    onu_id: int = Query(...),
    frame_id: int = Query(default=1),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    resposta = await ctx.controllr.call_api_post(
        "/fiber_ctl/onu/apply_reboot",
        urlencode({"olt_pk": olt_pk, "frame_id": frame_id, "slot_id": slot_id, "port_id": port_id, "onu_id": onu_id}),
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível reiniciar a ONU.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{onu_pk}/remover")
async def remover_onu(
    onu_pk: int,
    olt_pk: int = Query(...),
    slot_id: int = Query(...),
    port_id: int = Query(...),
    onu_id: int = Query(...),
    frame_id: int = Query(default=1),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    resposta = await ctx.controllr.call_api_post(
        "/fiber_ctl/onu/delete",
        urlencode({"olt_pk": olt_pk, "frame_id": frame_id, "slot_id": slot_id, "port_id": port_id, "onu_id": onu_id}),
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível remover a ONU.", resposta))
    return {"success": True, "results": resposta.results}


class AssociarClientePayload(BaseModel):
    client_pk: int
    # O cliente pode ter mais de uma conexão (CPE) cadastrada — o técnico
    # escolhe explicitamente qual usuário PPPoE vincular a esta ONU
    # (pedido explícito: não presumir a primeira automaticamente).
    cpe_pk: int
    olt_pk: int
    slot_id: int
    port_id: int
    onu_id: int
    onu_serial: str
    frame_id: int = 1
    # Config de WAN da própria ONU (Vlan, Cos, Template etc.) — o técnico
    # não edita nada disso aqui, só reenvia o que a tela já tinha carregado
    # (ver OnuDto em api/client.ts): /fiber_ctl/onu/apply_wan também exige
    # o registro completo, confirmado lendo o handler real do botão
    # "Salvar" da tela "Informações" da ONU no painel (mesmo padrão já
    # visto em phone/update). Sem isso, salvar zeraria a config de rede da
    # própria ONU.
    wancfg_conntype: int | None = None
    wan_tpl_pk: int | None = None
    wancfg_vlanid: int | None = None
    wancfg_user_vlanid: int | None = None
    wancfg_cos: int | None = None
    wancfg_tcont: int | None = None
    wancfg_gemport: int | None = None
    wancfg_svlan: int | None = None
    wancfg_stpid: int | None = None
    wancfg_scos: int | None = None
    wancfg_pon_profile: str | None = None
    wancfg_pppoe_svcname: str | None = None
    wancfg_local_ip: str | None = None


@router.post("/{onu_pk}/associar-cliente")
async def associar_cliente_onu(
    onu_pk: int, payload: AssociarClientePayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    # Achado ao vivo na tela "Informações" da ONU do painel (janela aberta
    # pelo ícone "i" da lista "ONU - Registrado", sem documentação
    # oficial): selecionar um Cliente ali carrega as CPEs dele via
    # /aaa_ctl/cpe/list_combo e preenche usuário/senha PPPoE a partir da
    # CPE escolhida — não existe cadastro de PPPoE "solto" aqui, é sempre
    # o acesso que já existe no cadastro do cliente.
    cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("aaa_cpe.cpe_pk", payload.cpe_pk), limit=1))
    cpes = cpes_resp.results if cpes_resp.success else []
    if not cpes:
        raise HTTPException(status_code=404, detail="Conexão (CPE) não encontrada para este cliente.")
    cpe = cpes[0]

    campos = {
        "olt_pk": payload.olt_pk,
        "frame_id": payload.frame_id,
        "slot_id": payload.slot_id,
        "port_id": payload.port_id,
        "onu_id": payload.onu_id,
        "onu_serial": payload.onu_serial,
        "client_pk": payload.client_pk,
        "contract_pk": cpe.get("contract_pk"),
        "cpe_pk": cpe.get("cpe_pk"),
        "onu_wancfg_pppoe_username": cpe.get("cpe_username"),
        "onu_wancfg_pppoe_passwd": cpe.get("cpe_password"),
        "onu_wancfg_pppoe_svcname": payload.wancfg_pppoe_svcname or "",
        "onu_wancfg_conntype": payload.wancfg_conntype,
        "wan_tpl_pk": payload.wan_tpl_pk,
        "onu_wancfg_vlanid": payload.wancfg_vlanid,
        "onu_wancfg_user_vlanid": payload.wancfg_user_vlanid,
        "onu_wancfg_cos": payload.wancfg_cos,
        "onu_wancfg_tcont": payload.wancfg_tcont,
        "onu_wancfg_gemport": payload.wancfg_gemport,
        "onu_wancfg_svlan": payload.wancfg_svlan,
        "onu_wancfg_stpid": payload.wancfg_stpid,
        "onu_wancfg_scos": payload.wancfg_scos,
        "onu_wancfg_pon_profile": payload.wancfg_pon_profile or "",
        "onu_wancfg_local_ip": payload.wancfg_local_ip or "",
    }
    resposta = await ctx.controllr.call_api_post("/fiber_ctl/onu/apply_wan", urlencode(campos))
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível associar a ONU a este cliente.", resposta))
    return {"success": True, "results": resposta.results}
