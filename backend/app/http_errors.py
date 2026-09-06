from typing import Any


def detalhe_erro(mensagem: str, resposta: Any) -> str:
    """
    Anexa o erro bruto devolvido pelo Controllr à mensagem de erro da
    nossa API — sem isso, qualquer falha (campo/operador de "where"
    errado, tipo incompatível, etc.) só aparecia como "não foi
    possível..." genérico, exigindo acesso ao log do servidor
    (journalctl) pra descobrir o motivo real. `errors` vem de
    base.py::call_api_post (chave "errors" do JSON de resposta do
    Controllr).
    """
    detalhes = getattr(resposta, "errors", None)
    if detalhes:
        return f"{mensagem} Detalhe do Controllr: {detalhes}"
    return mensagem
