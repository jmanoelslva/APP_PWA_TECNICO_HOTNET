"""Consulta de CEP (ViaCEP) usada na edição de endereço."""

from app.routers.ferramentas import normalizar_viacep


def test_cep_completo_vira_campos_do_controllr():
    dados = {
        "cep": "57000-000",
        "logradouro": "Rua do Comércio",
        "bairro": "Centro",
        "localidade": "Maceió",
        "uf": "AL",
        "siafi": "2785",
    }
    assert normalizar_viacep(dados) == {
        "address": "Rua do Comércio",
        "address_neighborhood": "Centro",
        "address_province": "Maceió",
        "address_state": "AL",
        "address_siafi": 2785,
    }


def test_cep_geral_de_cidade_nao_apaga_logradouro():
    dados = {"logradouro": "", "bairro": " ", "localidade": "Japaratuba", "uf": "SE", "siafi": ""}
    resultado = normalizar_viacep(dados)
    assert resultado is not None
    assert resultado["address"] is None
    assert resultado["address_neighborhood"] is None
    assert resultado["address_siafi"] is None
    assert resultado["address_province"] == "Japaratuba"


def test_cep_inexistente():
    assert normalizar_viacep({"erro": True}) is None
    assert normalizar_viacep({"erro": "true"}) is None
    assert normalizar_viacep({}) is None
