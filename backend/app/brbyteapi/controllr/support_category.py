from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrSupportCategory(BrByteAPIBase):
    async def support_category_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/support_ctl/category/list", body)
    
    async def support_category_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/support_ctl/category/create", body)
    
    async def support_category_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/support_ctl/category/update", body)
    
    async def support_category_delete(self, category_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post("/support_ctl/category/delete", f'category_pk={category_pk}')
