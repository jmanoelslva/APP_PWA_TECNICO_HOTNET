from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.plan import Plan, PlanExtended
from ..response import Response

class ControllrPlan(BrByteAPIBase):
    @overload
    async def plan_list(self, body: str, model_return: Literal[True], model_extended: Literal[False] = False) -> Response[Plan]: ...

    @overload
    async def plan_list(self, body: str, model_return: Literal[True], model_extended: Literal[True]) -> Response[PlanExtended]: ...

    @overload  
    async def plan_list(self, body: str, model_return: Literal[False] = False, model_extended: bool = False) -> Response[dict[str, Any]]: ...

    async def plan_list(self, body: str, model_return: bool = False, model_extended: bool = False) -> Response[Plan] | Response[PlanExtended] | Response[dict[str, Any]]:
        response = await self.call_api_post("/aaa_ctl/plan/list", body)
        if model_return:
            if model_extended:
                return response.cast(PlanExtended)
            else:
                return response.cast(Plan)
        return response
    
    async def plan_list_combo(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/plan/list_combo', body)
    
    async def plan_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/plan/create', body)
    
    async def plan_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/plan/update', body)
    
    async def plan_delete(self, plan_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/plan/delete', f"plan_pk={plan_pk}&plan_deleted=1")
