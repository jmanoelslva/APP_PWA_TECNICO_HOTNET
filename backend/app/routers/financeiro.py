"""
Financeiro do cliente — faturas (cobranças) e pagamentos em observação.

"Pagamento em observação" é um recurso do Controllr: uma anotação presa
a uma fatura que suspende as consequências de um atraso (ex: bloqueio
automático) até uma data ou por um período em dias, enquanto o cliente
negocia o pagamento (Financeiro > Cobranças > Pagamentos em observação
no painel).

O acesso é decidido pelo Controllr: cada rota repassa o 403 "Access
Denied" que a chamada real devolve quando o técnico não tem liberação
de ACL para o módulo financeiro (mesmo padrão do fechamento de OS).

Nomes de campo não documentados na doc oficial:
- `/invoice_ctl/invoice/list`: filtro por cliente é `client.client_pk`
  (com prefixo — mesmo padrão de coluna ambígua de outros endpoints, ver
  CONTROLLR_API_NOTES.md seção 2). Cada fatura já traz `obs_pk`/
  `obs_date_end` quando está em observação, sem precisar de outra chamada.
- `/invoice_ctl/observation/create`: campos do formulário ("Pagamentos
  em observação" > "Novo") são `client_pk`, `contract_pk`, `invoice_pk`,
  `obs_release_type` (0 = Data de Validade, usa `obs_date_end`; 1 =
  Período, usa `obs_period` em dias), `obs_status` (0 = habilitado,
  qualquer outro valor = desabilitado) e `obs_text` (a observação).
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_IS, corpo as montar_corpo, where_and

router = APIRouter(prefix="/financeiro", tags=["financeiro"])


@router.get("/faturas")
async def listar_faturas(
    client_pk: int = Query(...),
    start: int = Query(default=0),
    limit: int = Query(default=30),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
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
    # Exatamente um dos dois — corresponde ao campo "Liberar Tipo" do
    # painel (obs_release_date = "Data de Validade", obs_period_dias =
    # "Período").
    obs_release_date: str | None = None
    obs_period_dias: int | None = None


@router.post("/observacoes")
async def criar_observacao(payload: ObservacaoPayload, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
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
        # 0 = habilitado; qualquer outro valor = desabilitado.
        obs_status=0,
        obs_text=payload.obs_text,
        **campos_liberacao,
    )
    resposta = await ctx.controllr.observation_create(corpo)
    if resposta.status == 403:
        raise HTTPException(status_code=403, detail="Técnico sem liberação de ACL para o módulo financeiro.")
    if not resposta.success:
        raise HTTPException(status_code=400, detail=detalhe_erro("Não foi possível registrar a observação.", resposta))
    return {"success": True, "results": resposta.results}
