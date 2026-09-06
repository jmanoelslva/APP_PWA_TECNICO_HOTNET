from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.onu import ONU, ONUExtended
from ..response import Response

class ControllrONU(BrByteAPIBase):
    @overload
    async def onu_list(self, body: str, model_return: Literal[True], model_extended: Literal[False] = False) -> Response[ONU]: ...

    @overload
    async def onu_list(self, body: str, model_return: Literal[True], model_extended: Literal[True]) -> Response[ONUExtended]: ...

    @overload  
    async def onu_list(self, body: str, model_return: Literal[False] = False, model_extended: bool = False) -> Response[dict[str, Any]]: ...

    async def onu_list(self, body: str, model_return: bool = False, model_extended: bool = False) -> Response[ONU] | Response[ONUExtended] | Response[dict[str, Any]]:
        response = await self.call_api_post("/fiber_ctl/onu/list", body)
        if model_return:
            if model_extended:
                return response.cast(ONUExtended)
            else:
                return response.cast(ONU)
        return response
    
    async def onu_apply_wan(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/fiber_ctl/onu/apply_wan', body)
    
    @overload  
    async def onu_list_by_ospo(self, olt_pk: int, slot_id: int = -1, port_id: int = -1, onu_id: int = -1, frame_id: int = -1, model_return: Literal[False] = False, model_extended: bool = False) -> Response[dict[str, Any]]: ...

    @overload
    async def onu_list_by_ospo(self, olt_pk: int, slot_id: int = -1, port_id: int = -1, onu_id: int = -1, frame_id: int = -1, model_return: Literal[True] = True, model_extended: Literal[False] = False) -> Response[ONU]: ...

    @overload
    async def onu_list_by_ospo(self, olt_pk: int, slot_id: int = -1, port_id: int = -1, onu_id: int = -1, frame_id: int = -1, model_return: Literal[True] = True, model_extended: Literal[True] = True) -> Response[ONUExtended]: ...

    async def onu_list_by_ospo(self, olt_pk: int, slot_id: int = -1, port_id: int = -1, onu_id: int = -1, frame_id: int = -1, model_return: bool = False, model_extended: bool = False) -> Response[ONU] | Response[ONUExtended] | Response[dict[str, Any]]:
        return await self.onu_list(f"olt_pk={olt_pk}&frame_id={frame_id}&slot_id={slot_id}&port_id={port_id}&onu_id={onu_id}&sort=onu_ponid&dir=ASC", model_return, model_extended)
    
    async def onu_update_info(self, olt_pk: int, onu_serial: str, slot_id: int, port_id: int, onu_id: int, frame_id: int = 1) -> Response[dict[str, Any]]:
        return await self.call_api_post('/fiber_ctl/onu/list_info', f"olt_pk={olt_pk}&onu_serial={onu_serial}&frame_id={frame_id}&slot_id={slot_id}&port_id={port_id}&onu_id={onu_id}")
