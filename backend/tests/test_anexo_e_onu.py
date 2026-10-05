"""Anexo de chamado servido com segurança e associação de ONU à conexão certa."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.sessions import TechnicianSession


def sessao():
    return TechnicianSession(session_id="s", username="joao", controllr_cookie="c", user_pk=7, created_at=0)


@pytest.fixture
def cliente():
    from app.deps import get_current_session
    from app.main import app

    app.dependency_overrides[get_current_session] = sessao
    yield TestClient(app)
    app.dependency_overrides.clear()


# ------------------------------------------------------------------ anexo


class _RespostaFalsa:
    def __init__(self, tipo, status=200):
        self.status, self.headers = status, {"Content-Type": tipo}

    async def read(self):
        return b"<script>alert(1)</script>"

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _controllr_devolve(monkeypatch, tipo, urls=None):
    from app.routers import suporte

    class _Sessao:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def get(self, url, headers=None):
            if urls is not None:
                urls.append(url)
            return _RespostaFalsa(tipo)

    monkeypatch.setattr(suporte.aiohttp, "ClientSession", _Sessao)


@pytest.mark.parametrize("tipo", ["text/html; charset=utf-8", "image/svg+xml", "application/xhtml+xml", "text/plain"])
def test_anexo_perigoso_vira_download(cliente, monkeypatch, tipo):
    _controllr_devolve(monkeypatch, tipo)
    r = cliente.get("/suporte/tickets/5/anexos/pagina.html")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/octet-stream"
    assert r.headers["content-disposition"].startswith("attachment;")
    assert "sandbox" in r.headers["content-security-policy"]
    assert r.headers["x-content-type-options"] == "nosniff"


@pytest.mark.parametrize("tipo", ["image/jpeg", "video/mp4", "audio/mpeg", "application/pdf"])
def test_anexo_de_midia_abre_na_tela(cliente, monkeypatch, tipo):
    _controllr_devolve(monkeypatch, tipo)
    r = cliente.get("/suporte/tickets/5/anexos/foto.jpg")
    assert r.headers["content-type"].startswith(tipo)
    assert "content-disposition" not in r.headers
    assert r.headers["x-content-type-options"] == "nosniff"


def test_nome_do_anexo_vai_codificado(cliente, monkeypatch):
    urls = []
    _controllr_devolve(monkeypatch, "image/png", urls)
    cliente.get("/suporte/tickets/5/anexos/foto%20da%20cto%3F.png")
    assert urls == ["https://controllr.hotnet.net.br:8443/support_ctl/annex/view/5/foto%20da%20cto%3F.png"]
    assert cliente.get("/suporte/tickets/5/anexos/..").status_code in (400, 404)


# ------------------------------------------------------------------ ONU


PAYLOAD = {"client_pk": 10, "cpe_pk": 20, "olt_pk": 1, "slot_id": 1, "port_id": 2, "onu_id": 3, "onu_serial": "ZTEG1"}


def _cpes(monkeypatch, linhas):
    from app.brbyteapi.controllr import AsyncControllr

    aplicados = []

    async def falso_combo(self, body, model_return=False):
        return SimpleNamespace(success=True, results=linhas)

    async def falso_post(self, caminho, body):
        aplicados.append(body)
        return SimpleNamespace(success=True, results=[], errors=None)

    monkeypatch.setattr(AsyncControllr, "cpe_list_combo", falso_combo)
    monkeypatch.setattr(AsyncControllr, "call_api_post", falso_post)
    return aplicados


def test_associar_usa_a_conexao_pedida_mesmo_fora_de_ordem(cliente, monkeypatch):
    # Controllr ignorou o filtro e devolveu outras conexões antes da certa.
    aplicados = _cpes(monkeypatch, [
        {"cpe_pk": 99, "client_pk": 55, "cpe_username": "outro.cliente", "cpe_password": "x"},
        {"cpe_pk": 20, "client_pk": 10, "cpe_username": "maria.silva", "cpe_password": "y"},
    ])
    assert cliente.post("/onu/77/associar-cliente", json=PAYLOAD).status_code == 200
    assert "maria.silva" in aplicados[0] and "outro.cliente" not in aplicados[0]


@pytest.mark.parametrize("linhas", [
    [{"cpe_pk": 99, "client_pk": 10, "cpe_username": "outra.conexao"}],   # conexão errada
    [{"cpe_pk": 20, "client_pk": 55, "cpe_username": "outro.cliente"}],   # conexão de outro cliente
    [],
])
def test_associar_recusa_quando_nao_confere(cliente, monkeypatch, linhas):
    aplicados = _cpes(monkeypatch, linhas)
    assert cliente.post("/onu/77/associar-cliente", json=PAYLOAD).status_code == 404
    assert aplicados == []
