from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrInvoice(BrByteAPIBase):
    async def invoice_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/invoice_ctl/invoice/list', body)
    
    async def invoice_list_info(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/invoice_ctl/invoice/list_info', body)
    
    async def get_last_open_invoices(self, contract_number: int, invoice_limit: int = 1) -> Response[dict[str, Any]]:
        body = f'where=[{{"field":"contract_number","oper":5,"value":"{contract_number}"}},{{"field":"AND"}},{{"field":"invoice_date_credit","oper":7,"value":null}},{{"field":"AND"}},{{"field":"invoice_deleted","oper":7,"value":false}},{{"field":"AND"}},{{"field":"invoice_nosso_num","oper":8,"value":null}}]&limit={invoice_limit}&sort=invoice_date_due&dir=ASC'
        return await self.call_api_post('/invoice_ctl/invoice/list', body)
    
    async def observation_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/invoice_ctl/observation/create', body)
    
    async def observation_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/invoice_ctl/observation/list', body)
