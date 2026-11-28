"""Mensagens de erro do Controllr em português."""

from types import SimpleNamespace

import pytest

from app.http_errors import detalhe_erro, traduzir


@pytest.mark.parametrize("bruto,esperado", [
    ("Access Denied", "Seu usuário não tem permissão para isso no Controllr."),
    ("Duplicate port '14' (cpe_pk = 9)", "A porta 14 já está em uso por outra conexão."),
    ("Duplicate entry 'x' for key", "Já existe um cadastro igual no Controllr."),
    ("Invalid JSON after sanitization", "O Controllr respondeu de forma inesperada. Tente de novo."),
    ("Field op_desc is required", "Falta preencher um campo obrigatório."),
    ("Mensagem que ninguém conhece", "Mensagem que ninguém conhece"),
])
def test_traduzir(bruto, esperado):
    assert traduzir(bruto) == esperado


def test_detalhe_sem_lista_crua_e_sem_repeticao():
    resposta = SimpleNamespace(errors=[{"id": "-2", "msg": "Access Denied"}, {"id": "x", "msg": "Access denied"}])
    assert detalhe_erro("Não foi possível finalizar a OS.", resposta) == (
        "Não foi possível finalizar a OS. Seu usuário não tem permissão para isso no Controllr."
    )


def test_sem_erros_fica_so_a_mensagem():
    assert detalhe_erro("Não foi possível salvar.", SimpleNamespace(errors=[])) == "Não foi possível salvar."
