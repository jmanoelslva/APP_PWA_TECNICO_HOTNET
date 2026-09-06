from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrStockEquipment(BrByteAPIBase):
    async def stock_equipment_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/stock_equipment/list', body)
    
    async def stock_equipment_list_combo(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/stock_equipment/list_combo', body)
    
    async def stock_equipment_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/stock_equipment/create', body)
    
    async def stock_equipment_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/stock_equipment/update', body)
    
    async def stock_equipment_delete(self, equipment_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/stock_equipment/delete', f'equipment_pk={equipment_pk}')
