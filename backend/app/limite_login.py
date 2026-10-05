"""
Limite de tentativas de login erradas — por IP e por usuário.

O /auth/login repassa usuário e senha ao Controllr; sem limite, dá para
testar senhas dos técnicos à vontade pelo app (e o Controllr pode acabar
bloqueando a conta da pessoa). Em memória, como sessions.py: reiniciar o
serviço zera os contadores.
"""

import threading
import time

from .config import LOGIN_BLOQUEIO_MINUTOS, LOGIN_TENTATIVAS_IP, LOGIN_TENTATIVAS_USUARIO

_lock = threading.Lock()
_falhas: dict[str, list[float]] = {}


def _recentes(chave: str, agora: float) -> list[float]:
    janela = LOGIN_BLOQUEIO_MINUTOS * 60
    falhas = [t for t in _falhas.get(chave, []) if agora - t < janela]
    if falhas:
        _falhas[chave] = falhas
    else:
        _falhas.pop(chave, None)
    return falhas


def bloqueado(ip: str, usuario: str) -> bool:
    agora = time.monotonic()
    with _lock:
        return (len(_recentes(f"ip:{ip}", agora)) >= LOGIN_TENTATIVAS_IP
                or len(_recentes(f"u:{usuario.strip().lower()}", agora)) >= LOGIN_TENTATIVAS_USUARIO)


def falhou(ip: str, usuario: str) -> None:
    agora = time.monotonic()
    with _lock:
        for chave in (f"ip:{ip}", f"u:{usuario.strip().lower()}"):
            _falhas.setdefault(chave, []).append(agora)


def acertou(ip: str, usuario: str) -> None:
    with _lock:
        _falhas.pop(f"ip:{ip}", None)
        _falhas.pop(f"u:{usuario.strip().lower()}", None)
