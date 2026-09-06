"""
Helper pro formato de filtro "where" do Controllr (mesmo formato usado
pelo app cliente, ver src/api/client.ts::whereJson do HOTNET_WEB_APP).

Operadores confirmados: 5 = "=", 10 = "LIKE" (valor já vem com "%" pelo
chamador, ex: "%eronildes%" — confirmado capturando uma busca por nome
real no próprio painel web do Controllr via DevTools), 21 = "IN".
"""

import json
from typing import Any

OPER_EQ = 5
OPER_LIKE = 10
OPER_IN = 21


def where_json(condicoes: list[dict[str, Any]]) -> str:
    return json.dumps(condicoes)


def where_eq(field: str, value: Any) -> str:
    return where_json([{"field": field, "oper": OPER_EQ, "value": value}])


def where_like(field: str, valor_com_wildcards: str) -> str:
    return where_json([{"field": field, "oper": OPER_LIKE, "value": valor_com_wildcards}])


def where_in(field: str, values: list[Any]) -> str:
    return where_json([{"field": field, "oper": OPER_IN, "value": values}])


def where_and(*condicoes: dict[str, Any]) -> str:
    """Combina condições com "AND" explícito entre cada uma (formato do Controllr: uma lista plana intercalando condição e {"field":"AND"})."""
    combinado: list[dict[str, Any]] = []
    for i, condicao in enumerate(condicoes):
        if i > 0:
            combinado.append({"field": "AND"})
        combinado.append(condicao)
    return where_json(combinado)
