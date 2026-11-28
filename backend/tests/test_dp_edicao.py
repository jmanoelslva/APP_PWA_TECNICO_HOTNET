"""Edição e cadastro de CTO: formulário completo no dp/update, cores ABNT, nomes no padrão e ACL do Controllr."""

from types import SimpleNamespace
from urllib.parse import parse_qs

import pytest
from fastapi.testclient import TestClient

from app import audit
from app.routers.dp import nomes_da_cto, sigla_do_setor
from app.sessions import TechnicianSession

REGISTRO = {
    "dp_pk": 802, "dp_status": 1, "dp_type": 4, "dp_color": "#FFFFFF", "dp_limit": 16,
    "dp_name": "VSJ-CTO-1.3", "dp_desc": "*", "dp_id": "VSJ-H01-03", "dp_code": "VSJ-H01", "dp_num": "3",
    "dp_lat": "0", "dp_lng": "0", "ds_pk": 16, "ds_name": "FTTH-VSJ", "total_cpe_active": 3,
}


def sessao():
    return TechnicianSession(session_id="s", username="joao", controllr_cookie="c", created_at=0)


@pytest.fixture
def cliente(tmp_path, monkeypatch):
    from app.deps import get_current_session
    from app.main import app

    monkeypatch.setattr(audit, "AUDIT_LOG_PATH", str(tmp_path / "auditoria.jsonl"))
    monkeypatch.setattr(audit, "_ultimo_mes_limpo", None)
    app.dependency_overrides[get_current_session] = sessao
    yield TestClient(app)
    app.dependency_overrides.clear()


def falso_controllr(monkeypatch, *, update_ok=True, status=200, existentes=()):
    from app.brbyteapi.controllr import AsyncControllr

    enviados: dict[str, dict] = {}

    async def dp_list(self, body, model_return=False):
        q = parse_qs(body)
        if "dp_name" in q.get("where", [""])[0]:
            return SimpleNamespace(success=True, results=list(existentes))
        return SimpleNamespace(success=True, results=[dict(REGISTRO)])

    async def dp_update(self, body, model_return=False):
        enviados["update"] = {k: v[0] for k, v in parse_qs(body, keep_blank_values=True).items()}
        return SimpleNamespace(success=update_ok, status=status, errors=[] if update_ok else [{"msg": "Access Denied"}])

    async def dp_create(self, body):
        enviados["create"] = {k: v[0] for k, v in parse_qs(body, keep_blank_values=True).items()}
        return SimpleNamespace(success=update_ok, status=status, errors=[] if update_ok else [{"msg": "Access Denied"}])

    async def call_api_post(self, caminho, body):
        return SimpleNamespace(success=True, results=[{"ds_pk": 16, "ds_name": "FTTH-VSJ"}, {"ds_pk": 1, "ds_name": "UTP/Wireless"}])

    monkeypatch.setattr(AsyncControllr, "dp_list", dp_list)
    monkeypatch.setattr(AsyncControllr, "dp_update", dp_update)
    monkeypatch.setattr(AsyncControllr, "dp_create", dp_create)
    monkeypatch.setattr(AsyncControllr, "call_api_post", call_api_post)
    return enviados


def test_nomes_no_padrao_da_rede():
    assert sigla_do_setor("FTTH-VSJ") == "VSJ"
    assert sigla_do_setor("UTP/Wireless") is None
    assert nomes_da_cto("VSJ", 1, 3) == {"dp_name": "VSJ-CTO-1.3", "dp_id": "VSJ-H01-03", "dp_code": "VSJ-H01", "dp_num": "3"}


def test_gravar_posicao_reenvia_o_formulario_inteiro(cliente, monkeypatch):
    enviados = falso_controllr(monkeypatch)
    r = cliente.post("/dp/802/editar", json={"lat": -9.646655, "lng": -36.684574, "precisao_m": 4})
    assert r.status_code == 200
    f = enviados["update"]
    assert f["dp_lat"] == "-9.64665500" and f["dp_lng"] == "-36.68457400"
    # O resto do cadastro vai como estava.
    assert f["dp_name"] == "VSJ-CTO-1.3" and f["dp_limit"] == "16" and f["ds_pk"] == "16" and f["dp_color"] == "#FFFFFF"
    (ev,), _ = audit.consultar()
    assert ev["acao"] == "cto.editar" and ev["alvo"]["alteracoes"][0]["rotulo"] == "Posição"


def test_cor_fora_do_padrao_e_capacidade_invalida_recusadas(cliente, monkeypatch):
    falso_controllr(monkeypatch)
    assert cliente.post("/dp/802/editar", json={"cor": "#55FF00"}).status_code == 400
    assert cliente.post("/dp/802/editar", json={"limite": 12}).status_code == 400


def test_sem_acl_vira_403_com_mensagem(cliente, monkeypatch):
    falso_controllr(monkeypatch, update_ok=False, status=403)
    r = cliente.post("/dp/802/editar", json={"cor": "#0000ff"})
    assert r.status_code == 403 and "liberação" in r.json()["detail"]


def test_criar_cto_com_nome_do_setor(cliente, monkeypatch):
    enviados = falso_controllr(monkeypatch)
    r = cliente.post("/dp/criar", json={"setor_pk": 16, "hub": 2, "numero": 7, "limite": 8, "cor": "#FF0000", "lat": -9.6, "lng": -36.6})
    assert r.status_code == 200 and r.json()["nome"] == "VSJ-CTO-2.7"
    f = enviados["create"]
    assert f["dp_pk"] == "0" and f["dp_type"] == "4" and f["dp_status"] == "1"
    assert f["dp_id"] == "VSJ-H02-07" and f["dp_code"] == "VSJ-H02" and f["ds_pk"] == "16"


def test_criar_nome_repetido_recusa(cliente, monkeypatch):
    falso_controllr(monkeypatch, existentes=[{"dp_name": "VSJ-CTO-2.7"}])
    r = cliente.post("/dp/criar", json={"setor_pk": 16, "hub": 2, "numero": 7, "limite": 8, "cor": "#FF0000", "lat": -9.6, "lng": -36.6})
    assert r.status_code == 409
