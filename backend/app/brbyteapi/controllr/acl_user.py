from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrACLUser(BrByteAPIBase):
    async def user_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/web_auth/acl_user/list', body)
