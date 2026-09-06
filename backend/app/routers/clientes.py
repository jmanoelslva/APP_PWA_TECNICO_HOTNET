from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_ILIKE, corpo, where_and, where_eq

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
            {"field": "client_complete_name", "oper": OPER_ILIKE, "value": f"%{nome.strip()}%"},
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
        # "cpe.client_pk" (com prefixo), não "client_pk" puro — mesmo
        # padrão de ambiguidade já confirmado em client_list
        # ("client.client_pk") e addresses/list ("addresses.client_pk"):
        # cpe_list_combo também traz campos via join (client_complete_name,
        # dp_name, nas_name), então "client_pk" sozinho é ambíguo. Bare
        # "client_pk" aqui era o motivo do CPE nunca aparecer no detalhe
        # do cliente.
        cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("cpe.client_pk", client_pk), limit=20))
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
    # /controllrctl/addresses/list (NÃO list_combo) — confirmado na doc
    # oficial (apidoc.brbyte.com/#post-/controllrctl/addresses/list): só
    # esse endpoint completo traz address_siafi/latitude/longitude, que
    # o técnico precisa pra editar endereço/localização. list_combo
    # devolve só 5 campos (sem esses). Sem wrapper no brbyteapi vendorizado
    # (só tem list_combo) — chamada direta. Campo do "where" tem prefixo
    # "addresses." aqui (diferente de list_combo, que usa "client_pk" puro
    # — confirmado comparando os dois exemplos da doc oficial).
    enderecos_resp = await ctx.controllr.call_api_post(
        "/controllrctl/addresses/list", corpo(where_eq("addresses.client_pk", client_pk), action="list", start=0)
    )
    cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("client_pk", client_pk), limit=20))

    return {
        "success": True,
        "cliente": cliente_resp.results[0],
        "contratos": contratos_resp.results if contratos_resp.success else [],
        "enderecos": enderecos_resp.results if enderecos_resp.success else [],
        "cpes": cpes_resp.results if cpes_resp.success else [],
    }
