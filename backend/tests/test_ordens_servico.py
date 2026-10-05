"""'Minhas OS' = OS em que o técnico logado é o responsável (staff), não quem abriu (user)."""

from types import SimpleNamespace
from urllib.parse import parse_qs

from fastapi.testclient import TestClient

from app.brbyteapi.controllr import AsyncControllr
from app.sessions import TechnicianSession

ORDENS = [
    # Aberta pelo João, executada pelo Anderson.
    {"op_pk": 1, "ticket_pk": 10, "user_username": "joao", "staff_username": "anderson"},
    # Aberta pelo Anderson (raro), executada pela Maria.
    {"op_pk": 2, "ticket_pk": 20, "user_username": "anderson", "staff_username": "maria"},
    {"op_pk": 3, "ticket_pk": 30, "user_username": "joao", "staff_username": "Anderson "},
]


def listar(monkeypatch, usuario, **params):
    from app.deps import get_current_session
    from app.main import app

    enviados = []

    async def post(self, caminho, body=None):
        enviados.append((caminho, body))
        if caminho == "/support_ctl/os/list":
            return SimpleNamespace(success=True, results=[dict(o) for o in ORDENS], total=len(ORDENS), errors=None)
        return SimpleNamespace(success=True, results=[], total=0, errors=None)  # eventos: nenhuma finalizada

    monkeypatch.setattr(AsyncControllr, "call_api_post", post)
    app.dependency_overrides[get_current_session] = lambda: TechnicianSession("s", usuario, "c", 1, 0)
    try:
        return TestClient(app).get("/os", params=params).json(), enviados
    finally:
        app.dependency_overrides.clear()


def test_minhas_sao_as_que_o_tecnico_executa(monkeypatch):
    r, enviados = listar(monkeypatch, "Anderson", minhas="true")
    assert [o["op_pk"] for o in r["results"]] == [1, 3] and r["total"] == 2
    # Não filtra mais pelo user_pk (quem abriu) no Controllr.
    where = parse_qs(enviados[0][1]).get("where", [""])[0]
    assert "user_pk" not in where


def test_sem_minhas_mostra_o_que_a_acl_devolver(monkeypatch):
    r, _ = listar(monkeypatch, "anderson", minhas="false")
    assert [o["op_pk"] for o in r["results"]] == [1, 2, 3]
