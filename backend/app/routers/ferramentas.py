"""
Ferramenta "Meu IP" — IP público e geolocalização aproximada da rede em
que o dispositivo do técnico está conectado agora (útil, por exemplo,
para conferir a rede do próprio cliente durante uma visita).

O IP é detectado no servidor (mesma lógica de audit.py::obter_ip_origem,
que já lida com o proxy reverso na frente deste backend) e enviado para
a Geolocation API do ipify (geo.ipify.org) — a chave de API fica só no
servidor (IPIFY_API_KEY em config.py), nunca no app.
"""

from typing import Any

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Request

from ..audit import obter_ip_origem
from ..config import IPIFY_API_KEY
from ..deps import get_current_session
from ..sessions import TechnicianSession

router = APIRouter(prefix="/ferramentas", tags=["ferramentas"])


@router.get("/meu-ip")
async def meu_ip(
    request: Request, _sessao: TechnicianSession = Depends(get_current_session)
) -> dict[str, Any]:
    if not IPIFY_API_KEY:
        raise HTTPException(status_code=503, detail="Consulta de IP não configurada neste servidor.")

    ip = obter_ip_origem(request)
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as http:
            async with http.get(
                "https://geo.ipify.org/api/v2/country,city",
                params={"apiKey": IPIFY_API_KEY, "ipAddress": ip},
            ) as resposta:
                dados = await resposta.json()
                if resposta.status != 200:
                    raise HTTPException(status_code=502, detail="Não foi possível consultar a geolocalização do IP.")
    except aiohttp.ClientError:
        raise HTTPException(status_code=502, detail="Não foi possível consultar a geolocalização do IP.")

    return {
        "success": True,
        "ip": dados.get("ip", ip),
        "location": dados.get("location"),
        "isp": dados.get("isp"),
    }
