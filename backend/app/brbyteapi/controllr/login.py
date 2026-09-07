from dataclasses import dataclass

from aiohttp import ClientSession, ClientTimeout
from typing import Any
from urllib.parse import quote

from ..base import BrByteAPIBase


@dataclass
class ControllrLoginResult:
    success: bool
    # Cookie de sessão que o próprio POST /login devolve (mesmo mecanismo
    # do painel administrativo) — capturado só para poder encerrar essa
    # sessão de verdade depois (POST /session/logout), já que as demais
    # chamadas deste backend usam Basic Auth por requisição, sem sessão
    # nenhuma no Controllr para esse cookie ser necessário.
    cookie_header: str | None = None


class ControllrLogin(BrByteAPIBase):
    @classmethod
    async def login(cls, url: str, username: str, password: str, timeout: int = 10) -> ControllrLoginResult:
        url_login = f"{url}/login"
        data = f'username={quote(str(username))}&password={quote(str(password))}'
        aiohttp_timeout = ClientTimeout(timeout)
        async with ClientSession() as session:
            async with session.post(url=url_login, data=data, timeout=aiohttp_timeout) as response:
                response_json: dict[str, Any] = await response.json()
                sucesso = bool(response_json.get('success', False))
                cookie_header = None
                if sucesso and response.cookies:
                    cookie_header = "; ".join(f"{chave}={morsel.value}" for chave, morsel in response.cookies.items())
                return ControllrLoginResult(success=sucesso, cookie_header=cookie_header)