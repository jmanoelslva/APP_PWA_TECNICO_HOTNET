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


def test_lista_aberta_marca_a_etapa_e_tira_finalizadas(monkeypatch):
    from app.deps import get_current_session
    from app.main import app

    ordens = [{"op_pk": pk, "ticket_pk": pk * 10, "staff_username": "anderson"} for pk in (1, 2, 3, 4)]
    eventos = [
        {"op_pk": 11, "op_os_pk": 2, "op_type": 3, "op_date_answer": "2026-10-05 08:00:00"},
        {"op_pk": 12, "op_os_pk": 3, "op_type": 3, "op_date_answer": "2026-10-05 08:00:00"},
        {"op_pk": 13, "op_os_pk": 3, "op_type": 4, "op_date_start": "2026-10-05 08:10:00"},
        {"op_pk": 14, "op_os_pk": 4, "op_type": 5, "op_date_finish": "2026-10-05 09:00:00"},
        # Respondida e depois desfeita: volta a "agendada".
        {"op_pk": 15, "op_os_pk": 1, "op_type": 3, "op_date_answer": "2026-10-05 07:00:00"},
        {"op_pk": 16, "op_os_pk": 1, "op_type": 3, "op_date_answer": None},
    ]

    async def post(self, caminho, body=None):
        dados = [dict(o) for o in ordens] if caminho == "/support_ctl/os/list" else eventos
        return SimpleNamespace(success=True, results=dados, total=len(dados), errors=None)

    monkeypatch.setattr(AsyncControllr, "call_api_post", post)
    app.dependency_overrides[get_current_session] = lambda: TechnicianSession("s", "anderson", "c", 1, 0)
    try:
        r = TestClient(app).get("/os", params={"minhas": "false"}).json()
    finally:
        app.dependency_overrides.clear()
    assert [(o["op_pk"], o["etapa"]) for o in r["results"]] == [(1, "agendada"), (2, "respondida"), (3, "iniciada")]
