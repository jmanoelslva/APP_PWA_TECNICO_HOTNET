from fastapi.testclient import TestClient

from app.config import APP_VERSION
from app.main import app


def test_health_mostra_versao_so_de_dentro_do_servidor():
    de_dentro = TestClient(app, client=("127.0.0.1", 50000))
    assert de_dentro.get("/health").json() == {"ok": True, "version": APP_VERSION}
    # Pelo proxy público (sempre manda X-Real-IP), sem versão.
    assert de_dentro.get("/health", headers={"X-Real-IP": "203.0.113.9"}).json() == {"ok": True}
    de_fora = TestClient(app, client=("203.0.113.9", 50000))
    assert de_fora.get("/health").json() == {"ok": True}
