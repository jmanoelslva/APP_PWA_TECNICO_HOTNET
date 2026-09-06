from aiohttp import ClientSession, ClientTimeout
from typing import Any
from urllib.parse import quote

from ..base import BrByteAPIBase

class ControllrLogin(BrByteAPIBase):
    @classmethod
    async def login(cls, url: str, username: str, password: str, timeout: int = 10) -> bool:
        url = f"{url}/login"
        data = f'username={quote(str(username))}&password={quote(str(password))}'
        aiohttp_timeout = ClientTimeout(timeout)
        async with ClientSession() as session:
            async with session.post(url=url, data=data, timeout=aiohttp_timeout) as response:
                response_json: dict[str, Any] = await response.json()
                return response_json.get('success', False)
        return False