from aiohttp import FormData
from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrAnnex(BrByteAPIBase):
    async def support_annex_upload(self, form_data: FormData) -> Response[dict[str, Any]]:
        return await self.call_api_post('/support_ctl/annex/upload', form_data)
