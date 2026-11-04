from app.routers.clientes import _variantes_documento


def test_variantes_documento_cpf_e_cnpj():
    assert _variantes_documento("12345678900") == ["12345678900", "123.456.789-00"]
    assert _variantes_documento("12345678000190") == ["12345678000190", "12.345.678/0001-90"]


def test_trecho_de_documento_vai_sem_mascara():
    assert _variantes_documento("026906") == ["026906"]
