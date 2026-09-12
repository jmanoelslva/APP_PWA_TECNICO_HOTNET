from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..deps import AuthContext, get_auth_context
from ..http_errors import detalhe_erro
from ..where import OPER_EQ, OPER_ILIKE, corpo, where_and, where_eq

router = APIRouter(prefix="/clientes", tags=["clientes"])


def _somente_digitos(valor: str) -> str:
    return "".join(c for c in valor if c.isdigit())


async def _contratos_por_pk(ctx: AuthContext, contract_pks: set[int]) -> dict[int, dict[str, Any]]:
    # /controllrctl/contract/list filtrado por "client_pk" pode retornar
    # vazio mesmo para um cliente com contrato existente. Único filtro
    # confiável é por "contract_pk" (oper 5, "="), então cada contrato é
    # buscado individualmente em vez de um "client_pk=X" em lote.
    # "sign_url=true" é obrigatório para contract_sign_doc_link vir na
    # resposta — sem ele o campo some (não retorna null, some da chave).
    # "contract.contract_pk" usa o prefixo da tabela; "contract_pk" sem
    # prefixo também funciona neste endpoint.
    contratos: dict[int, dict[str, Any]] = {}
    for contract_pk in contract_pks:
        resposta = await ctx.controllr.contract_list(
            corpo(where_eq("contract.contract_pk", contract_pk), sign_url="true")
        )
        if resposta.success and resposta.results:
            contratos[contract_pk] = resposta.results[0]
    return contratos


async def _itens_contrato(ctx: AuthContext, contract_pk: int) -> list[dict[str, Any]]:
    # /controllrctl/contract/svclist não tem wrapper no brbyteapi
    # vendorizado — chamada direta. Filtro usa "item.contract_pk" (com
    # prefixo da tabela), mesmo padrão de ambiguidade de coluna em joins
    # já visto em client_pk/cpe_pk.
    resposta = await ctx.controllr.call_api_post(
        "/controllrctl/contract/svclist",
        corpo(where_eq("item.contract_pk", contract_pk), sort="contract_pk", dir="ASC"),
    )
    return resposta.results if resposta.success else []


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
        # client_status=0 = ativo — sem esse filtro, a busca por CPF/CNPJ
        # traz clientes desabilitados junto com os habilitados.
        condicoes_doc = where_and(
            {"field": "client_status", "oper": OPER_EQ, "value": 0},
            {"field": "client_doc1", "oper": OPER_EQ, "value": _somente_digitos(doc)},
        )
        resposta = await ctx.controllr.client_list(corpo(condicoes_doc, action="list", start=0, limit=10))
        if resposta.success:
            client_pks.update(int(r["client_pk"]) for r in resposta.results if r.get("client_pk"))

    if contrato:
        resposta = await ctx.controllr.contract_list(
            corpo(where_eq("contract_number", contrato), action="list", start=0, limit=10)
        )
        if resposta.success:
            client_pks.update(int(r["client_pk"]) for r in resposta.results if r.get("client_pk"))

    if nome:
        # oper 10 = ILIKE, valor com "%" embutido, combinado com
        # client_status=0 (só ativos) via "AND" explícito.
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
        # "aaa_cpe.client_pk" — nome real da tabela é "aaa_cpe", não "cpe".
        cliente = cliente_resp.results[0] if cliente_resp.success and cliente_resp.results else {}
        # Filtro final de "só habilitados", válido para qualquer caminho de
        # busca (doc/contrato/nome) — a busca por número de contrato não
        # tem como filtrar client_status direto na query (contract_list
        # não tem esse campo), então garante aqui, depois de já ter o
        # cadastro do cliente em mãos.
        if cliente.get("client_status") != 0:
            continue

        cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("aaa_cpe.client_pk", client_pk), limit=20))
        cpes = cpes_resp.results if cpes_resp.success else []

        # list_combo só traz contract_pk, não o número de contrato — mesmo
        # tratamento aplicado em detalhe_cliente.
        contract_pks = {cpe["contract_pk"] for cpe in cpes if cpe.get("contract_pk") is not None}
        contratos_por_pk = await _contratos_por_pk(ctx, contract_pks)
        for cpe in cpes:
            contrato = contratos_por_pk.get(cpe.get("contract_pk"))
            if contrato:
                cpe["contract_number"] = contrato.get("contract_number")

        resultados.append({
            "client_pk": client_pk,
            "cliente": cliente,
            "cpes": cpes,
        })

    return {"success": True, "results": resultados}


@router.get("/{client_pk}")
async def detalhe_cliente(client_pk: int, ctx: AuthContext = Depends(get_auth_context)) -> dict[str, Any]:
    # "client.client_pk" (com prefixo da tabela) — "client_pk" sozinho é
    # ambíguo numa query com joins.
    cliente_resp = await ctx.controllr.client_list(
        corpo(where_eq("client.client_pk", client_pk), action="list", start=0, limit=1)
    )
    if not cliente_resp.success or not cliente_resp.results:
        raise HTTPException(status_code=404, detail=detalhe_erro("Cliente não encontrado.", cliente_resp))

    # /controllrctl/addresses/list (não list_combo) — doc oficial em
    # apidoc.brbyte.com/#post-/controllrctl/addresses/list. Só esse
    # endpoint completo traz address_siafi/latitude/longitude, necessários
    # para editar endereço/localização; list_combo devolve só 5 campos.
    # Sem wrapper no brbyteapi vendorizado (só tem list_combo) — chamada
    # direta. O "where" usa prefixo "addresses." aqui, diferente de
    # list_combo (que usa "client_pk" sem prefixo).
    enderecos_resp = await ctx.controllr.call_api_post(
        "/controllrctl/addresses/list", corpo(where_eq("addresses.client_pk", client_pk), action="list", start=0)
    )
    # "aaa_cpe.client_pk" — nome real da tabela é "aaa_cpe".
    cpes_resp = await ctx.controllr.cpe_list_combo(corpo(where_eq("aaa_cpe.client_pk", client_pk), limit=20))
    cpes = cpes_resp.results if cpes_resp.success else []

    # /aaa_ctl/cpe/list_combo só traz contract_pk, não o número de
    # contrato que o técnico reconhece (ex: "1024"). Completa buscando
    # cada contrato individualmente (ver _contratos_por_pk).
    contract_pks = {cpe["contract_pk"] for cpe in cpes if cpe.get("contract_pk") is not None}
    contratos_por_pk = await _contratos_por_pk(ctx, contract_pks)
    for cpe in cpes:
        contrato = contratos_por_pk.get(cpe.get("contract_pk"))
        if contrato:
            cpe["contract_number"] = contrato.get("contract_number")

    # Itens do contrato (planos/equipamentos cobrados), anexados a cada
    # contrato como "itens".
    for contract_pk, contrato in contratos_por_pk.items():
        contrato["itens"] = await _itens_contrato(ctx, contract_pk)

    # Telefone é recurso próprio do Controllr (/controllrctl/phone/*), não
    # um campo solto do cliente — client_phones (client/list) é só um
    # resumo "Rótulo#-#número" sem phone_pk, sem uso para editar. Busca os
    # registros de verdade para permitir edição (ver routers/telefones.py).
    # Nome real da tabela é "client_phone" (singular, com prefixo) — sem
    # prefixo a coluna é ambígua, mesmo padrão visto em client_pk/cpe_pk.
    telefones_resp = await ctx.controllr.phone_list(
        corpo(where_eq("client_phone.client_pk", client_pk), sort="phone_pk", dir="ASC")
    )

    return {
        "success": True,
        "cliente": cliente_resp.results[0],
        # A seção "Contratos" lista um contrato por contract_pk distinto
        # entre as CPEs do cliente — não há como listar todos os contratos
        # do cliente diretamente (ver _contratos_por_pk). Um contrato sem
        # CPE vinculada não é relevante para o técnico de campo.
        "contratos": list(contratos_por_pk.values()),
        "enderecos": enderecos_resp.results if enderecos_resp.success else [],
        "cpes": cpes,
        "telefones": telefones_resp.results if telefones_resp.success else [],
    }
