from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.phone import PhoneCombo, PhoneExtended
from ..response import Response

class ControllrPhone(BrByteAPIBase):
    @overload
    async def phone_list_combo(self, body: str, model_return: Literal[True], model_extended: Literal[False] = False) -> Response[PhoneCombo]: ...

    @overload
    async def phone_list_combo(self, body: str, model_return: Literal[True], model_extended: Literal[True]) -> Response[PhoneExtended]: ...

    @overload  
    async def phone_list_combo(self, body: str, model_return: Literal[False] = False, model_extended: bool = False) -> Response[dict[str, Any]]: ...

    async def phone_list_combo(self, body: str, model_return: bool = False, model_extended: bool = False) -> Response[PhoneCombo] | Response[PhoneExtended] | Response[dict[str, Any]]:
        response = await self.call_api_post("/controllrctl/phone/list_combo", body)
        if model_return:
            if model_extended:
                return response.cast(PhoneExtended)
            else:
                return response.cast(PhoneCombo)
        return response

    async def phone_list(self, body: str = '') -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/phone/list', body)
    
    async def phone_create(self, body: str = '') -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/phone/create', body)
    
    async def phone_update(self, body: str = '') -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/phone/update', body)
    
    async def phone_delete(self, phone_pk: int) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/phone/delete', f'phone_pk={phone_pk}')
