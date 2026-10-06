"""Anexo de chamado servido com segurança e associação de ONU à conexão certa."""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.sessions import TechnicianSession


def sessao():
    return TechnicianSession(session_id="s", username="joao", controllr_cookie="c", created_at=0)


@pytest.fixture
def cliente():
    from app.deps import get_current_session
    from app.main import app

    app.dependency_overrides[get_current_session] = sessao
    yield TestClient(app)
    app.dependency_overrides.clear()


# ------------------------------------------------------------------ anexo


class _RespostaFalsa:
    def __init__(self, tipo, status=200, conteudo=b"<script>alert(1)</script>"):
        self.status, self.headers, self.conteudo = status, {"Content-Type": tipo}, conteudo

    async def read(self):
        return self.conteudo

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _controllr_devolve(monkeypatch, tipo, urls=None, conteudo=b"<script>alert(1)</script>"):
    from app.routers import suporte

    class _Sessao:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def get(self, url, headers=None):
            if urls is not None:
                urls.append(url)
            return _RespostaFalsa(tipo, conteudo=conteudo)

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


@pytest.mark.parametrize(
    ("conteudo", "esperado"),
    [
        (b"\xff\xd8\xff\xe0foto", "image/jpeg"),
        (b"\x89PNG\x0d\x0a\x1a\x0a", "image/png"),
        (b"%PDF-1.7", "application/pdf"),
        (b"\x00\x00\x00\x18ftypmp42", "video/mp4"),
    ],
)
def test_midia_sem_tipo_certo_abre_pela_assinatura(cliente, monkeypatch, conteudo, esperado):
    _controllr_devolve(monkeypatch, "application/octet-stream", conteudo=conteudo)
    r = cliente.get("/suporte/tickets/5/anexos/foto.jpg")
    assert r.headers["content-type"].startswith(esperado)
    assert "content-disposition" not in r.headers


@pytest.mark.parametrize("conteudo", [b"<html><script>", b"<svg xmlns=", b"\x00\x00\x00\x18ftypheic"])
def test_sem_tipo_e_sem_assinatura_de_midia_vira_download(cliente, monkeypatch, conteudo):
    _controllr_devolve(monkeypatch, "application/octet-stream", conteudo=conteudo)
    r = cliente.get("/suporte/tickets/5/anexos/foto.jpg")
    assert r.headers["content-type"] == "application/octet-stream"
    assert r.headers["content-disposition"].startswith("attachment;")


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


def test_associar_grava_auditoria_com_antes_e_depois(cliente, monkeypatch, tmp_path):
    from app import audit

    monkeypatch.setattr(audit, "AUDIT_LOG_PATH", str(tmp_path / "auditoria.jsonl"))
    monkeypatch.setattr(audit, "_ultimo_mes_limpo", None)
    aplicados = _cpes(monkeypatch, [
        {"cpe_pk": 20, "client_pk": 10, "client_complete_name": "Maria da Silva",
         "cpe_username": "maria.silva", "cpe_password": "segredo"},
    ])
    contexto = {"olt_nome": "OLT-CENTRO", "cliente_anterior": "José Souza", "pppoe_anterior": "jose.souza"}
    assert cliente.post("/onu/77/associar-cliente", json={**PAYLOAD, "auditoria": contexto}).status_code == 200

    assert "OLT-CENTRO" not in aplicados[0]  # o contexto não vai para o Controllr
    (ev,), _ = audit.consultar()
    assert ev["acao"] == "onu.associar_cliente" and ev["tecnico"] == "joao"
    assert ev["alvo"] == {"onu_pk": 77, "olt_pk": 1, "olt_nome": "OLT-CENTRO", "porta": 2, "onu_id": 3,
                          "serial": "ZTEG1", "cpe_pk": 20, "cliente": "Maria da Silva", "pppoe": "maria.silva",
                          "cliente_anterior": "José Souza", "pppoe_anterior": "jose.souza"}
    assert "segredo" not in str(ev)


def test_associacao_recusada_nao_grava_auditoria(cliente, monkeypatch, tmp_path):
    from app import audit

    monkeypatch.setattr(audit, "AUDIT_LOG_PATH", str(tmp_path / "auditoria.jsonl"))
    _cpes(monkeypatch, [{"cpe_pk": 20, "client_pk": 55}])
    assert cliente.post("/onu/77/associar-cliente", json=PAYLOAD).status_code == 404
    assert audit.consultar() == ([], False)


def test_erro_do_controllr_no_anexo_nao_vira_401(cliente, monkeypatch):
    # Um 401 repassado faria o app achar que a sessão do técnico caiu.
    from app.routers import suporte

    class _Sessao:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def get(self, url, headers=None):
            return _RespostaFalsa("text/html", status=401)

    monkeypatch.setattr(suporte.aiohttp, "ClientSession", _Sessao)
    assert cliente.get("/suporte/tickets/1/anexos/foto.jpg").status_code == 502


def test_anexo_grande_demais_e_recusado(cliente, monkeypatch):
    from app.deps import AuthContext, get_auth_context
    from app.main import app
    from app.routers import suporte

    enviados = []

    class _Controllr:
        async def support_annex_upload(self, form):
            enviados.append(form)

    app.dependency_overrides[get_auth_context] = lambda: AuthContext(session=sessao(), controllr=_Controllr())
    monkeypatch.setattr(suporte, "ANEXO_MAX_MB", 1)
    r = cliente.post("/suporte/tickets/1/anexos", files={"file": ("video.mp4", b"0" * (1024 * 1024 + 1), "video/mp4")})
    assert r.status_code == 413
    assert enviados == []
