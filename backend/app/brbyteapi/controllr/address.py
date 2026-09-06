from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrAddress(BrByteAPIBase):
    async def address_list_combo(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/addresses/list_combo', body)
    
    async def address_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/addresses/create', body)
    
    async def address_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/addresses/update', body)
    
    async def address_delete(self, address_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/addresses/delete', f'address_pk={address_pk}')
