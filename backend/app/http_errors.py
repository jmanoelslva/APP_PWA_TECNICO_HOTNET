from typing import Any


def detalhe_erro(mensagem: str, resposta: Any) -> str:
    """
    Anexa o erro bruto devolvido pelo Controllr à mensagem de erro da
    API, em vez de expor só um "não foi possível..." genérico. `errors`
    vem de base.py::call_api_post (chave "errors" do JSON de resposta do
    Controllr).
    """
    detalhes = getattr(resposta, "errors", None)
    if detalhes:
        return f"{mensagem} Detalhe do Controllr: {detalhes}"
    return mensagem
