from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrEmail(BrByteAPIBase):
    async def email_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/email/list', body)
    
    async def email_list_combo(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/email/list_combo', body)
    
    async def email_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/email/create', body)
    
    async def email_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/email/update', body)
    
    async def email_delete(self, client_email_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/dp/delete', f'client_email_pk={client_email_pk}')
