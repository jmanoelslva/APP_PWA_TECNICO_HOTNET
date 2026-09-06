from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrCoService(BrByteAPIBase):
    async def service_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/co_service/list", body)
