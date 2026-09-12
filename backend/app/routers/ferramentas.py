"""
Ferramenta "Meu IP" — IP público (IPv4 e/ou IPv6) e geolocalização
aproximada da rede em que o dispositivo do técnico está conectado agora
(útil, por exemplo, para conferir a rede do próprio cliente durante uma
visita).

O frontend descobre o IPv4/IPv6 do dispositivo direto pelos endpoints
públicos do ipify (api.ipify.org / api6.ipify.org, sem chave) e manda
cada um para cá via "ip" — este backend só faz a parte que exige chave:
consultar a Geolocation API do ipify (geo.ipify.org) para aquele IP. A
chave (IPIFY_API_KEY em config.py) fica só no servidor, nunca no app.
Sem "ip" informado, cai para o IP detectado no servidor (mesma lógica de
audit.py::obter_ip_origem, que já lida com o proxy reverso na frente
deste backend).
"""

from typing import Any

import aiohttp
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..audit import obter_ip_origem
from ..config import IPIFY_API_KEY
from ..deps import get_current_session
from ..sessions import TechnicianSession

router = APIRouter(prefix="/ferramentas", tags=["ferramentas"])


@router.get("/meu-ip")
async def meu_ip(
    request: Request,
    ip: str | None = Query(default=None),
    _sessao: TechnicianSession = Depends(get_current_session),
) -> dict[str, Any]:
    if not IPIFY_API_KEY:
        raise HTTPException(status_code=503, detail="Consulta de IP não configurada neste servidor.")

    ip_consultado = ip.strip() if ip and ip.strip() else obter_ip_origem(request)
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as http:
            async with http.get(
                "https://geo.ipify.org/api/v2/country,city",
                params={"apiKey": IPIFY_API_KEY, "ipAddress": ip_consultado},
            ) as resposta:
                dados = await resposta.json()
                if resposta.status != 200:
                    raise HTTPException(status_code=502, detail="Não foi possível consultar a geolocalização do IP.")
    except aiohttp.ClientError:
        raise HTTPException(status_code=502, detail="Não foi possível consultar a geolocalização do IP.")

    return {
        "success": True,
        "ip": dados.get("ip", ip_consultado),
        "location": dados.get("location"),
        "isp": dados.get("isp"),
        "as_info": dados.get("as"),
    }
