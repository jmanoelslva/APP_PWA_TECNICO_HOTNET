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

- usuário (LOGIN_TENTATIVAS_USUARIO, o mais alto): soma de todos os IPs,
  para quem troca de endereço a cada tentativa.

IPv6 conta pelo /64: o celular troca de endereço dentro do mesmo prefixo
e, contado por endereço exato, cada troca zerava o bloqueio.

Em memória: reiniciar o serviço zera os contadores. Chaves sem falha
recente são apagadas na limpeza periódica (_falhas não cresce sem fim).
"""

import ipaddress
import threading
import time

from .config import LOGIN_BLOQUEIO_MINUTOS, LOGIN_TENTATIVAS_IP, LOGIN_TENTATIVAS_PAR, LOGIN_TENTATIVAS_USUARIO

_lock = threading.Lock()
_falhas: dict[str, list[float]] = {}


_LIMPEZA_A_CADA = 500
_desde_limpeza = 0


def origem(ip: str) -> str:
    """IPv4 inteiro; IPv6 pelo /64."""
    try:
        endereco = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if isinstance(endereco, ipaddress.IPv6Address):
        if endereco.ipv4_mapped is not None:
            return str(endereco.ipv4_mapped)
        return str(ipaddress.ip_network(f"{endereco}/64", strict=False))
    return str(endereco)


def _chave_par(ip: str, usuario: str) -> str:
    return f"par:{origem(ip)}|{usuario.strip().lower()}"


def _chave_ip(ip: str) -> str:
    return f"ip:{origem(ip)}"


def _chave_usuario(usuario: str) -> str:
    return f"usuario:{usuario.strip().lower()}"


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
                or len(_recentes(_chave_ip(ip), agora)) >= LOGIN_TENTATIVAS_IP
                or len(_recentes(_chave_usuario(usuario), agora)) >= LOGIN_TENTATIVAS_USUARIO)


def falhou(ip: str, usuario: str) -> None:
    global _desde_limpeza
    agora = time.monotonic()
    with _lock:
        for chave in (_chave_par(ip, usuario), _chave_ip(ip), _chave_usuario(usuario)):
            _falhas.setdefault(chave, []).append(agora)
        _desde_limpeza += 1
        if _desde_limpeza >= _LIMPEZA_A_CADA:
            _desde_limpeza = 0
            for chave in list(_falhas):
                _recentes(chave, agora)


def acertou(ip: str, usuario: str) -> None:
    # Só zera o par: um login certo não pode apagar as tentativas que alguém
    # fez com outros usuários a partir do mesmo IP.
    with _lock:
        _falhas.pop(_chave_par(ip, usuario), None)
