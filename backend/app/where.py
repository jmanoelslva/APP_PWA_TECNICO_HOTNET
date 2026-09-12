"""
Helper para o formato de filtro "where" do Controllr (mesmo formato usado
pelo app cliente, ver src/api/client.ts::whereJson do HOTNET_WEB_APP).

Tabela de operadores (apidoc.brbyte.com, seção "Parâmetro where", embutida
na descrição do openapi.yaml): 5 = OPER_EQUAL ("="), 7 = OPER_IS
("IS NULL/TRUE"), 8 = OPER_IS_NOT ("IS NOT NULL/TRUE"), 9 = OPER_LIKE
("valor%", sensível a maiúsculas), 10 = OPER_ILIKE ("%valor%", não
sensível — usado para busca por nome, com "%" montado pelo chamador),
21 = OPER_IN.
"""

import json
from typing import Any
from urllib.parse import urlencode

OPER_EQ = 5
OPER_ILIKE = 10
OPER_IN = 21
OPER_GTE = 4
OPER_LTE = 3
OPER_IS = 7
OPER_IS_NOT = 8


def where_json(condicoes: list[Any]) -> str:
    # separators sem espaço — mesmo formato que JSON.stringify gera no
    # navegador. json.dumps por padrão insere espaço depois de ":" e ",";
    # sem efeito no parsing (espaço é insignificante em JSON) já que tudo
    # passa por urlencode() (ver corpo() abaixo), só reduz o tamanho do
    # corpo.
    return json.dumps(condicoes, separators=(",", ":"))


def where_eq(field: str, value: Any) -> str:
    return where_json([{"field": field, "oper": OPER_EQ, "value": value}])


def where_ilike(field: str, valor_com_wildcards: str) -> str:
    return where_json([{"field": field, "oper": OPER_ILIKE, "value": valor_com_wildcards}])


def where_in(field: str, values: list[Any]) -> str:
    return where_json([{"field": field, "oper": OPER_IN, "value": values}])


def where_and(*condicoes: dict[str, Any] | list[Any]) -> str:
    """
    Combina condições com "AND" explícito entre cada uma (formato do
    Controllr: uma lista plana intercalando condição e {"field":"AND"}).
    Uma condição também pode ser uma LISTA (grupo aninhado) — usado para
    faixas de data, ex: [{">=", data1}, {"AND"}, {"<=", data2}] como um
    único "item" da combinação externa (ver historico_sessoes_cpe em
    routers/conexao.py).
    """
    combinado: list[Any] = []
    for i, condicao in enumerate(condicoes):
        if i > 0:
            combinado.append({"field": "AND"})
        combinado.append(condicao)
    return where_json(combinado)


def corpo(where: str | None = None, **campos: Any) -> str:
    """
    Monta o corpo application/x-www-form-urlencoded de uma chamada ao
    Controllr, com "where" (JSON) devidamente percent-encoded via
    urlencode() — nunca colar um "where={json}" cru dentro de um f-string
    de corpo. Um valor de LIKE com "%" (ex: "%termo%") sem encode corrompe
    o parsing do corpo no servidor (o "%te" não é hex válido), fazendo o
    Controllr ignorar o "where" inteiro e devolver a lista sem filtro
    nenhum. Aspas, chaves e colchetes do JSON também não são seguros crus
    num corpo desse tipo.
    """
    partes: dict[str, Any] = dict(campos)
    if where is not None:
        partes["where"] = where
    return urlencode(partes)
