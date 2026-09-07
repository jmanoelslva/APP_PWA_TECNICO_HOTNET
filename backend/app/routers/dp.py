from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/dp", tags=["dp"])


@router.get("/lista")
async def listar_dps(ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    # CTOs (Distribution Points) cadastradas no sistema, pra selecionar na
    # tela de detalhes do CPE (campo dp_pk) — só as ativas (dp_status=1).
    resposta = await ctx.controllr.dp_list(
        corpo(where_eq("dp_status", 1), limit=500, sort="dp_name", dir="ASC"), model_return=True
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as CTOs.", resposta))
    return {"success": True, "results": [{"pk": dp.pk, "name": dp.name} for dp in resposta.results]}
