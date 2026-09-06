"""
Ordem de Serviço (OS) — recurso PRÓPRIO no Controllr, diferente de
Ticket/Suporte Técnico (ver suporte.py). Confirmado na doc oficial
(apidoc.brbyte.com, tag "Ordem de Serviço"): uma OS pertence a um ticket
(ticket_pk), tem data agendada (op_date_sched), técnico responsável
(user_pk) e seu próprio ciclo de vida (fechar/cancelar/reabrir) via
/support_ctl/os/*. É a OS — não o ticket em si — que representa o
trabalho de campo atribuído ao técnico; fechar uma OS não é a mesma
operação que mudar o status de um ticket (ticket_change_status), mesmo
os dois estando relacionados.

Nome do arquivo evita "os.py" de propósito — colidiria com o módulo
"os" da biblioteca padrão do Python dentro deste mesmo pacote.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_IN, corpo, where_and

router = APIRouter(prefix="/os", tags=["ordem-servico"])

# Formato confirmado na doc oficial (exemplo de /support_ctl/os/list):
# uma OS "aberta" é a que tem data agendada, mas ainda não foi fechada,
# cancelada, nem apagada. oper 8/7 não estão documentados por nome (só
# vistos no exemplo oficial), então reproduzidos literalmente — não
# reinventados.
_OPER_DATA_PREENCHIDA = 8
_OPER_IGUAL_OU_NULO = 7


def _condicoes_abertas() -> list[dict[str, Any]]:
    return [
        {"field": "op_date_sched", "oper": _OPER_DATA_PREENCHIDA, "value": None},
        {"field": "op_date_close", "oper": _OPER_IGUAL_OU_NULO, "value": None},
        {"field": "op_date_cancel", "oper": _OPER_IGUAL_OU_NULO, "value": None},
        {"field": "op_deleted", "oper": _OPER_IGUAL_OU_NULO, "value": False},
    ]


@router.get("")
async def listar_ordens_servico(
    minhas: bool = Query(default=True),
    abertas: bool = Query(default=True, description="Só OS agendadas e ainda não fechadas/canceladas"),
    ticket_pk: int | None = Query(default=None, description="Filtra pelas OS de um ticket específico"),
    start: int = Query(default=0),
    limit: int = Query(default=20),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    condicoes: list[dict[str, Any]] = []
    if ticket_pk is not None:
        condicoes.append({"field": "ticket_pk", "oper": OPER_EQ, "value": ticket_pk})
    elif abertas:
        condicoes.extend(_condicoes_abertas())

    if minhas and ctx.session.user_pk is not None:
        # Mesmo padrão confirmado pra ticket_list (oper 21 = IN).
        condicoes.append({"field": "user_pk", "oper": OPER_IN, "value": [ctx.session.user_pk]})

    where = where_and(*condicoes) if condicoes else None
    resposta = await ctx.controllr.call_api_post(
        "/support_ctl/os/list",
        corpo(where, start=start, limit=limit, sort="op_date_sched", dir="ASC"),
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as ordens de serviço.", resposta))
    return {"success": True, "results": resposta.results, "total": resposta.total}


class AcaoOSPayload(BaseModel):
    op_os_pk: int
    op_desc: str | None = None


class FecharOSPayload(AcaoOSPayload):
    op_client_show: bool = True


@router.post("/{ticket_pk}/fechar")
async def fechar_ordem_servico(
    ticket_pk: int, payload: FecharOSPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(
        None,
        ticket_pk=ticket_pk,
        op_os_pk=payload.op_os_pk,
        op_desc=payload.op_desc or "",
        op_client_show=int(payload.op_client_show),
    )
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/close", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível fechar a OS.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/cancelar")
async def cancelar_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, ticket_pk=ticket_pk, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/cancel", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível cancelar a OS.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/reabrir")
async def reabrir_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, ticket_pk=ticket_pk, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/reopen", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível reabrir a OS.", resposta))
    return {"success": True, "results": resposta.results}
