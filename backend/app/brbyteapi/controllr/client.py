from typing import Any

from ..base import BrByteAPIBase
from ..response import Response
from urllib.parse import quote

class ControllrClient(BrByteAPIBase):
    async def client_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/client/list', body)
    
    async def client_create(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/client/create', body)
    
    async def client_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/controllrctl/client/update', body)
    
    async def set_client_category_pk(self, client_pk: int, category_pk: int) -> Response[dict[str, Any]]:
        response = await self.client_list(f'where=[{{"field":"client.client_pk","oper":5,"value":{client_pk}}}]&limit=1')
        if response.success and response.total == 1:
            offices_pk = response.results[0].get('offices_pk')
            client_type = response.results[0].get('client_type')
            client_status = response.results[0].get('client_status')
            client_name = quote(response.results[0].get('client_name', ''))
            client_lastname = quote(response.results[0].get('client_lastname', ''))
            return await self.call_api_post('/controllrctl/client/update', f'client_pk={client_pk}&category_pk={category_pk}&offices_pk={offices_pk}&client_type={client_type}&client_status={client_status}&client_name={client_name}&client_lastname={client_lastname}')
        return response
