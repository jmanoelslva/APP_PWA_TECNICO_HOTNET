import re
from typing import Any

# Mensagens do Controllr (em inglês ou cruas) traduzidas para o técnico.
# O que não casar com nenhum padrão aparece como veio, sem o formato de
# lista do Python (antes: "Detalhe do Controllr: [{'id': ..., 'msg': ...}]").
_TRADUCOES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"access denied", re.I), "Seu usuário não tem permissão para isso no Controllr."),
    # Formato real: "Duplicate port '14' (cpe_pk = N)" (CONTROLLR_API_NOTES.md).
    (re.compile(r"duplicate port '?(\d+)'?", re.I), "A porta {0} já está em uso por outra conexão."),
    (re.compile(r"duplicate", re.I), "Já existe um cadastro igual no Controllr."),
    (re.compile(r"invalid json", re.I), "O Controllr respondeu de forma inesperada. Tente de novo."),
    (re.compile(r"not found", re.I), "Registro não encontrado no Controllr."),
    (re.compile(r"\brequired\b", re.I), "Falta preencher um campo obrigatório."),
    (re.compile(r"unauthori[sz]ed|not logged", re.I), "Sua sessão no Controllr expirou. Entre de novo."),
    (re.compile(r"timeout|timed out", re.I), "O Controllr demorou para responder. Tente de novo."),
]


def traduzir(msg: str) -> str:
    texto = msg.strip()
    for padrao, traducao in _TRADUCOES:
        achado = padrao.search(texto)
        if achado:
            return traducao.format(*achado.groups())
    return texto


def _mensagens(detalhes: Any) -> list[str]:
    itens = detalhes if isinstance(detalhes, list) else [detalhes]
    vistas: list[str] = []
    for item in itens:
        bruto = item.get("msg") if isinstance(item, dict) else item
        if bruto is None or str(bruto).strip() == "":
            continue
        texto = traduzir(str(bruto))
        if texto not in vistas:
            vistas.append(texto)
    return vistas


def detalhe_erro(mensagem: str, resposta: Any) -> str:
    """
    Junta à mensagem do app o motivo devolvido pelo Controllr, em
    português quando conhecido (ver _TRADUCOES). `errors` vem de
    base.py::call_api_post (chave "errors" do JSON de resposta do
    Controllr).
    """
    motivos = _mensagens(getattr(resposta, "errors", None))
    if motivos:
        return f"{mensagem} {' '.join(motivos)}"
    return mensagem
