"""Consulta do log de auditoria (ver audit.py) — só para os usuários em AUDITORIA_USUARIOS."""

import logging
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..audit import consultar
from ..config import AUDITORIA_USUARIOS
from ..deps import AuthContext, get_auth_context, get_current_session
from ..sessions import TechnicianSession

logger = logging.getLogger(__name__)

# Registros antigos só têm o olt_pk: o nome vem da lista de OLTs do Controllr
# (guardada por 10 min; se a consulta falhar, a tela mostra o número).
_OLTS_VALIDADE_S = 600
_olts: tuple[float, dict[int, str]] = (0.0, {})


async def _nomes_olts(ctx: AuthContext) -> dict[int, str]:
    global _olts
    if time.monotonic() - _olts[0] < _OLTS_VALIDADE_S:
        return _olts[1]
    nomes: dict[int, str] = {}
    try:
        resposta = await ctx.controllr.olt_list(
            "search_term=olt_name&search_value=&load_vendor=-1&load_enabled=-1&start=0&limit=500"
        )
        if resposta.success:
            for o in resposta.results:
                if o.get("olt_pk") is not None and o.get("olt_name"):
                    nomes[int(o["olt_pk"])] = str(o["olt_name"])
    except Exception:
        logger.exception("Não foi possível listar as OLTs para a auditoria")
    _olts = (time.monotonic(), nomes)
    return nomes

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
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    session = ctx.session
    if not _pode(session):
        raise HTTPException(status_code=403, detail="Seu usuário não tem acesso à auditoria.")
    for nome, valor in (("de", de), ("ate", ate)):
        if valor and not _DATA.match(valor):
            raise HTTPException(status_code=400, detail=f"Data inválida em '{nome}': use AAAA-MM-DD.")
    eventos, mais = consultar(tecnico, acao, de, ate, limite)
    if any("olt_pk" in (e.get("alvo") or {}) and not e["alvo"].get("olt_nome") for e in eventos):
        nomes = await _nomes_olts(ctx)
        for e in eventos:
            alvo = e.get("alvo") or {}
            if not alvo.get("olt_nome") and alvo.get("olt_pk") in nomes:
                alvo["olt_nome"] = nomes[alvo["olt_pk"]]
    return {"eventos": eventos, "mais": mais}
