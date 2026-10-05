"""
O que a auditoria precisa saber do Controllr antes/depois de uma ação:
nome do cliente, como o endereço ou o telefone estava. Busca no próprio
Controllr (não confia no que a tela manda) e confere o número da linha — o
Controllr ignora filtro que não entende e devolve qualquer registro.

Falha aqui nunca impede a ação do técnico: sem resposta, a auditoria só fica
com menos detalhe.
"""

import logging
from typing import Any

from .deps import AuthContext
from .where import corpo, where_eq

logger = logging.getLogger(__name__)


def _mesmo(valor: Any, esperado: int) -> bool:
    try:
        return int(valor) == esperado
    except (TypeError, ValueError):
        return False


async def _linha(ctx: AuthContext, caminho: str, campo_where: str, campo_pk: str, pk: int, **extra: Any) -> dict[str, Any] | None:
    try:
        resposta = await ctx.controllr.call_api_post(caminho, corpo(where_eq(campo_where, pk), **extra))
        if resposta.success:
            return next((r for r in resposta.results if _mesmo(r.get(campo_pk), pk)), None)
    except Exception:
        logger.exception("Auditoria: não foi possível ler %s=%s em %s", campo_pk, pk, caminho)
    return None


async def nome_cliente(ctx: AuthContext, client_pk: int | None) -> str | None:
    if not client_pk:
        return None
    linha = await _linha(ctx, "/controllrctl/client/list", "client.client_pk", "client_pk", client_pk,
                         action="list", start=0, limit=5)
    return (linha or {}).get("client_complete_name") or None


async def endereco(ctx: AuthContext, address_pk: int) -> dict[str, Any] | None:
    return await _linha(ctx, "/controllrctl/addresses/list", "addresses.address_pk", "address_pk", address_pk,
                        action="list", start=0)


async def telefone(ctx: AuthContext, phone_pk: int) -> dict[str, Any] | None:
    return await _linha(ctx, "/controllrctl/phone/list", "client_phone.phone_pk", "phone_pk", phone_pk)


# ------------------------------------------------------------------ texto


def texto_endereco(e: dict[str, Any] | None) -> str | None:
    """"Rua X, 12 - Centro, Teresina/PI" a partir dos campos do Controllr."""
    if not e:
        return None
    rua = ", ".join(str(v) for v in (e.get("address"), e.get("address_number")) if v not in (None, ""))
    cidade = "/".join(str(v) for v in (e.get("address_province"), e.get("address_state")) if v not in (None, ""))
    partes = [p for p in (rua, e.get("address_neighborhood"), cidade) if p not in (None, "")]
    return " - ".join(str(p) for p in partes) or None


def texto_telefone(t: dict[str, Any] | None) -> str | None:
    if not t or not t.get("phone_number"):
        return None
    rotulo = t.get("phone_identification")
    return f"{rotulo}: {t['phone_number']}" if rotulo else str(t["phone_number"])


# Campos do endereço que aparecem como "antes → depois" na auditoria.
CAMPOS_ENDERECO = {
    "address": "Logradouro",
    "address_number": "Número",
    "address_neighborhood": "Bairro",
    "address_zipcode": "CEP",
    "address_province": "Cidade",
    "address_state": "UF",
    "address_completation": "Complemento",
    "address_identification": "Identificação",
}


def _igual(a: Any, b: Any) -> bool:
    return str(a if a is not None else "").strip() == str(b if b is not None else "").strip()


def alteracoes(antes: dict[str, Any] | None, depois: dict[str, Any], campos: dict[str, str]) -> list[dict[str, Any]]:
    """Só os campos enviados que mudaram, no formato que a tela de auditoria mostra.
    Sem o "antes" (Controllr não respondeu) não dá para saber o que mudou: vazio."""
    if not antes:
        return []
    lista = []
    for campo, rotulo in campos.items():
        if campo not in depois or depois[campo] is None:
            continue
        if _igual(antes.get(campo), depois[campo]):
            continue
        item = {"rotulo": rotulo, "depois": depois[campo]}
        if antes.get(campo) not in (None, ""):
            item["antes"] = antes[campo]
        lista.append(item)
    return lista


def localizacao(lat: Any, lon: Any) -> str | None:
    return f"{lat}, {lon}" if lat not in (None, "") and lon not in (None, "") else None
