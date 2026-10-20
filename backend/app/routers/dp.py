from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import corpo, where_eq

router = APIRouter(prefix="/dp", tags=["dp"])


@router.get("/lista")
async def listar_dps(ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    # CTOs (Distribution Points) cadastradas no sistema, para selecionar na
    # tela de detalhes do CPE (campo dp_pk) — só as ativas (dp_status=1).
    #
    # NÃO usa model_return=True aqui: Response.cast() faz
    # `[DP.model_validate(r) for r in results]` numa lista só — se UMA
    # CTO qualquer não tiver dp_lat/dp_lng/dp_limit (campos obrigatórios
    # no modelo DP, mas nem toda CTO cadastrada tem coordenada), a
    # validação de TODA a lista falha e a lista inteira vem vazia para o
    # técnico, sem erro visível (o front só ignora a falha do combo).
    # Como só precisamos de pk/nome (+ coordenada, quando existir), pega o
    # dado cru e não passa pelo modelo rígido.
    #
    # cor/limite/ativos/setor alimentam o mapa do bloco CTO (mesmos campos
    # que o "Mapa - Informações" do painel mostra com Distribuição: Sim).
    resposta = await ctx.controllr.dp_list(
        corpo(where_eq("dp_status", 1), limit=2000, sort="dp_name", dir="ASC")
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as CTOs.", resposta))
    resultado = [
        {
            "pk": dp.get("dp_pk"),
            "name": dp.get("dp_name") or dp.get("dp_id") or f"CTO {dp.get('dp_pk')}",
            "lat": _coordenada(dp.get("dp_lat")),
            "lng": _coordenada(dp.get("dp_lng")),
            "cor": dp.get("dp_color") or None,
            "limite": _inteiro(dp.get("dp_limit")),
            "ativos": _inteiro(dp.get("total_cpe_active")),
            "setor": dp.get("ds_name") or None,
        }
        for dp in resposta.results
        if dp.get("dp_pk") is not None
    ]
    return {"success": True, "results": resultado}


def _coordenada(valor: Any) -> float | None:
    # dp_lat/dp_lng nem sempre existem (CTO sem coordenada cadastrada) —
    # devolve None nesse caso em vez de deixar o handler quebrar.
    # O painel trata "0"/"0" como "sem coordenada" (app_map_view.js).
    try:
        numero = float(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None
    return numero if numero else None


def _inteiro(valor: Any) -> int | None:
    try:
        return int(valor) if valor is not None else None
    except (TypeError, ValueError):
        return None
