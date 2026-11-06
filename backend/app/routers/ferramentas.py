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


def normalizar_viacep(dados: dict[str, Any]) -> dict[str, Any] | None:
    """Converte a resposta do ViaCEP para os campos de endereço do Controllr.

    CEP inexistente vem como {"erro": true}. CEP geral de cidade vem com
    logradouro e bairro vazios — devolvidos como None para o app não apagar
    o que o técnico já digitou. "siafi" é o código de município que o
    Controllr exige em address_siafi.
    """
    if not dados or dados.get("erro"):
        return None

    def texto(chave: str) -> str | None:
        valor = str(dados.get(chave) or "").strip()
        return valor or None

    siafi = texto("siafi")
    return {
        "address": texto("logradouro"),
        "address_neighborhood": texto("bairro"),
        "address_province": texto("localidade"),
        "address_state": texto("uf"),
        "address_siafi": int(siafi) if siafi and siafi.isdigit() else None,
    }


@router.get("/cep/{cep}")
async def consultar_cep(
    cep: str,
    _sessao: TechnicianSession = Depends(get_current_session),
) -> dict[str, Any]:
    """Endereço de um CEP via ViaCEP (público, sem chave), consultado pelo
    servidor para não abrir mais um domínio no CSP do app."""
    digitos = "".join(c for c in cep if c.isdigit())
    if len(digitos) != 8:
        raise HTTPException(status_code=400, detail="CEP deve ter 8 dígitos.")
    try:
        timeout = aiohttp.ClientTimeout(total=8)
        async with aiohttp.ClientSession(timeout=timeout) as http:
            async with http.get(f"https://viacep.com.br/ws/{digitos}/json/") as resposta:
                if resposta.status != 200:
                    raise HTTPException(status_code=502, detail="Não foi possível consultar o CEP.")
                dados = await resposta.json(content_type=None)
    except (aiohttp.ClientError, TimeoutError):
        raise HTTPException(status_code=502, detail="Não foi possível consultar o CEP.")

    endereco = normalizar_viacep(dados)
    if endereco is None:
        raise HTTPException(status_code=404, detail="CEP não encontrado.")
    return {"success": True, "cep": digitos, **endereco}
