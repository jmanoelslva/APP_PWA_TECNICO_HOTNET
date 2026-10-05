import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import vigia_os
from .config import APP_VERSION, CORS_ALLOW_ORIGINS
from .routers import (
    auditoria,
    auth,
    avisos,
    clientes,
    conexao,
    dp,
    enderecos,
    ferramentas,
    financeiro,
    onu,
    ordens_servico,
    suporte,
    telefones,
)

logger = logging.getLogger(__name__)


@contextlib.asynccontextmanager
async def ciclo_de_vida(_app: FastAPI) -> AsyncIterator[None]:
    # Vigia de OS nova (avisos no celular): só com usuário de consulta e
    # chaves configurados no backend.env.
    tarefa = asyncio.create_task(vigia_os.rodar()) if vigia_os.configurado() else None
    if tarefa is None:
        logger.info("Avisos de OS desligados (sem CONTROLLR_CONSULTA_* ou VAPID_* no backend.env)")
    try:
        yield
    finally:
        if tarefa is not None:
            tarefa.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await tarefa


app = FastAPI(title="HOTNET Técnico API", version=APP_VERSION, lifespan=ciclo_de_vida)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auditoria.router)
app.include_router(auth.router)
app.include_router(avisos.router)
app.include_router(clientes.router)
app.include_router(enderecos.router)
app.include_router(financeiro.router)
app.include_router(ferramentas.router)
app.include_router(conexao.router)
app.include_router(dp.router)
app.include_router(onu.router)
app.include_router(ordens_servico.router)
app.include_router(suporte.router)
app.include_router(telefones.router)


@app.get("/health")
async def health() -> dict[str, bool | str]:
    return {"ok": True, "version": APP_VERSION}
