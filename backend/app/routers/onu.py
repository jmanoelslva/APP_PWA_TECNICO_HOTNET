from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/onu", tags=["onu"])


def _corpo_busca_serial(serial: str) -> str:
    """
    Formato confirmado num script já em produção na empresa (bot de
    Telegram que consulta /fiber_ctl/onu/list com sucesso) — diferente do
    "where" usado nas outras buscas: aqui é uma busca tipo "wizard" por
    search_term/search_value (mesmo estilo do
    session_online_list_wizard), com sentinelas -1 pra "não filtrar" nos
    demais campos e 128 em signal_min_limit/max_limit (também sentinela,
    não é limite de sinal de verdade). Buscar por serial é o modo mais
    prático em campo — o técnico lê o serial impresso no equipamento, não
    tem o cpe_pk/olt_pk de cabeça.
    """
    campos = {
        "olt_pk": 0,
        "dp_pk": -1,
        "search_term": "onu_serial",
        "search_value": serial.strip().upper(),
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
        "sort": "onu_ponid",
        "dir": "ASC",
    }
    return urlencode(campos)


@router.get("/busca")
async def buscar_onu(
    serial: str | None = Query(default=None, description="Serial da ONU, impresso no equipamento"),
    cpe_pk: int | None = Query(default=None),
    olt_pk: int | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not serial and not cpe_pk and not olt_pk:
        raise HTTPException(status_code=400, detail="Informe serial, cpe_pk ou olt_pk.")

    if serial:
        corpo_requisicao = _corpo_busca_serial(serial)
    else:
        campo, valor = ("cpe_pk", cpe_pk) if cpe_pk else ("olt_pk", olt_pk)
        corpo_requisicao = corpo(where_eq(campo, valor), limit=20)

    resposta = await ctx.controllr.onu_list(corpo_requisicao, model_return=True, model_extended=True)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível consultar a ONU.", resposta))
    return {"success": True, "results": [onu.model_dump(mode="json") for onu in resposta.results]}


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
    # Deliberadamente SEM reconectar a OLT antes de atualizar (um script
    # interno da empresa faz isso via /fiber_ctl/olt/reconnect antes de
    # ler a ONU) — reconectar a OLT reinicia a comunicação com TODAS as
    # ONUs conectadas a ela, não só a consultada, o que causaria queda de
    # conexão em outros clientes a cada consulta feita por um técnico em
    # campo. Só o refresh pontual da ONU em si (list_info).
    resposta = await ctx.controllr.onu_update_info(
        olt_pk=olt_pk, onu_serial=onu_serial, slot_id=slot_id, port_id=port_id, onu_id=onu_id, frame_id=frame_id
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível atualizar a ONU.", resposta))
    return {"success": True, "results": resposta.results}
