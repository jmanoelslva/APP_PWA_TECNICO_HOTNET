from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.cpe import CPE, CPECombo, CPEExtended
from ..response import Response

class ControllrCPE(BrByteAPIBase):
    @overload
    async def cpe_list(self, body: str, model_return: Literal[True], model_extended: Literal[False] = False) -> Response[CPE]: ...

    @overload
    async def cpe_list(self, body: str, model_return: Literal[True], model_extended: Literal[True]) -> Response[CPEExtended]: ...

    @overload  
    async def cpe_list(self, body: str, model_return: Literal[False] = False, model_extended: bool = False) -> Response[dict[str, Any]]: ...

    async def cpe_list(self, body: str, model_return: bool = False, model_extended: bool = False) -> Response[CPE] | Response[CPEExtended] | Response[dict[str, Any]]:
        response = await self.call_api_post('/aaa_ctl/cpe/list', body)

        if model_return:
            if model_extended:
                return response.cast(CPEExtended)
            else:
                return response.cast(CPE)
        return response
    
    @overload
    async def cpe_list_combo(self, body: str, model_return: Literal[True]) -> Response[CPECombo]: ...

    @overload  
    async def cpe_list_combo(self, body: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...

    async def cpe_list_combo(self, body: str, model_return: bool = False) -> Response[CPECombo] | Response[dict[str, Any]]:
        response = await self.call_api_post('/aaa_ctl/cpe/list_combo', body)
        if model_return:
            return response.cast(CPECombo)
        return response
   
    async def cpe_list_location(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/cpe/list_location', body)
    
    async def cpe_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/cpe/create', body)
    
    async def cpe_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/cpe/update', body)
    
    async def get_enabled_cpe_with_circuit_id_authentication(self) -> list[dict[str, Any]]:
        response = await self.call_api_post('/aaa_ctl/cpe/list_combo', 'where=[{"field":"contract_status","oper":6,"value":0},{"field":"AND"},{"field":"cpe_status","oper":5,"value":1},{"field":"AND"},{"field":"cpe_auth_type","oper":5,"value":4}]')
        if response.success:
            return response.results
        return []
        
    async def set_cpe_dp(self, cpe_pk: int, dp_pk: int) -> bool:
        response = await self.call_api_post('/aaa_ctl/cpe/update', f'cpe_pk={cpe_pk}&dp_pk={dp_pk}')
        return response.success
    
    async def set_cpe_plan(self, cpe_pk: int, plan_pk: int) -> bool:
        response = await self.call_api_post('/aaa_ctl/cpe/update', f'cpe_pk={cpe_pk}&plan_pk={plan_pk}')
        return response.success
    
    async def set_cpe_free(self, cpe_pk: int, cpe_free: bool = True) -> bool:
        response = await self.call_api_post('/aaa_ctl/cpe/update', f'cpe_pk={cpe_pk}&cpe_free={str(cpe_free).lower()}')
        return response.success
