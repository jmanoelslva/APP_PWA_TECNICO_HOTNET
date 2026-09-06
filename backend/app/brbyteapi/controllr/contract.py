from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrContract(BrByteAPIBase):
    async def contract_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/contract/list', body)
    
    async def contract_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/contract/create', body)
    
    async def contract_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/contract/update', body)
    
    async def contract_apply_combo(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/contract/apply_combo', body)
    
    async def contract_details_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/contract_details/list', body)
    
    async def apply_combo(self, contract_pk: int, combo_pk: int, contract_status: int) -> Response[dict[str, Any]]:
        body = f'contract_pk={contract_pk}&combo_pk={combo_pk}&contract_status={contract_status}'
        return await self.call_api_post('/controllrctl/contract/apply_combo', body)
