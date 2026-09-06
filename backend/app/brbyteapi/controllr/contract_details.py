from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrContractDetails(BrByteAPIBase):
    async def contract_details_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_details/list", body)
