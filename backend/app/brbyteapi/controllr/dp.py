from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.dp import DP, DPType
from ..response import Response

class DPResponse(Response[DP]):
    pass

class ControllrDP(BrByteAPIBase):
    @overload
    async def dp_list(self, body: str, model_return: Literal[True]) -> Response[DP]: ...

    @overload  
    async def dp_list(self, body: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...

    async def dp_list(self, body: str, model_return: bool = False) -> Response[DP] | Response[dict[str, Any]]:
        response = await self.call_api_post('/controllrctl/dp/list', body)
        if model_return:
            return response.cast(DP)
        return response

    async def dp_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/dp/create', body)
    
    @overload
    async def dp_update(self, body: str, model_return: Literal[True]) -> Response[DP]: ...

    @overload  
    async def dp_update(self, body: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...
    
    async def dp_update(self, body: str, model_return: bool = False) -> Response[DP] | Response[dict[str, Any]]:
        response = await self.call_api_post('/controllrctl/dp/update', body)
        if model_return:
            return response.cast(DP)
        return response

    async def dp_delete(self, dp_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/dp/delete', f'dp_pk={dp_pk}')
    
    async def get_dp_by_status(self, dp_status: int) -> Response[dict[str, Any]]:
        return await self.dp_list(f'where=[{{"field":"dp_status","oper":5,"value":{dp_status}}}]&sort=dp_pk&dir=ASC')
    
    async def dp_get_enabled_by_type(self, dp_type: DPType) -> Response[dict[str, Any]]:
        return await self.dp_list(f'where=[{{"field":"dp_status","oper":5,"value":1}},{{"field":"AND"}},{{"field":"dp_type","oper":5,"value":{dp_type.value}}}]')
    
    async def dp_set_status(self, dp_pk: int,  dp_status: int) -> Response[dict[str, Any]]:
        return await self.dp_update(f'dp_pk={dp_pk}&dp_status={dp_status}')
