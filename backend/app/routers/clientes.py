from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import where_eq

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
            f"action=list&start=0&where={where_eq('client_doc1', _somente_digitos(doc))}&limit=10"
        )
        if resposta.success:
            client_pks.update(int(r["client_pk"]) for r in resposta.results if r.get("client_pk"))

    if contrato:
        resposta = await ctx.controllr.contract_list(
            f"action=list&start=0&where={where_eq('contract_number', contrato)}&limit=10"
        )
        if resposta.success:
            client_pks.update(int(r["client_pk"]) for r in resposta.results if r.get("client_pk"))

    if nome:
        # Sem operador "LIKE" confirmado na API (ver app/where.py) — traz
        # uma página e filtra em memória pelo nome. "action=list&start=0"
        # aqui é OBRIGATÓRIO mesmo sem "where" (confirmado: uma chamada só
        # com "limit" e sem esses dois campos voltava vazia mesmo
        # existindo cliente cadastrado) — mesmo padrão usado pelo app
        # cliente de referência (src/api/client.ts) em toda chamada a
        # controllrctl/*/list.
        resposta = await ctx.controllr.client_list("action=list&start=0&limit=200")
        if resposta.success:
            alvo = nome.strip().lower()
            for registro in resposta.results:
                candidatos = " ".join(
                    str(registro.get(campo, ""))
                    for campo in ("client_name", "client_lastname", "client_complete_name")
                ).lower()
                if alvo in candidatos and registro.get("client_pk"):
                    client_pks.add(int(registro["client_pk"]))

    resultados = []
    for client_pk in client_pks:
        cliente_resp = await ctx.controllr.client_list(
            f"action=list&start=0&where={where_eq('client.client_pk', client_pk)}&limit=1"
        )
        cpes_resp = await ctx.controllr.cpe_list_combo(f"where={where_eq('client_pk', client_pk)}&limit=20")
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
    # "client_pk" sozinho é ambíguo numa query com joins. Bare "client_pk"
    # aqui devolvia sempre vazio (bug real reportado: busca por CPF achava
    # o client_pk certo, mas abrir o detalhe dava "cliente não
    # encontrado").
    cliente_resp = await ctx.controllr.client_list(
        f"action=list&start=0&where={where_eq('client.client_pk', client_pk)}&limit=1"
    )
    if not cliente_resp.success or not cliente_resp.results:
        raise HTTPException(status_code=404, detail=detalhe_erro("Cliente não encontrado.", cliente_resp))

    contratos_resp = await ctx.controllr.contract_list(
        f"action=list&start=0&where={where_eq('client_pk', client_pk)}"
    )
    enderecos_resp = await ctx.controllr.address_list_combo(f"where={where_eq('client_pk', client_pk)}")
    cpes_resp = await ctx.controllr.cpe_list_combo(f"where={where_eq('client_pk', client_pk)}&limit=20")

    return {
        "success": True,
        "cliente": cliente_resp.results[0],
        "contratos": contratos_resp.results if contratos_resp.success else [],
        "enderecos": enderecos_resp.results if enderecos_resp.success else [],
        "cpes": cpes_resp.results if cpes_resp.success else [],
    }
