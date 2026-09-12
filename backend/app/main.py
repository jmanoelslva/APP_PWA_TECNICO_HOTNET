from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import APP_VERSION, CORS_ALLOW_ORIGINS
from .routers import auth, clientes, conexao, dp, enderecos, financeiro, onu, ordens_servico, suporte, telefones

app = FastAPI(title="HOTNET TECH API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(enderecos.router)
app.include_router(financeiro.router)
app.include_router(conexao.router)
app.include_router(dp.router)
app.include_router(onu.router)
app.include_router(ordens_servico.router)
app.include_router(suporte.router)
app.include_router(telefones.router)


@app.get("/health")
async def health() -> dict[str, bool | str]:
    return {"ok": True, "version": APP_VERSION}
