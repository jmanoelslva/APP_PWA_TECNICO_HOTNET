from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.olt import OLT
from ..response import Response

class ControllrOLT(BrByteAPIBase):
    @overload
    async def olt_list(self, body: str, model_return: Literal[True]) -> Response[OLT]: ...

    @overload  
    async def olt_list(self, body: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...

    async def olt_list(self, body: str, model_return: bool = False) -> Response[OLT] | Response[dict[str, Any]]:
        response = await self.call_api_post('/fiber_ctl/olt/list', body)
        if model_return:
            return response.cast(OLT)
        return response

    @overload
    async def olt_list_by_name(self, olt_hostname: str, model_return: Literal[True]) -> Response[OLT]: ...

    @overload  
    async def olt_list_by_name(self, olt_hostname: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...

    async def olt_list_by_name(self, olt_hostname: str, model_return: bool = False) -> Response[OLT] | Response[dict[str, Any]]:
        response = await self.olt_list(f"search_term=olt_name&search_value={olt_hostname}&load_vendor=-1&load_enabled=1")
        if model_return:
            return response.cast(OLT)
        return response


