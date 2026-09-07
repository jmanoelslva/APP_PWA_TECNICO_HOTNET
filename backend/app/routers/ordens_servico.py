"""
Ordem de Serviço (OS) — recurso PRÓPRIO no Controllr, diferente de
Ticket/Suporte Técnico (ver suporte.py). Confirmado na doc oficial
(apidoc.brbyte.com, tag "Ordem de Serviço"): uma OS pertence a um ticket
(ticket_pk), tem data agendada (op_date_sched) e técnico responsável
(user_pk). É a OS — não o ticket em si — que representa o trabalho de
campo atribuído ao técnico.

Ciclo de vida real de uma OS (confirmado com o dono da operação, e as
ações de responder/iniciar/finalizar/desfazer capturadas ao vivo do
painel do Controllr, já que não estão na doc oficial):
1. Agendamento — feito pelo escritório, já vem pronto.
2. Respondida — técnico marca que viu a OS (/responder, desfaz em /desfazer-resposta).
3. Iniciada — técnico marca que começou o atendimento (/iniciar, desfaz em /desfazer-inicio).
4. Finalizada — técnico marca que terminou o atendimento (/finalizar, desfaz em /desfazer-finalizacao).
Fechar a OS é uma etapa À PARTE, feita só pelo escritório — o ACL do
Controllr não libera essa permissão para o técnico, por isso não existe
rota de fechar aqui. Cancelar/reabrir continuam disponíveis (não
mencionados como restritos).

IMPORTANTE sobre como saber o estágio atual: os campos op_date_answer/
op_date_start/op_date_finish do registro RAIZ da OS (o que list()
devolve) ficam SEMPRE nulos — confirmado ao vivo. Cada clique em
responder/iniciar/finalizar/desfazer cria um novo registro de EVENTO
(visível só em /support_ctl/op/list, o mesmo endpoint do chat do
chamado — ver suporte.py::listar_mensagens_ticket) vinculado à OS via
op_os_pk = op_pk do registro raiz. Um "set" grava o evento com a data
correspondente preenchida; um "undo" grava outro evento do MESMO
op_type só que com a data nula. Ou seja: para saber se uma etapa está
marcada, o frontend precisa olhar o evento MAIS RECENTE daquele tipo
entre os registros da OS, não um campo fixo — não tem endpoint próprio
aqui para isso porque dá para reaproveitar listarMensagensTicket.

Nome do arquivo evita "os.py" de propósito — colidiria com o módulo
"os" da biblioteca padrão do Python dentro deste mesmo pacote.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_IN, corpo, where_and, where_in

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

    resultados = resposta.results
    if ticket_pk is None and abertas:
        resultados = await _sem_finalizadas(ctx, resultados)

    return {"success": True, "results": resultados, "total": resposta.total}


async def _sem_finalizadas(ctx: AuthContext, ordens: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Tira da lista as OS que o técnico já finalizou — pedido explícito
    ("após finalizar a OS ela já some da lista"). op_date_finish do
    registro raiz (o que veio em "ordens") NUNCA reflete isso (fica
    sempre nulo, ver módulo acima) — o único jeito de saber é olhar o
    evento op_type=5 mais recente de cada OS em /support_ctl/op/list
    (mesmo endpoint do chat), pegando todos os tickets de uma vez em vez
    de uma chamada por OS.
    """
    tickets_pks = [o["ticket_pk"] for o in ordens if o.get("ticket_pk") is not None]
    if not tickets_pks:
        return ordens

    resposta = await ctx.controllr.call_api_post(
        "/support_ctl/op/list",
        corpo(where_in("ticket_pk", tickets_pks), sort="op_pk", dir="ASC"),
    )
    if not resposta.success:
        return ordens  # falhar aberto: melhor mostrar demais do que sumir com OS por engano

    # Ordenado por op_pk ASC — o último write para cada op_os_pk vence.
    ultimo_finish_por_os: dict[int, dict[str, Any]] = {}
    for evento in resposta.results:
        if evento.get("op_type") == 5 and evento.get("op_os_pk") is not None:
            ultimo_finish_por_os[evento["op_os_pk"]] = evento

    def finalizada(ordem: dict[str, Any]) -> bool:
        evento = ultimo_finish_por_os.get(ordem.get("op_pk"))
        return bool(evento and evento.get("op_date_finish"))

    return [o for o in ordens if not finalizada(o)]


class AcaoOSPayload(BaseModel):
    op_os_pk: int
    op_desc: str | None = None


# Os 4 estágios reais de uma OS (confirmado pelo usuário, dono da operação):
# 1. Agendamento — feito pelo escritório, já vem pronto (op_date_sched).
# 2. Respondida — o técnico "viu"/aceitou a OS (op_date_answer).
# 3. Iniciada — o técnico começou o atendimento (op_date_start).
# 4. Finalizada — o técnico terminou o atendimento (op_date_finish).
# Fechar a OS (op_date_close) é feito SÓ pelo escritório — essa permissão
# não é liberada para o técnico via ACL do Controllr, por isso não existe
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


class DesfazerEtapaPayload(BaseModel):
    op_os_pk: int
    op_desc: str


# undo_answer/undo_start/undo_finish — mesmo achado ao vivo que set_*,
# igualmente fora da doc oficial. Também exigem op_os_pk + op_desc
# (confirmado sondando o endpoint com corpo vazio: os dois vêm como
# "Required Field"). O jeito de saber se uma etapa está marcada ou não
# NÃO é o op_date_* do registro raiz da OS (que fica sempre nulo!) — é
# olhar para o evento mais recente daquele tipo (respondida/iniciada/
# finalizada) entre os registros de /support_ctl/op/list dessa OS: um
# set_* grava esse evento com a data preenchida, um undo_* grava outro
# evento do MESMO tipo só que com a data nula (confirmado comparando os
# dois registros criados ao vivo). Por isso o front usa
# listarMensagensTicket (mesmo endpoint do chat) para calcular o estágio
# de cada etapa, em vez de confiar em campo nenhum da OS em si.
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
