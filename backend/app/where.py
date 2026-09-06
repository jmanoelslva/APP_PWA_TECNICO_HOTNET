"""
Helper pro formato de filtro "where" do Controllr (mesmo formato usado
pelo app cliente, ver src/api/client.ts::whereJson do HOTNET_WEB_APP).

Só os operadores abaixo foram confirmados (comentários do app cliente e
do próprio pacote brbyteapi): 5 = "=", 21 = "IN". Qualquer filtro por
"contém"/"like" precisa ser validado contra a documentação oficial
(apidoc.brbyte.com) antes de usar um código de operador — por enquanto,
buscas por texto livre (nome) são feitas trazendo uma página e filtrando
em memória, ver clientes.py.
"""

import json
from typing import Any

OPER_EQ = 5
OPER_IN = 21


def where_json(condicoes: list[dict[str, Any]]) -> str:
    return json.dumps(condicoes)


def where_eq(field: str, value: Any) -> str:
    return where_json([{"field": field, "oper": OPER_EQ, "value": value}])


def where_in(field: str, values: list[Any]) -> str:
    return where_json([{"field": field, "oper": OPER_IN, "value": values}])
