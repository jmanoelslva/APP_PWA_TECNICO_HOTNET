from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrClientCategory(BrByteAPIBase):
    async def client_category_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/client_category/list", body)
    
    async def client_category_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/client_category/create", body)
    
    async def client_category_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/client_category/update", body)
    
    async def client_category_delete(self, category_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/client_category/delete", f'category_pk={category_pk}')
