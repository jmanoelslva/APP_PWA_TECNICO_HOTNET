from app.routers.clientes import _mesmo_contrato, _variantes_documento


def test_variantes_documento_cpf_e_cnpj():
    assert _variantes_documento("12345678900") == ["12345678900", "123.456.789-00"]
    assert _variantes_documento("12345678000190") == ["12345678000190", "12.345.678/0001-90"]
    assert _variantes_documento("123") == ["123"]


def test_mesmo_contrato_ignora_zeros_a_esquerda():
    assert _mesmo_contrato("026906", "26906")
    assert _mesmo_contrato(26906, "026906")
    assert not _mesmo_contrato("126906", "26906")
    assert not _mesmo_contrato(None, "26906")
