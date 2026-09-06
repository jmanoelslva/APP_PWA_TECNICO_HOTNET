"""
Helper pro formato de filtro "where" do Controllr (mesmo formato usado
pelo app cliente, ver src/api/client.ts::whereJson do HOTNET_WEB_APP).

Operadores confirmados: 5 = "=", 10 = "LIKE" (valor já vem com "%" pelo
chamador, ex: "%eronildes%" — confirmado capturando uma busca por nome
real no próprio painel web do Controllr via DevTools), 21 = "IN".
"""

import json
from typing import Any
from urllib.parse import urlencode

OPER_EQ = 5
OPER_LIKE = 10
OPER_IN = 21


def where_json(condicoes: list[dict[str, Any]]) -> str:
    # separators sem espaço — igual ao que o próprio navegador gera via
    # JSON.stringify (formato exato confirmado capturando um request real
    # do painel web do Controllr no DevTools). json.dumps por padrão
    # insere espaço depois de ":" e "," — inofensivo pra um parser JSON
    # de verdade (espaço é insignificante no JSON), mas sem necessidade
    # já que agora tudo passa por urlencode() de qualquer forma (ver
    # corpo() abaixo) — só reduz o tamanho do corpo e bate 1:1 com o
    # formato já confirmado funcionar.
    return json.dumps(condicoes, separators=(",", ":"))


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


def corpo(where: str | None = None, **campos: Any) -> str:
    """
    Monta o corpo application/x-www-form-urlencoded de uma chamada ao
    Controllr, com "where" (JSON) devidamente percent-encoded via
    urlencode() — NUNCA colar um "where={json}" cru dentro de um f-string
    de corpo. Bug real confirmado: um valor de LIKE como "%eronildes%"
    colado sem encode faz o "%er" (não é hex válido) corromper o parsing
    do corpo no servidor, que aí ignora o "where" inteiro e devolve uma
    lista sem filtro nenhum (sintoma: busca por nome trazendo OUTROS
    cadastros, nunca o procurado). Aspas, chaves e colchetes do JSON
    também não são seguros crus num corpo desse tipo, mesmo quando "por
    sorte" não quebravam antes (valores só numéricos, sem "%"/"&"/"=").
    """
    partes: dict[str, Any] = dict(campos)
    if where is not None:
        partes["where"] = where
    return urlencode(partes)
