"""Consulta do log de auditoria (ver audit.py) — só para os usuários em AUDITORIA_USUARIOS."""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..audit import consultar
from ..config import AUDITORIA_USUARIOS
from ..deps import get_current_session
from ..sessions import TechnicianSession

router = APIRouter(prefix="/auditoria", tags=["auditoria"])

_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _pode(session: TechnicianSession) -> bool:
    return session.username.strip().lower() in AUDITORIA_USUARIOS


@router.get("/acesso")
async def acesso(session: TechnicianSession = Depends(get_current_session)) -> dict[str, bool]:
    """Se este técnico pode abrir a auditoria (a tela de Ferramentas usa para mostrar o atalho)."""
    return {"permitido": _pode(session)}


@router.get("")
async def listar(
    tecnico: str | None = Query(default=None, max_length=64),
    acao: str | None = Query(default=None, max_length=64),
    de: str | None = Query(default=None, description="AAAA-MM-DD"),
    ate: str | None = Query(default=None, description="AAAA-MM-DD"),
    limite: int = Query(default=200, ge=1, le=1000),
    session: TechnicianSession = Depends(get_current_session),
) -> dict[str, Any]:
    if not _pode(session):
        raise HTTPException(status_code=403, detail="Seu usuário não tem acesso à auditoria.")
    for nome, valor in (("de", de), ("ate", ate)):
        if valor and not _DATA.match(valor):
            raise HTTPException(status_code=400, detail=f"Data inválida em '{nome}': use AAAA-MM-DD.")
    eventos, mais = consultar(tecnico, acao, de, ate, limite)
    return {"eventos": eventos, "mais": mais}
