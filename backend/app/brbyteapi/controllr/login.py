import asyncio
from dataclasses import dataclass

from aiohttp import ClientError, ClientSession, ClientTimeout
from typing import Any
from urllib.parse import quote

from ..base import BrByteAPIBase


@dataclass
class ControllrLoginResult:
    success: bool
    # Cookie de sessão retornado pelo POST /login — usado em toda chamada
    # deste backend ao Controllr (ver app/deps.py::get_auth_context).
    cookie_header: str | None = None
    # Controllr fora do ar, lento ou respondendo sem JSON: não é senha errada.
    indisponivel: bool = False


class ControllrLogin(BrByteAPIBase):
    @classmethod
    async def login(cls, url: str, username: str, password: str, timeout: int = 10) -> ControllrLoginResult:
        url_login = f"{url}/login"
        data = f'username={quote(str(username))}&password={quote(str(password))}'
        aiohttp_timeout = ClientTimeout(timeout)
        try:
            return await cls._login(url, url_login, data, aiohttp_timeout)
        except (ClientError, asyncio.TimeoutError, ValueError):
            return ControllrLoginResult(success=False, indisponivel=True)

    @classmethod
    async def _login(cls, url: str, url_login: str, data: str, aiohttp_timeout: ClientTimeout) -> ControllrLoginResult:
        async with ClientSession() as session:
            async with session.post(url=url_login, data=data, timeout=aiohttp_timeout) as response:
                if response.status >= 500:
                    return ControllrLoginResult(success=False, indisponivel=True)
                response_json: dict[str, Any] = await response.json(content_type=None)
                if not isinstance(response_json, dict):
                    return ControllrLoginResult(success=False, indisponivel=True)
                sucesso = bool(response_json.get('success', False))
                cookie_header = None
                if sucesso:
                    # response.cookies só traz o Set-Cookie da resposta
                    # final — se o /login redirecionar antes do 200, o
                    # cookie some ali mas continua no cookie jar da sessão.
                    # filter_cookies(url) cobre a cadeia de redirect toda.
                    cookies = session.cookie_jar.filter_cookies(url)
                    if cookies:
                        cookie_header = "; ".join(f"{chave}={morsel.value}" for chave, morsel in cookies.items())
                return ControllrLoginResult(success=sucesso, cookie_header=cookie_header)