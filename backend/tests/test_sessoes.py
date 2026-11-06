import time

import pytest
from cryptography.fernet import Fernet

from app import sessions


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.setattr(sessions, "SESSOES_ARQUIVO", str(tmp_path / "dados" / "sessoes.bin"))
    monkeypatch.setattr(sessions, "_fernet", Fernet(Fernet.generate_key()))
    monkeypatch.setattr(sessions, "_sessions", {})
    monkeypatch.setattr(sessions, "_extras", {})
    return tmp_path / "dados" / "sessoes.bin"


def test_sessao_sobrevive_ao_reinicio(store):
    s = sessions.create_session("joao", "BRBOSCookie=abc")
    sessions.guardar_extra("vigia_os_cookie", "BRBOSCookie=xyz")
    assert store.exists() and b"abc" not in store.read_bytes()  # cifrado
    sessions._sessions.clear()
    sessions._extras.clear()
    sessions.carregar()
    relida = sessions.get_session(s.session_id)
    assert relida and relida.username == "joao" and relida.controllr_cookie == "BRBOSCookie=abc"
    assert relida.controllr_checked_at == 0.0  # confere com o Controllr na primeira requisição
    assert sessions.ler_extra("vigia_os_cookie") == "BRBOSCookie=xyz"


def test_sair_apaga_do_arquivo(store):
    s = sessions.create_session("joao", "c")
    sessions.delete_session(s.session_id)
    sessions.carregar()
    assert sessions.get_session(s.session_id) is None


def test_chave_trocada_comeca_vazio(store, monkeypatch):
    s = sessions.create_session("joao", "c")
    monkeypatch.setattr(sessions, "_fernet", Fernet(Fernet.generate_key()))
    sessions._sessions.clear()
    sessions.carregar()  # não pode derrubar o serviço
    assert sessions.get_session(s.session_id) is None


def test_sessao_vencida_nao_volta(store, monkeypatch):
    s = sessions.create_session("joao", "c")
    s.created_at = time.time() - sessions.SESSION_COOKIE_MAX_AGE_SECONDS - 10
    sessions._gravar()
    sessions._sessions.clear()
    sessions.carregar()
    assert sessions.get_session(s.session_id) is None


def test_sem_chave_fica_so_em_memoria(tmp_path, monkeypatch):
    monkeypatch.setattr(sessions, "SESSOES_ARQUIVO", str(tmp_path / "s.bin"))
    monkeypatch.setattr(sessions, "_fernet", None)
    monkeypatch.setattr(sessions, "_sessions", {})
    sessions.create_session("joao", "c")
    assert not (tmp_path / "s.bin").exists()
