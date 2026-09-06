from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrDS(BrByteAPIBase):
    async def ds_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/ds/list', body)

    async def ds_list_combo(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/ds/list_combo', body)

    async def ds_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/ds/create', body)

    async def ds_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/ds/update', body)

    async def ds_delete(self, ds_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/ds/delete', f'ds_pk={ds_pk}')

    async def get_ds_by_status(self, ds_status: int) -> Response[dict[str, Any]]:
        return await self.ds_list(f'where=[{{"field":"ds_status","oper":5,"value":{ds_status}}}]&sort=ds_pk&dir=ASC')
