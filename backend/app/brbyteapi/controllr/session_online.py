from typing import Any, Literal

from ..base import BrByteAPIBase
from ..response import Response

SearchTerm = Literal["cpe_pk", "session_callingid", "session_calledid", "session_username", "session_circuit_id", "nas_name", "session_v4_ip", "session_v6_px", "session_v6_pd", "session_nas_port_id"]

class ControllrSessionOnline(BrByteAPIBase):
    async def session_online_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post('/aaa_ctl/session_online/list', body)
    
    async def session_online_list_wizard(self, search_term: SearchTerm, search_value: str = "", filter_session_status: int = -1, filter_is_auth: int = -1, filter_terminated: int = -1, filter_expired: int = -1, filter_was_terminated: int = -1, filter_service: int = -1, filter_closed: int = -1, filter_cpe_status: int = -1) -> Response[dict[str, Any]]:
        body = f"search_term={search_term}&search_value={search_value}&filter_session_status={filter_session_status}&filter_is_auth={filter_is_auth}&filter_terminated={filter_terminated}&filter_expired={filter_expired}&filter_was_terminated={filter_was_terminated}&filter_service={filter_service}&filter_closed={filter_closed}&filter_cpe_status={filter_cpe_status}"
        return await self.call_api_post('/aaa_ctl/session_online/list', body)
