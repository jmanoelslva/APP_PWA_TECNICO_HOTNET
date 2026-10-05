"""IP real na auditoria, arquivos por mês, consulta e limite de login."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import audit, limite_login
from app.sessions import TechnicianSession


def req(headers=None, host="127.0.0.1"):
    return SimpleNamespace(headers={k.lower(): v for k, v in (headers or {}).items()},
                           client=SimpleNamespace(host=host))


@pytest.mark.parametrize("headers,esperado", [
    ({"X-Real-IP": "200.1.1.1"}, "200.1.1.1"),
    # Cabeçalhos que o navegador inventa não valem mais que o do proxy.
    ({"X-Real-IP": "200.1.1.1", "CF-Connecting-IP": "6.6.6.6", "X-Forwarded-For": "6.6.6.6, 200.1.1.1"}, "200.1.1.1"),
    # Apache antigo mandava "(null)": vale o último do X-Forwarded-For (o que o proxy acrescentou).
    ({"X-Real-IP": "(null)", "X-Forwarded-For": "6.6.6.6, 200.1.1.1"}, "200.1.1.1"),
    ({"CF-Connecting-IP": "6.6.6.6"}, "127.0.0.1"),
    ({"X-Forwarded-For": "2804:abc::1"}, "2804:abc::1"),
])
def test_ip_origem(headers, esperado):
    assert audit.obter_ip_origem(req(headers)) == esperado


@pytest.fixture
def pasta(tmp_path, monkeypatch):
    monkeypatch.setattr(audit, "AUDIT_LOG_PATH", str(tmp_path / "auditoria.jsonl"))
    monkeypatch.setattr(audit, "_ultimo_mes_limpo", None)
    return tmp_path


def sessao(nome="joao"):
    return TechnicianSession(session_id="s", username=nome, controllr_cookie="c", user_pk=7, created_at=0)


def test_grava_por_mes_e_consulta(pasta, monkeypatch):
    # Arquivo único antigo continua aparecendo na consulta.
    (pasta / "auditoria.jsonl").write_text(json.dumps(
        {"quando": "2026-09-01 10:00:00", "tecnico": "maria", "acao": "onu.reiniciar", "alvo": {}}) + "\n",
        encoding="utf-8")
    audit.registrar_auditoria(req({"X-Real-IP": "200.1.1.1"}), sessao(), "onu.remover", {"onu_pk": 1})
    mes = audit.time.strftime("%Y-%m")
    linhas = (pasta / f"auditoria-{mes}.jsonl").read_text(encoding="utf-8").splitlines()
    ev = json.loads(linhas[0])
    assert ev["ip"] == "200.1.1.1" and ev["acao"] == "onu.remover" and ev["tecnico"] == "joao"

    tudo, mais = audit.consultar()
    assert [e["tecnico"] for e in tudo] == ["joao", "maria"] and not mais
    assert [e["tecnico"] for e in audit.consultar(tecnico="MAR")[0]] == ["maria"]
    assert [e["acao"] for e in audit.consultar(acao="onu.rein")[0]] == ["onu.reiniciar"]
    assert audit.consultar(de="2026-09-01", ate="2026-09-01")[0][0]["tecnico"] == "maria"
    assert audit.consultar(limite=1) == (tudo[:1], True)


def test_retencao(pasta, monkeypatch):
    monkeypatch.setattr(audit, "AUDITORIA_RETENCAO_MESES", 12)
    for mes in ("2025-09", "2025-10", "2026-09"):
        (pasta / f"auditoria-{mes}.jsonl").write_text("", encoding="utf-8")
    audit._limpar_antigos("2026-10")
    assert sorted(p.name for p in pasta.glob("auditoria-*.jsonl")) == ["auditoria-2025-10.jsonl",
                                                                         "auditoria-2026-09.jsonl"]


def test_limite_login(monkeypatch):
    monkeypatch.setattr(limite_login, "_falhas", {})
    monkeypatch.setattr(limite_login, "LOGIN_TENTATIVAS_IP", 3)
    monkeypatch.setattr(limite_login, "LOGIN_TENTATIVAS_USUARIO", 5)
    for _ in range(3):
        assert not limite_login.bloqueado("1.1.1.1", "joao")
        limite_login.falhou("1.1.1.1", "joao")
    assert limite_login.bloqueado("1.1.1.1", "outro")       # IP bloqueado
    assert not limite_login.bloqueado("2.2.2.2", "joao")     # usuário ainda não
    limite_login.falhou("2.2.2.2", "JOAO")
    limite_login.falhou("3.3.3.3", "joao")
    assert limite_login.bloqueado("4.4.4.4", "joao")         # 5 erros do usuário, de IPs diferentes
    limite_login.acertou("4.4.4.4", "joao")
    assert not limite_login.bloqueado("4.4.4.4", "joao")


def test_login_bloqueado_nem_chama_o_controllr(monkeypatch):
    from app.main import app
    from app.routers import auth

    monkeypatch.setattr(limite_login, "_falhas", {})
    chamadas = []

    async def falso_login(url, usuario, senha):
        chamadas.append(usuario)
        return SimpleNamespace(success=False, cookie_header=None)

    monkeypatch.setattr(auth.ControllrLogin, "login", falso_login)
    c = TestClient(app)
    for _ in range(limite_login.LOGIN_TENTATIVAS_IP):
        r = c.post("/auth/login", json={"username": "joao", "password": "x"}, headers={"X-Real-IP": "9.9.9.9"})
        assert r.json()["message"] == "Usuário ou senha incorretos."
    r = c.post("/auth/login", json={"username": "joao", "password": "x"}, headers={"X-Real-IP": "9.9.9.9"})
    assert "Muitas tentativas" in r.json()["message"] and not r.json()["success"]
    assert len(chamadas) == limite_login.LOGIN_TENTATIVAS_IP


def test_rota_so_para_usuarios_liberados(pasta, monkeypatch):
    from app.deps import get_current_session
    from app.main import app
    from app.routers import auditoria

    monkeypatch.setattr(auditoria, "AUDITORIA_USUARIOS", {"chefe"})
    c = TestClient(app)
    try:
        app.dependency_overrides[get_current_session] = lambda: sessao("joao")
        assert c.get("/auditoria/acesso").json() == {"permitido": False}
        assert c.get("/auditoria").status_code == 403
        app.dependency_overrides[get_current_session] = lambda: sessao("Chefe")
        assert c.get("/auditoria/acesso").json() == {"permitido": True}
        assert c.get("/auditoria", params={"de": "05/10/2026"}).status_code == 400
        assert c.get("/auditoria").json() == {"eventos": [], "mais": False}
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("termo", ["*", "todos"])
def test_termo_libera_todos(pasta, monkeypatch, termo):
    from app.deps import get_current_session
    from app.main import app
    from app.routers import auditoria

    monkeypatch.setattr(auditoria, "AUDITORIA_USUARIOS", {"chefe", termo})
    app.dependency_overrides[get_current_session] = lambda: sessao("qualquer")
    try:
        c = TestClient(app)
        assert c.get("/auditoria/acesso").json() == {"permitido": True}
        assert c.get("/auditoria").status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_alvo_da_onu_com_nome_da_olt():
    from app.routers.onu import _alvo_onu

    assert _alvo_onu(55, 3, 2, 12, "OLT-FLX", "ZTEG00000001", onu_name="CLIENTE", nome_anterior=None) == {
        "onu_pk": 55, "olt_pk": 3, "olt_nome": "OLT-FLX", "porta": 2, "onu_id": 12,
        "serial": "ZTEG00000001", "onu_name": "CLIENTE"}


def test_registro_antigo_completado_pela_onu(pasta, monkeypatch):
    from app.brbyteapi.controllr import AsyncControllr
    from app.deps import get_current_session
    from app.main import app
    from app.routers import auditoria

    linhas = [
        {"quando": "2026-09-01 10:00:00", "tecnico": "maria", "acao": "onu.renomear",
         "alvo": {"onu_pk": 55, "onu_name": "CLIENTE"}},           # só o pk da ONU
        {"quando": "2026-09-01 09:00:00", "tecnico": "maria", "acao": "onu.remover",
         "alvo": {"onu_pk": 99, "olt_pk": 3}},                     # ONU já removida
    ]
    (pasta / "auditoria.jsonl").write_text("".join(json.dumps(x) + "\n" for x in linhas), encoding="utf-8")
    monkeypatch.setattr(auditoria, "AUDITORIA_USUARIOS", {"chefe"})
    monkeypatch.setattr(auditoria, "_cache", {})
    onus = [{"pk": 55, "olt_pk": 3, "olt_name": "OLT-FLX", "pon": 2, "id": 12, "sn": "ZTEG00000001"},
            {"pk": 70, "olt_pk": 3, "olt_name": "OLT-FLX", "pon": 1, "id": 1, "sn": "ZTEG00000002"}]

    async def falsa_lista(self, body, model_return=False, model_extended=False):
        # Controllr "ignora" o filtro e devolve todas: só vale a que confere.
        return SimpleNamespace(success=True, results=[SimpleNamespace(model_dump=lambda mode=None, o=o: o) for o in onus])

    monkeypatch.setattr(AsyncControllr, "onu_list", falsa_lista)
    app.dependency_overrides[get_current_session] = lambda: sessao("chefe")
    try:
        evs = TestClient(app).get("/auditoria").json()["eventos"]
    finally:
        app.dependency_overrides.clear()
    assert evs[0]["alvo"] == {"onu_pk": 55, "onu_name": "CLIENTE", "olt_nome": "OLT-FLX",
                              "porta": 2, "onu_id": 12, "serial": "ZTEG00000001"}
    assert evs[1]["alvo"]["olt_nome"] == "OLT-FLX" and "onu_id" not in evs[1]["alvo"]
