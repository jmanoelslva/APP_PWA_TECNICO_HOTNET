from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_LIKE, corpo, where_and, where_eq

router = APIRouter(prefix="/clientes", tags=["clientes"])


def _somente_digitos(valor: str) -> str:
    return "".join(c for c in valor if c.isdigit())


@router.get("/busca")
async def buscar_clientes(
    doc: str | None = Query(default=None, description="CPF/CNPJ do cliente"),
    contrato: int | None = Query(default=None, description="Número do contrato"),
    nome: str | None = Query(default=None, description="Nome/razão social (busca parcial)"),
    ctx: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    if not doc and not contrato and not nome:
        raise HTTPException(status_code=400, detail="Informe ao menos um filtro: doc, contrato ou nome.")

    client_pks: set[int] = set()

    if doc:
        resposta = await ctx.controllr.client_list(
            corpo(where_eq("client_doc1", _somente_digitos(doc)), action="list", start=0, limit=10)
        )
        if resposta.success:
            client_pks.update(int(r["client_pk"]) for r in resposta.results if r.get("client_pk"))

    if contrato:
        resposta = await ctx.controllr.contract_list(
            corpo(where_eq("contract_number", contrato), action="list", start=0, limit=10)
        )
        if resposta.success:
            client_pks.update(int(r["client_pk"]) for r in resposta.results if r.get("client_pk"))

    if nome:
        # Formato confirmado capturando uma busca por nome real no painel
        # web do próprio Controllr (DevTools): oper 10 = LIKE, valor com
        # "%" embutido, combinado com client_status=0 (só ativos) via
        # "AND" explícito — sem isso (só "limit" sem "where" nenhum) a
        # chamada voltava vazia mesmo com cliente cadastrado.
        condicoes = where_and(
            {"field": "client_status", "oper": OPER_EQ, "value": 0},
            {"field": "client_complete_name", "oper": OPER_LIKE, "value": f"%{nome.strip()}%"},
        )
        resposta = await ctx.controllr.client_list(
            corpo(condicoes, page=1, start=0, limit=15, sort="client_complete_name", dir="ASC")
        )
        if resposta.success:
            for registro in resposta.results:
                if registro.get("client_pk"):
                    client_pks.add(int(registro["client_pk"]))

    resultados = []
    for client_pk in client_pks:
        cliente_resp = await ctx.controllr.client_list(
            corpo(where_eq("client.client_pk", client_pk), action="list", start=0, limit=1)
        )
        cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("client_pk", client_pk), limit=20))
        cliente = cliente_resp.results[0] if cliente_resp.success and cliente_resp.results else {}
        resultados.append({
            "client_pk": client_pk,
            "cliente": cliente,
            "cpes": cpes_resp.results if cpes_resp.success else [],
        })

    return {"success": True, "results": resultados}


@router.get("/{client_pk}")
async def detalhe_cliente(client_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    # "client.client_pk" (com prefixo da tabela), não "client_pk" puro —
    # confirmado no próprio pacote brbyteapi
    # (controllr/client.py::set_client_category_pk), provavelmente porque
    # "client_pk" sozinho é ambíguo numa query com joins.
    cliente_resp = await ctx.controllr.client_list(
        corpo(where_eq("client.client_pk", client_pk), action="list", start=0, limit=1)
    )
    if not cliente_resp.success or not cliente_resp.results:
        raise HTTPException(status_code=404, detail=detalhe_erro("Cliente não encontrado.", cliente_resp))

    contratos_resp = await ctx.controllr.contract_list(
        corpo(where_eq("client_pk", client_pk), action="list", start=0)
    )
    enderecos_resp = await ctx.controllr.address_list_combo(corpo(where_eq("client_pk", client_pk)))
    cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("client_pk", client_pk), limit=20))

    return {
        "success": True,
        "cliente": cliente_resp.results[0],
        "contratos": contratos_resp.results if contratos_resp.success else [],
        "enderecos": enderecos_resp.results if enderecos_resp.success else [],
        "cpes": cpes_resp.results if cpes_resp.success else [],
    }
