"""Busca de ONU por PPPoE: só o PPPoE exato (a do Controllr é por trecho)."""

from types import SimpleNamespace

from app.routers.onu import pppoe_igual


def onu(pppoe=None, cpe_username=None):
    return SimpleNamespace(wancfg_pppoe_username=pppoe, cpe_username=cpe_username)


def test_trecho_do_pppoe_nao_vale():
    # Caso real de 06/11: um PPPoE contido em outro trazia a ONU errada.
    assert not pppoe_igual(onu("mariasilva@x"), "silva@x")
    assert pppoe_igual(onu("silva@x"), "silva@x")


def test_sem_diferenciar_maiusculas_e_espacos():
    assert pppoe_igual(onu("Silva@X "), " silva@x")


def test_sem_pppoe_na_onu_usa_o_da_conexao():
    assert pppoe_igual(onu(None, "silva@x"), "silva@x")
    assert not pppoe_igual(onu("", "mariasilva@x"), "silva@x")
    assert not pppoe_igual(onu(), "silva@x")
