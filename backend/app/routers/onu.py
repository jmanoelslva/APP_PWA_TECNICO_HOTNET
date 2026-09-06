from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..where import where_eq

router = APIRouter(prefix="/onu", tags=["onu"])


@router.get("/busca")
async def buscar_onu(
    cpe_pk: int | None = Query(default=None),
    olt_pk: int | None = Query(default=None),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not cpe_pk and not olt_pk:
        raise HTTPException(status_code=400, detail="Informe cpe_pk ou olt_pk.")

    campo, valor = ("cpe_pk", cpe_pk) if cpe_pk else ("olt_pk", olt_pk)
    resposta = await ctx.controllr.onu_list(f"where={where_eq(campo, valor)}&limit=20", model_return=True, model_extended=True)
    if not resposta.success:
        raise HTTPException(status_code=400, detail="Não foi possível consultar a ONU.")
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
    resposta = await ctx.controllr.onu_update_info(
        olt_pk=olt_pk, onu_serial=onu_serial, slot_id=slot_id, port_id=port_id, onu_id=onu_id, frame_id=frame_id
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail="Não foi possível atualizar a ONU.")
    return {"success": True, "results": resposta.results}
