"""
Limite de tentativas de login erradas.

O /auth/login repassa usuário e senha ao Controllr; sem limite, dá para
testar senhas dos técnicos à vontade pelo app. Dois contadores:

- par IP + usuário (LOGIN_TENTATIVAS_PAR): quem erra a senha de um usuário
  num aparelho é bloqueado só ali — de outro IP, o dono da conta continua
  entrando. Antes o bloqueio era só por usuário, e qualquer pessoa que
  soubesse o login de um técnico podia travar a conta dele de propósito.
- IP (LOGIN_TENTATIVAS_IP, mais alto): segura quem testa vários usuários
  do mesmo lugar. Alto o bastante para técnicos atrás do mesmo IP (CGNAT
  da operadora, escritório).

Em memória: reiniciar o serviço zera os contadores.
"""

import threading
import time

from .config import LOGIN_BLOQUEIO_MINUTOS, LOGIN_TENTATIVAS_IP, LOGIN_TENTATIVAS_PAR

_lock = threading.Lock()
_falhas: dict[str, list[float]] = {}


def _chave_par(ip: str, usuario: str) -> str:
    return f"par:{ip}|{usuario.strip().lower()}"


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
        return (len(_recentes(_chave_par(ip, usuario), agora)) >= LOGIN_TENTATIVAS_PAR
                or len(_recentes(f"ip:{ip}", agora)) >= LOGIN_TENTATIVAS_IP)


def falhou(ip: str, usuario: str) -> None:
    agora = time.monotonic()
    with _lock:
        for chave in (_chave_par(ip, usuario), f"ip:{ip}"):
            _falhas.setdefault(chave, []).append(agora)


def acertou(ip: str, usuario: str) -> None:
    # Só zera o par: um login certo não pode apagar as tentativas que alguém
    # fez com outros usuários a partir do mesmo IP.
    with _lock:
        _falhas.pop(_chave_par(ip, usuario), None)
