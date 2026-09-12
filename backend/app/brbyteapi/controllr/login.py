from dataclasses import dataclass

from aiohttp import ClientSession, ClientTimeout
from typing import Any
from urllib.parse import quote

from ..base import BrByteAPIBase


@dataclass
class ControllrLoginResult:
    success: bool
    # Cookie de sessão retornado pelo POST /login (mesmo mecanismo do
    # painel administrativo), usado só para encerrar essa sessão depois
    # (POST /session/logout) — as demais chamadas deste backend usam
    # Basic Auth por requisição, sem sessão no Controllr.
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
                if sucesso:
                    # response.cookies só traz o Set-Cookie da resposta final
                    # — se o /login responder com redirect antes do 200, o
                    # cookie de sessão não aparece ali, embora já esteja no
                    # cookie jar da ClientSession. filter_cookies(url) lê do
                    # jar, cobrindo qualquer resposta da cadeia de redirect.
                    # Esse cookie é o único jeito de /auth/logout encerrar a
                    # sessão no Controllr — as demais chamadas usam Basic
                    # Auth, que não cria sessão nenhuma lá.
                    cookies = session.cookie_jar.filter_cookies(url)
                    if cookies:
                        cookie_header = "; ".join(f"{chave}={morsel.value}" for chave, morsel in cookies.items())
                return ControllrLoginResult(success=sucesso, cookie_header=cookie_header)