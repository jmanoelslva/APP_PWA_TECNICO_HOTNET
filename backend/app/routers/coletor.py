"""Histórico da ONU vindo do Coletor de OLTs (projeto COLETA-OLT), opcional.

O Controllr só guarda a leitura atual da ONU; o coletor lê as OLTs direto a
cada 15 minutos e guarda o histórico de sinal, as quedas (motivo, hora e
duração) e os alarmes. A tela da ONU pede aqui pelo serial — igual nos dois
sistemas — e este backend repassa ao coletor, na mesma máquina, com o token de
serviço (COLETOR_SERVICO_TOKEN). Sem o coletor configurado a rota responde 503
e a tela segue só com os dados do Controllr.
"""

from typing import Any

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import COLETOR_SERVICO_TOKEN, COLETOR_URL
from ..deps import AuthContext, get_auth_context

router = APIRouter(prefix="/coletor", tags=["coletor"])

# Consulta é só leitura do banco do coletor; "atualizar" lê a ONU na OLT,
# que pode esperar outros comandos na fila (o coletor desiste em 90 s).
TIMEOUT_CONSULTA_S = 10
TIMEOUT_ATUALIZAR_S = 100


async def _chamar(metodo: str, caminho: str, params: dict[str, Any], timeout_s: int) -> dict[str, Any]:
    if not COLETOR_SERVICO_TOKEN:
        raise HTTPException(status_code=503, detail="Coletor de OLTs não configurado neste servidor.")
    params = {k: v for k, v in params.items() if v is not None}
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout_s)) as http:
            async with http.request(
                metodo, f"{COLETOR_URL}{caminho}", params=params,
                headers={"X-Servico-Token": COLETOR_SERVICO_TOKEN},
            ) as resp:
                corpo = await resp.json(content_type=None)
                if resp.status >= 400:
                    detalhe = corpo.get("detail") if isinstance(corpo, dict) else None
                    # 404 = ONU fora das OLTs coletadas: a tela mostra "sem histórico".
                    raise HTTPException(status_code=resp.status if resp.status in (400, 404, 409, 504) else 502,
                                        detail=detalhe or "O coletor de OLTs respondeu erro.")
                return corpo
    except (aiohttp.ClientError, TimeoutError):
        raise HTTPException(status_code=503, detail="O coletor de OLTs não respondeu. Tente de novo em instantes.")


@router.get("/onu")
async def historico_onu(
    sn: str | None = Query(default=None, description="Serial da ONU, como no Controllr"),
    olt: str | None = Query(default=None, description="Sem serial: nome da OLT (olt_name do Controllr)"),
    porta: int | None = Query(default=None),
    onu_id: int | None = Query(default=None),
    horas: int = Query(default=72, ge=1, le=24 * 90),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """Sinais (RX/TX da ONU e RX na OLT), quedas com motivo e hora, alarmes e situação da PON."""
    return await _chamar("GET", "/api/integracao/onu",
                         {"sn": sn, "olt": olt, "porta": porta, "onu_id": onu_id, "horas": horas},
                         TIMEOUT_CONSULTA_S)


@router.post("/onu/atualizar")
async def atualizar_onu(
    sn: str | None = Query(default=None),
    olt: str | None = Query(default=None),
    porta: int | None = Query(default=None),
    onu_id: int | None = Query(default=None),
    horas: int = Query(default=72, ge=1, le=24 * 90),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """Lê só esta ONU na OLT agora (sem reconectar a OLT) e devolve o histórico atualizado."""
    return await _chamar("POST", "/api/integracao/onu/atualizar",
                         {"sn": sn, "olt": olt, "porta": porta, "onu_id": onu_id, "horas": horas},
                         TIMEOUT_ATUALIZAR_S)
