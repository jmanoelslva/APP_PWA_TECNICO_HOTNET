from typing import Any, Literal, overload

from ..base import BrByteAPIBase
from .models.contract_template import ContractTemplate, ContractTemplateCombo
from ..response import Response

class ControllrContractTemplate(BrByteAPIBase):
    @overload
    async def contract_template_list(self, body: str, model_return: Literal[True]) -> Response[ContractTemplate]: ...

    @overload  
    async def contract_template_list(self, body: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...

    async def contract_template_list(self, body: str, model_return: bool = False) -> Response[ContractTemplate] | Response[dict[str, Any]]:
        response = await self.call_api_post("/controllrctl/contract_tpl/list", body)
        if model_return:
            return response.cast(ContractTemplate)
        return response

    @overload
    async def contract_template_list_combo(self, body: str, model_return: Literal[True]) -> Response[ContractTemplateCombo]: ...

    @overload  
    async def contract_template_list_combo(self, body: str, model_return: Literal[False] = False) -> Response[dict[str, Any]]: ...

    async def contract_template_list_combo(self, body: str, model_return: bool = False) -> Response[ContractTemplateCombo] | Response[dict[str, Any]]:
        response = await self.call_api_post("/controllrctl/contract_tpl/list", body)
        if model_return:
            return response.cast(ContractTemplateCombo)
        return response
