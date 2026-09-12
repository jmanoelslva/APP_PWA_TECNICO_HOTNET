"""
Financeiro do cliente — faturas (cobranças) e pagamentos em observação.

"Pagamento em observação" é um recurso próprio do Controllr: uma anotação
presa a uma fatura específica que suspende as consequências de um atraso
(ex: bloqueio automático) até uma data ou por um período em dias, enquanto
o cliente negocia o pagamento — visto ao vivo no painel real em
Financeiro > Cobranças > Pagamentos em observação.

Tela só aparece no app para quem tem a liberação de ACL correspondente
(ver auth.py::_verificar_liberacao_financeiro) — este router não decide
isso sozinho: cada rota confere `ctx.session.financeiro_liberado` (já
resolvido no login) e, mesmo assim, repassa fielmente qualquer 403 que o
próprio Controllr devolver na hora, caso a liberação mude no meio de uma
sessão já aberta.

Nomes de campo confirmados ao vivo (não documentados na doc oficial),
capturando os grids reais do painel Controllr via Ext.ComponentQuery:
- `/invoice_ctl/invoice/list`: filtro por cliente é `client.client_pk`
  (com prefixo — mesmo bug de coluna ambígua de outros endpoints, ver
  CONTROLLR_API_NOTES.md seção 2). Cada fatura já traz `obs_pk`/
  `obs_date_end` quando está em observação, sem precisar de outra chamada.
- `/invoice_ctl/observation/create`: campos do formulário real
  ("Pagamentos em observação" > "Novo") são `client_pk`, `contract_pk`,
  `invoice_pk`, `obs_release_type` (0 = Data de Validade, usa
  `obs_date_end`; 1 = Período, usa `obs_period` em dias), `obs_status`
  (1 = habilitado) e `obs_text` (a observação em si).
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_IS, corpo as montar_corpo, where_and

router = APIRouter(prefix="/financeiro", tags=["financeiro"])


def _garantir_liberacao(ctx: AuthContext) -> None:
    if not ctx.session.financeiro_liberado:
        raise HTTPException(status_code=403, detail="Técnico sem liberação de ACL para o módulo financeiro.")


@router.get("/faturas")
async def listar_faturas(
    client_pk: int = Query(...),
    start: int = Query(default=0),
    limit: int = Query(default=30),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _garantir_liberacao(ctx)
    where = where_and(
        {"field": "client.client_pk", "oper": OPER_EQ, "value": client_pk},
        {"field": "invoice_deleted", "oper": OPER_IS, "value": False},
    )
    resposta = await ctx.controllr.invoice_list(
        montar_corpo(where, start=start, limit=limit, sort="invoice_date_due", dir="DESC")
    )
    if resposta.status == 403:
        raise HTTPException(status_code=403, detail="Técnico sem liberação de ACL para o módulo financeiro.")
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível listar as faturas.", resposta))
    return {"success": True, "results": resposta.results, "total": resposta.total}


class ObservacaoPayload(BaseModel):
    client_pk: int
    contract_pk: int
    invoice_pk: int
    obs_text: str
    # Exatamente um dos dois — o mesmo par "Liberar Tipo" do formulário
    # real do painel (obs_release_date = "Data de Validade", obs_period_dias
    # = "Período").
    obs_release_date: str | None = None
    obs_period_dias: int | None = None


@router.post("/observacoes")
async def criar_observacao(payload: ObservacaoPayload, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    _garantir_liberacao(ctx)

    if payload.obs_release_date:
        campos_liberacao: dict[str, Any] = {"obs_release_type": 0, "obs_date_end": payload.obs_release_date}
    elif payload.obs_period_dias:
        campos_liberacao = {"obs_release_type": 1, "obs_period": payload.obs_period_dias}
    else:
        raise HTTPException(status_code=400, detail="Informe a data de liberação ou o período em dias.")

    corpo = montar_corpo(
        None,
        client_pk=payload.client_pk,
        contract_pk=payload.contract_pk,
        invoice_pk=payload.invoice_pk,
        obs_status=1,
        obs_text=payload.obs_text,
        **campos_liberacao,
    )
    resposta = await ctx.controllr.observation_create(corpo)
    if resposta.status == 403:
        raise HTTPException(status_code=403, detail="Técnico sem liberação de ACL para o módulo financeiro.")
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível registrar a observação.", resposta))
    return {"success": True, "results": resposta.results}
