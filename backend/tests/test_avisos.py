"""Avisos de OS nova: inscrição, texto, detecção de OS nova e envio."""

import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import avisos, vigia_os
from app.sessions import TechnicianSession

CELULAR = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "chave", "auth": "segredo"}}


@pytest.fixture
def dados(tmp_path, monkeypatch):
    monkeypatch.setattr(avisos, "AVISOS_DADOS_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def enviados(monkeypatch):
    lista = []

    async def falso(subscription_info, data, **kwargs):
        lista.append((subscription_info["endpoint"], data))

    monkeypatch.setattr(avisos, "webpush_async", falso)
    return lista


def os_(pk, tecnico, **extra):
    return {"op_pk": pk, "ticket_pk": pk * 10, "staff_username": tecnico, "task_name": "Instalação",
            "address_neighborhood": "Centro ", "op_date_sched": "2026-10-05 14:00:00", **extra}


def test_texto_sem_nome_do_cliente():
    agora = datetime(2026, 10, 5, 9, 0)
    aviso = avisos.texto_os(os_(7, "anderson", client_complete_name="Maria"), agora)
    assert aviso == {"titulo": "Nova OS", "corpo": "Instalação — Centro, hoje 14:00", "url": "/os/70", "tag": "os-7"}
    assert "Maria" not in str(aviso)
    assert avisos.texto_os(os_(7, "a", op_date_sched="2026-10-06 08:30:00"), agora)["corpo"].endswith("amanhã 08:30")
    assert avisos.texto_os(os_(7, "a", op_date_sched="2026-10-09 08:30:00"), agora)["corpo"].endswith("09/10 08:30")
    assert avisos.texto_os({"op_pk": 1, "op_desc": "Visita"}, agora)["corpo"] == "Visita"


def test_inscricao_um_celular_fica_com_um_tecnico(dados):
    avisos.inscrever("Anderson", CELULAR)
    assert len(avisos.inscricoes_de("anderson")) == 1
    avisos.inscrever("maria", CELULAR)  # outra pessoa entrou no mesmo celular
    assert avisos.inscricoes_de("anderson") == [] and len(avisos.inscricoes_de("maria")) == 1
    avisos.remover(CELULAR["endpoint"], "anderson")  # não é dele: nada muda
    assert len(avisos.inscricoes_de("maria")) == 1
    avisos.remover(CELULAR["endpoint"], "maria")
    assert avisos.inscricoes_de("maria") == []


def test_primeira_vez_so_memoriza_depois_avisa_as_novas(dados, enviados):
    avisos.inscrever("anderson", CELULAR)
    assert asyncio.run(vigia_os.verificar([os_(1, "anderson"), os_(2, "maria")])) == 0
    assert enviados == []
    # Volta seguinte: a 3 é nova para o Anderson; a 2 passou da Maria para ele.
    n = asyncio.run(vigia_os.verificar([os_(1, "anderson"), os_(2, "Anderson"), os_(3, "anderson"), os_(4, "maria")]))
    assert n == 2 and [e[0] for e in enviados] == [CELULAR["endpoint"]] * 2
    assert '"tag": "os-2"' in enviados[0][1] and '"tag": "os-3"' in enviados[1][1]
    # Nada novo: nenhum aviso.
    assert asyncio.run(vigia_os.verificar([os_(1, "anderson"), os_(2, "anderson"), os_(3, "anderson")])) == 0


def test_muitas_novas_de_uma_vez_viram_um_aviso(dados, enviados):
    avisos.inscrever("anderson", CELULAR)
    asyncio.run(vigia_os.verificar([]))
    assert asyncio.run(vigia_os.verificar([os_(pk, "anderson") for pk in range(1, 6)])) == 1
    assert "5 OS novas" in enviados[0][1]


def test_celular_que_nao_existe_mais_sai_da_lista(dados, monkeypatch):
    async def gone(**kwargs):
        raise avisos.WebPushException("gone", response=SimpleNamespace(status=410))

    monkeypatch.setattr(avisos, "webpush_async", lambda **k: gone(**k))
    avisos.inscrever("anderson", CELULAR)
    assert asyncio.run(avisos.enviar_para("anderson", {"titulo": "x"})) == 0
    assert avisos.inscricoes_de("anderson") == []


@pytest.fixture
def cliente(dados, enviados, monkeypatch):
    from app.deps import get_current_session
    from app.main import app

    monkeypatch.setattr(vigia_os, "configurado", lambda: True)
    app.dependency_overrides[get_current_session] = lambda: TechnicianSession("s", "Anderson", "c", 1, 0)
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_rotas_ligar_e_desligar(cliente, enviados):
    # Ao abrir o app (reassociar o celular): sem aviso de confirmação.
    assert cliente.post("/avisos/inscricao", json=CELULAR).json() == {"success": True}
    assert len(avisos.inscricoes_de("anderson")) == 1 and enviados == []
    # Ao ligar no interruptor: aviso de confirmação na hora, sem duplicar a inscrição.
    assert cliente.post("/avisos/inscricao", json={**CELULAR, "confirmar": True}).json() == {"success": True}
    assert len(avisos.inscricoes_de("anderson")) == 1
    assert "confirmar" not in avisos.inscricoes_de("anderson")[0]
    assert "Avisos de OS ativados" in enviados[0][1]
    assert cliente.post("/avisos/remover", json={"endpoint": CELULAR["endpoint"]}).json() == {"success": True}
    assert avisos.inscricoes_de("anderson") == []


@pytest.mark.parametrize("endpoint", [
    "http://fcm.googleapis.com/x",               # sem https
    "https://servidor-interno.local/x",          # não é serviço de push
    "https://fcm.googleapis.com.evil.com/x",     # imitação
    "https://127.0.0.1/x",
])
def test_so_aceita_servicos_de_push(cliente, endpoint):
    r = cliente.post("/avisos/inscricao", json={**CELULAR, "endpoint": endpoint})
    assert r.status_code == 400
    assert avisos.inscricoes_de("anderson") == []
