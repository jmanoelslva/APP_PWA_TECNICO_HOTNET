
from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrOp(BrByteAPIBase):
    async def support_op_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/op/create', body)
