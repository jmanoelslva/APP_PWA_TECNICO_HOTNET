"""Consulta do log de auditoria (ver audit.py) — só para os usuários em AUDITORIA_USUARIOS."""

import asyncio
import logging
import re
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..audit import consultar
from ..config import AUDITORIA_USUARIOS
from ..deps import AuthContext, get_auth_context, get_current_session
from ..sessions import TechnicianSession
from ..where import corpo, where_eq

logger = logging.getLogger(__name__)

# Registros antigos só têm os números internos (onu_pk/olt_pk). O resto vem
# da mesma busca de ONU que a tela usa (/fiber_ctl/onu/list), guardado por
# 10 min. O Controllr ignora filtro que não entende e devolve qualquer ONU —
# por isso só vale a linha cujo número confere com o pedido.
_VALIDADE_S = 600
BUSCAS_POR_CONSULTA = 60
_cache: dict[tuple[str, int], tuple[float, dict[str, Any] | None]] = {}


async def _onu_por(ctx: AuthContext, campo: str, valor: int) -> dict[str, Any] | None:
    """Uma ONU do Controllr com `campo` ("onu_pk" ou "olt_pk") = valor."""
    chave = (campo, valor)
    guardado = _cache.get(chave)
    if guardado and time.monotonic() - guardado[0] < _VALIDADE_S:
        return guardado[1]
    achada = None
    try:
        resposta = await ctx.controllr.onu_list(corpo(where_eq(campo, valor), limit=20),
                                                model_return=True, model_extended=True)
        if resposta.success:
            atributo = "pk" if campo == "onu_pk" else "olt_pk"
            for onu in resposta.results:
                d = onu.model_dump(mode="json")
                if d.get(atributo) == valor:
                    achada = d
                    break
    except Exception:
        logger.exception("Auditoria: não foi possível buscar %s=%s no Controllr", campo, valor)
    _cache[chave] = (time.monotonic(), achada)
    return achada


async def _completar(ctx: AuthContext, alvo: dict[str, Any]) -> None:
    """Preenche OLT (nome), PON, número e serial que faltarem num registro antigo."""
    if alvo.get("olt_nome") or not (alvo.get("onu_pk") or alvo.get("olt_pk")):
        return
    onu = await _onu_por(ctx, "onu_pk", alvo["onu_pk"]) if alvo.get("onu_pk") else None
    # A ONU pode ter sido removida depois: aí, pelo menos o nome da OLT.
    if onu is None and alvo.get("olt_pk"):
        olt = await _onu_por(ctx, "olt_pk", alvo["olt_pk"])
        if olt and olt.get("olt_name"):
            alvo["olt_nome"] = olt["olt_name"]
        return
    if onu is None:
        return
    if onu.get("olt_name"):
        alvo["olt_nome"] = onu["olt_name"]
    for destino, origem in (("porta", "pon"), ("onu_id", "id"), ("serial", "sn")):
        if alvo.get(destino) in (None, "") and onu.get(origem) not in (None, ""):
            alvo[destino] = onu[origem]


router = APIRouter(prefix="/auditoria", tags=["auditoria"])

_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# Em AUDITORIA_USUARIOS, "*" ou "todos" libera qualquer técnico logado.
LIBERA_TODOS = {"*", "todos"}


def _pode(session: TechnicianSession) -> bool:
    return bool(AUDITORIA_USUARIOS & LIBERA_TODOS) or session.username.strip().lower() in AUDITORIA_USUARIOS


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
    # Registros antigos: completa em paralelo (poucos de cada vez, para não
    # sobrecarregar o Controllr) e no máximo BUSCAS_POR_CONSULTA ONUs novas.
    pendentes = [e.setdefault("alvo", {}) for e in eventos]
    pendentes = [a for a in pendentes if not a.get("olt_nome") and (a.get("onu_pk") or a.get("olt_pk"))]
    novas = {("onu_pk", a["onu_pk"]) if a.get("onu_pk") else ("olt_pk", a["olt_pk"]) for a in pendentes}
    if len([k for k in novas if k not in _cache]) > BUSCAS_POR_CONSULTA:
        pendentes = pendentes[:BUSCAS_POR_CONSULTA]
    limite_paralelo = asyncio.Semaphore(5)

    async def completar(alvo: dict[str, Any]) -> None:
        async with limite_paralelo:
            await _completar(ctx, alvo)

    await asyncio.gather(*(completar(a) for a in pendentes))
    return {"eventos": eventos, "mais": mais}
