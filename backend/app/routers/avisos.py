"""Liga/desliga os avisos de OS nova no celular do técnico (ver app/avisos.py e app/vigia_os.py)."""

from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import avisos, vigia_os
from ..config import VAPID_PUBLIC_KEY
from ..deps import get_current_session
from ..sessions import TechnicianSession

router = APIRouter(prefix="/avisos", tags=["avisos"])

# O servidor faz POST no endereço que o celular informa: só os serviços de
# push dos navegadores, para ninguém usar o backend para chamar outro lugar.
_SERVICOS_PUSH = (
    "fcm.googleapis.com",            # Chrome / Android
    "push.services.mozilla.com",     # Firefox
    "push.apple.com",                # Safari / iPhone
    "notify.windows.com",            # Edge (Windows)
)


def _endpoint_valido(endpoint: str) -> bool:
    url = urlparse(endpoint)
    host = (url.hostname or "").lower()
    return url.scheme == "https" and any(host == s or host.endswith("." + s) for s in _SERVICOS_PUSH)


class Chaves(BaseModel):
    p256dh: str = Field(min_length=1, max_length=200)
    auth: str = Field(min_length=1, max_length=100)


class Inscricao(BaseModel):
    endpoint: str = Field(min_length=1, max_length=1000)
    keys: Chaves
    # Aviso de teste na hora — só quando o técnico liga os avisos, não quando
    # o app reassocia o celular ao abrir.
    confirmar: bool = False


class Remocao(BaseModel):
    endpoint: str = Field(min_length=1, max_length=1000)


@router.get("/config")
async def config(_sessao: TechnicianSession = Depends(get_current_session)) -> dict[str, Any]:
    """Se o servidor está pronto para mandar avisos e a chave pública do Web Push."""
    disponivel = vigia_os.configurado()
    return {"disponivel": disponivel, "chave": VAPID_PUBLIC_KEY if disponivel else ""}


@router.post("/inscricao")
async def inscrever(inscricao: Inscricao, sessao: TechnicianSession = Depends(get_current_session)) -> dict[str, bool]:
    if not vigia_os.configurado():
        raise HTTPException(status_code=503, detail="Avisos de OS não estão configurados neste servidor.")
    if not _endpoint_valido(inscricao.endpoint):
        raise HTTPException(status_code=400, detail="Endereço de notificação não reconhecido.")
    dados = inscricao.model_dump(exclude={"confirmar"})
    avisos.inscrever(sessao.username, dados)
    if inscricao.confirmar:
        # O técnico vê na hora que funciona neste celular.
        await avisos.enviar(dados, {"titulo": "Avisos de OS ativados",
                                    "corpo": "Você vai ser avisado aqui quando chegar OS nova para você.",
                                    "url": "/", "tag": "avisos-ativados"}, sessao.username)
    return {"success": True}


@router.post("/remover")
async def remover(remocao: Remocao, sessao: TechnicianSession = Depends(get_current_session)) -> dict[str, bool]:
    avisos.remover(remocao.endpoint, sessao.username)
    return {"success": True}
