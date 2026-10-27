"""
Ordem de Serviço (OS) — recurso próprio no Controllr, diferente de
Ticket/Suporte Técnico (ver suporte.py; tag "Ordem de Serviço" na doc
oficial, apidoc.brbyte.com). Uma OS pertence a um ticket (ticket_pk), tem
data agendada (op_date_sched) e técnico responsável (staff_pk/
staff_username — "user_pk"/"user_username" é quem abriu/agendou a OS, não
quem executa). É a OS — não o ticket em si — que representa o trabalho de
campo atribuído ao técnico.

Ciclo de vida de uma OS:
1. Agendamento — feito pelo escritório, já vem pronto.
2. Respondida — técnico marca que viu a OS (/responder, desfaz em /desfazer-resposta).
3. Iniciada — técnico marca que começou o atendimento (/iniciar, desfaz em /desfazer-inicio).
4. Finalizada — técnico marca que terminou o atendimento (/finalizar, desfaz em /desfazer-finalizacao).
Fechar a OS é uma etapa à parte, feita só pelo escritório — o ACL do
Controllr não libera essa permissão para o técnico, por isso não existe
rota de fechar aqui. Cancelar/reabrir continuam disponíveis.

Estágio atual: os campos op_date_answer/op_date_start/op_date_finish do
registro raiz da OS (o que list() devolve) ficavam nulos (em 2026-10-26
já vieram preenchidos, iguais aos eventos — os eventos seguem como a
fonte, valendo para os dois casos). Cada
clique em responder/iniciar/finalizar/desfazer cria um novo registro de
evento (visível só em /support_ctl/op/list, o mesmo endpoint do chat do
chamado — ver suporte.py::listar_mensagens_ticket) vinculado à OS via
op_os_pk = op_pk do registro raiz. Um "set" grava o evento com a data
correspondente preenchida; um "undo" grava outro evento do mesmo
op_type com a data nula. Para saber se uma etapa está marcada, o
frontend olha o evento mais recente daquele tipo entre os registros da
OS, não um campo fixo — reaproveita listarMensagensTicket em vez de um
endpoint próprio.

Nome do arquivo evita "os.py" de propósito — colidiria com o módulo
"os" da biblioteca padrão do Python dentro deste mesmo pacote.
"""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from ..audit import registrar_auditoria
from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_GTE, OPER_LTE, corpo, where_and, where_in

router = APIRouter(prefix="/os", tags=["ordem-servico"])

# Uma OS "aberta" tem data agendada e ainda não foi fechada, cancelada
# nem apagada. oper 8/7 não estão documentados por nome na doc oficial
# (só aparecem no exemplo de /support_ctl/os/list), usados aqui como no
# exemplo.
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

    where = where_and(*condicoes) if condicoes else None
    resposta = await ctx.controllr.call_api_post(
        "/support_ctl/os/list",
        corpo(where, start=start, limit=limit, sort="op_date_sched", dir="ASC"),
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as ordens de serviço.", resposta))

    resultados = resposta.results
    total = resposta.total
    if minhas:
        # O técnico que executa é o staff (staff_username = login dele no
        # app). O user_pk da OS é quem a abriu — filtrar por ele mostrava as
        # OS que a pessoa CRIOU. A ACL do Controllr já só devolve ao técnico
        # as OS dele; este filtro vale para contas que veem todas
        # (escritório/supervisor), para "minhas" continuar sendo as dela.
        login = ctx.session.username.strip().lower()
        resultados = [o for o in resultados if str(o.get("staff_username") or "").strip().lower() == login]
        total = len(resultados)
    if ticket_pk is None and abertas:
        resultados = await _sem_finalizadas(ctx, resultados)

    return {"success": True, "results": resultados, "total": total}


async def _sem_finalizadas(ctx: AuthContext, ordens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Remove da lista as OS já finalizadas pelo técnico e marca a etapa de
    cada uma ("etapa": agendada, respondida ou iniciada) para a lista
    mostrar. op_date_answer/start/finish do registro raiz (em "ordens") ficam
    sempre nulos (ver módulo acima) — o estágio real vem do evento mais
    recente de cada tipo (3 respondida, 4 iniciada, 5 finalizada) em
    /support_ctl/op/list (mesmo endpoint do chat), buscado para todos os
    tickets de uma vez em vez de uma chamada por OS.
    """
    ultimo = await _ultimos_eventos(ctx, ordens)
    if ultimo is None:
        return ordens  # falha aqui não deve esconder OS: melhor mostrar demais do que a menos

    def marcada(ordem: dict[str, Any], op_type: int, campo: str) -> bool:
        return _etapa_marcada(ultimo, ordem, op_type, campo)

    abertas = []
    for ordem in ordens:
        if marcada(ordem, 5, "op_date_finish"):
            continue
        if marcada(ordem, 4, "op_date_start"):
            ordem["etapa"] = "iniciada"
        elif marcada(ordem, 3, "op_date_answer"):
            ordem["etapa"] = "respondida"
        else:
            ordem["etapa"] = "agendada"
        abertas.append(ordem)
    return abertas


async def _ultimos_eventos(
    ctx: AuthContext, ordens: list[dict[str, Any]]
) -> dict[tuple[int, int], dict[str, Any]] | None:
    """
    Evento mais recente de cada (OS, tipo 3/4/5) dos tickets dessas OS, numa
    chamada só. {} sem tickets; None se o Controllr falhar.
    """
    tickets_pks = [o["ticket_pk"] for o in ordens if o.get("ticket_pk") is not None]
    if not tickets_pks:
        return {}

    resposta = await ctx.controllr.call_api_post(
        "/support_ctl/op/list",
        corpo(where_in("ticket_pk", tickets_pks), sort="op_pk", dir="ASC"),
    )
    if not resposta.success:
        return None

    # Ordenado por op_pk ASC — o último write para cada (OS, tipo) vence.
    ultimo: dict[tuple[int, int], dict[str, Any]] = {}
    for evento in resposta.results:
        if evento.get("op_type") in (3, 4, 5) and evento.get("op_os_pk") is not None:
            ultimo[(evento["op_os_pk"], evento["op_type"])] = evento
    return ultimo


def _etapa_marcada(
    ultimo: dict[tuple[int, int], dict[str, Any]], ordem: dict[str, Any], op_type: int, campo: str
) -> bool:
    evento = ultimo.get((ordem.get("op_pk"), op_type))
    return bool((evento and evento.get(campo)) or ordem.get(campo))


_DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@router.get("/resumo-dia")
async def resumo_do_dia(
    data: str = Query(description="Dia no formato AAAA-MM-DD (data do celular do técnico)"),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    """
    Quantas OS do técnico logado estão agendadas para o dia e quantas já
    foram concluídas — para a barra de progresso da tela inicial. Diferente
    da lista (GET /os), não tira as fechadas: OS fechada pelo escritório
    (ou com o ticket fechado) continua vindo pelo filtro de data
    (conferido no Controllr em 2026-10-26). Concluída = finalizada pelo
    técnico ou fechada; cancelada não conta.
    """
    if not _DATA.match(data):
        raise HTTPException(status_code=400, detail="Data inválida (use AAAA-MM-DD).")
    faixa = [
        {"field": "op_date_sched", "oper": OPER_GTE, "value": f"{data} 00:00:00"},
        {"field": "AND"},
        {"field": "op_date_sched", "oper": OPER_LTE, "value": f"{data} 23:59:59"},
    ]
    where = where_and(faixa, {"field": "op_deleted", "oper": _OPER_IGUAL_OU_NULO, "value": False})
    resposta = await ctx.controllr.call_api_post(
        "/support_ctl/os/list", corpo(where, start=0, limit=200, sort="op_date_sched", dir="ASC")
    )
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível carregar o resumo do dia.", resposta))

    login = ctx.session.username.strip().lower()
    ordens = [
        o
        for o in resposta.results
        if str(o.get("staff_username") or "").strip().lower() == login and not o.get("op_date_cancel")
    ]
    ultimo = await _ultimos_eventos(ctx, ordens) or {}
    concluidas = sum(
        1 for o in ordens if o.get("op_date_close") or _etapa_marcada(ultimo, o, 5, "op_date_finish")
    )
    return {"success": True, "total": len(ordens), "concluidas": concluidas}


class AcaoOSPayload(BaseModel):
    op_os_pk: int
    op_desc: str | None = None


def _alvo_os(ticket_pk: int, payload: AcaoOSPayload) -> dict[str, Any]:
    alvo = {"ticket_pk": ticket_pk, "op_os_pk": payload.op_os_pk, "motivo": (payload.op_desc or "").strip()[:300]}
    return {k: v for k, v in alvo.items() if v not in (None, "")}


# Os 4 estágios de uma OS:
# 1. Agendamento — feito pelo escritório, já vem pronto (op_date_sched).
# 2. Respondida — o técnico marca que viu a OS (op_date_answer).
# 3. Iniciada — o técnico começou o atendimento (op_date_start).
# 4. Finalizada — o técnico terminou o atendimento (op_date_finish).
# Fechar a OS (op_date_close) é feito só pelo escritório — o ACL do
# Controllr não libera essa permissão para o técnico (/support_ctl/
# os/close retorna 403 "Access Denied" para uma conta de técnico), por
# isso não existe rota de "fechar" aqui.
#
# set_answer/set_start/set_finish não estão documentados na doc oficial
# (só list/close/cancel/reopen/create estão). Cada chamada cria um novo
# registro de evento (op_pk novo) vinculado à OS via op_os_pk — a OS em
# si não é sobrescrita. Corpo: op_os_pk + op_desc, sem ticket_pk
# (diferente de close/cancel/reopen).
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


class DesfazerEtapaPayload(BaseModel):
    op_os_pk: int
    op_desc: str


# undo_answer/undo_start/undo_finish, igualmente fora da doc oficial.
# Exigem op_os_pk + op_desc (campos obrigatórios). O estágio de uma
# etapa não vem do op_date_* do registro raiz da OS (sempre nulo) — vem
# do evento mais recente daquele tipo (respondida/iniciada/finalizada)
# em /support_ctl/op/list: um set_* grava o evento com a data
# preenchida, um undo_* grava outro evento do mesmo tipo com a data
# nula. O front usa listarMensagensTicket (mesmo endpoint do chat) para
# calcular o estágio de cada etapa a partir desses eventos.
@router.post("/{ticket_pk}/desfazer-resposta")
async def desfazer_resposta_ordem_servico(
    ticket_pk: int, payload: DesfazerEtapaPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc)
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/undo_answer", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível desfazer a resposta da OS.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/desfazer-inicio")
async def desfazer_inicio_ordem_servico(
    ticket_pk: int, payload: DesfazerEtapaPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc)
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/undo_start", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível desfazer o início da OS.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/desfazer-finalizacao")
async def desfazer_finalizacao_ordem_servico(
    ticket_pk: int, payload: DesfazerEtapaPayload, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc)
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/undo_finish", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível desfazer a finalização da OS.", resposta))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/cancelar")
async def cancelar_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, ticket_pk=ticket_pk, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/cancel", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível cancelar a OS.", resposta))
    registrar_auditoria(request, ctx.session, "os.cancelar", _alvo_os(ticket_pk, payload))
    return {"success": True, "results": resposta.results}


@router.post("/{ticket_pk}/reabrir")
async def reabrir_ordem_servico(
    ticket_pk: int, payload: AcaoOSPayload, request: Request, ctx: AuthContext = Depends(get_auth_context)
) -> dict[str, Any]:
    corpo_req = corpo(None, ticket_pk=ticket_pk, op_os_pk=payload.op_os_pk, op_desc=payload.op_desc or "")
    resposta = await ctx.controllr.call_api_post("/support_ctl/os/reopen", corpo_req)
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível reabrir a OS.", resposta))
    registrar_auditoria(request, ctx.session, "os.reabrir", _alvo_os(ticket_pk, payload))
    return {"success": True, "results": resposta.results}
