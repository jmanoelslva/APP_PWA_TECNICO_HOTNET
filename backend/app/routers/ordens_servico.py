"""
Ordem de Serviço (OS) — recurso PRÓPRIO no Controllr, diferente de
Ticket/Suporte Técnico (ver suporte.py). Confirmado na doc oficial
(apidoc.brbyte.com, tag "Ordem de Serviço"): uma OS pertence a um ticket
(ticket_pk), tem data agendada (op_date_sched) e técnico responsável
(user_pk). É a OS — não o ticket em si — que representa o trabalho de
campo atribuído ao técnico.

Ciclo de vida real de uma OS (confirmado com o dono da operação, e as
ações de responder/iniciar/finalizar capturadas ao vivo do painel do
Controllr, já que não estão na doc oficial):
1. Agendamento — feito pelo escritório, já vem pronto.
2. Respondida — técnico marca que viu a OS (/responder).
3. Iniciada — técnico marca que começou o atendimento (/iniciar).
4. Finalizada — técnico marca que terminou o atendimento (/finalizar).
Fechar a OS é uma etapa À PARTE, feita só pelo escritório — o ACL do
Controllr não libera essa permissão pro técnico, por isso não existe
rota de fechar aqui. Cancelar/reabrir continuam disponíveis (não
mencionados como restritos).

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
        # "support_op.user_pk" (com prefixo) — bare "user_pk" é ambíguo em
        # /support_ctl/os/list (erro real do Postgres confirmado batendo
        # direto no Controllr: code 42702 = "ambiguous_column"; a tabela
        # certa, "support_op", foi achada testando candidatos até um dar
        # 200 em vez de 42P01 "relation does not exist"). Mesmo padrão de
        # bug já visto em client_pk/contract_pk/dp_port. oper 21 = IN.
        condicoes.append({"field": "support_op.user_pk", "oper": OPER_IN, "value": [ctx.session.user_pk]})

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


# Os 4 estágios reais de uma OS (confirmado pelo usuário, dono da operação):
# 1. Agendamento — feito pelo escritório, já vem pronto (op_date_sched).
# 2. Respondida — o técnico "viu"/aceitou a OS (op_date_answer).
# 3. Iniciada — o técnico começou o atendimento (op_date_start).
# 4. Finalizada — o técnico terminou o atendimento (op_date_finish).
# Fechar a OS (op_date_close) é feito SÓ pelo escritório — essa permissão
# não é liberada pro técnico via ACL do Controllr, por isso não existe
# rota de "fechar" aqui (nem botão no app): tentar chamar
# /support_ctl/os/close com a conta de um técnico de verdade daria 403
# "Access Denied" no próprio Controllr.
#
# Os 3 endpoints abaixo (set_answer/set_start/set_finish) NÃO estão
# documentados na doc oficial (só list/close/cancel/reopen/create estão) —
# confirmados capturando ao vivo os botões reais "Respondida"/"Iniciada"/
# "Finalizada" no painel web do Controllr. Cada clique cria um novo
# registro de evento (op_pk novo) vinculado à OS via op_os_pk (a OS em si
# não é sobrescrita) — corpo confirmado: só op_os_pk + op_desc (SEM
# ticket_pk, diferente de close/cancel/reopen).
@router.post("/{ticket_pk}/responder")
async def responder_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/set_answer", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível marcar a OS como respondida.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/iniciar")
async def iniciar_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/set_start", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível iniciar a OS.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/finalizar")
async def finalizar_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/set_finish", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível finalizar a OS.", resposta))
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
