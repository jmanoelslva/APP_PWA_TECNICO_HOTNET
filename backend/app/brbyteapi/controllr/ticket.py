from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrTicket(BrByteAPIBase):
    async def ticket_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/ticket/list', body)
    
    async def ticket_change_contract(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/ticket/change_contract', body)
    
    async def ticket_change_priority(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/ticket/change_priority', body)
    
    async def ticket_change_status(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/ticket/change_status', body)
    
    async def ticket_change_user(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/ticket/change_user', body)
    
    async def ticket_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/ticket/create', body)
    
    async def get_ticket_pk(self, ticket_protocol: str) -> str | None:
        body = f'where=[{{"field":"ticket_protocol","oper":5,"value":"{ticket_protocol}"}}]&limit=1'

        response = await self.call_api_post('/support_ctl/ticket/list', body)
        if response.success and response.total == 1:
            ticket_pk = response.results[0].get("ticket_pk")
            return ticket_pk
        else:
            return None
    
    async def ticket_close(self, ticket_pk: str | None = None, ticket_protocol: str | None = None, op_desc: str | None = None) -> Response[dict[str, Any]] | None:
        if not ticket_pk and not ticket_protocol:
            return None
        
        if ticket_protocol:
            ticket_pk = await self.get_ticket_pk(ticket_protocol)
        
        if not ticket_pk:
            return None

        body = f"ticket_pk={ticket_pk}&op_code=1"
        if op_desc: body += f"&op_desc={op_desc}"
        
        return await self.ticket_change_status(body)
