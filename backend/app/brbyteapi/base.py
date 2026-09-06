import json
import re as regex
from aiohttp import ClientResponse, ClientSession, ClientTimeout, FormData
from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema
from typing import Any

from .response import Response

class BrByteAPIBase():
    def __init__(self, authorization: str, server_url: str, timeout: int = 10, alias: str = ""):   
        self.alias = alias
        self.headers: dict[str, Any] = dict()
        self.headers['Authorization'] = authorization
        self.server_url = server_url
        self.timeout: ClientTimeout = ClientTimeout(timeout)

    @classmethod
    def __get_pydantic_core_schema__(cls, source_type: Any, handler: GetCoreSchemaHandler) -> core_schema.CoreSchema:
        return core_schema.is_instance_schema(cls)
    
    async def __process_and_sanitize_response(self, response: ClientResponse) -> Response[dict[str, Any]]:
        raw_response = await response.read()
        sanitized_response = raw_response.decode('utf-8', errors='replace')
        sanitized_response = regex.sub(r'\\[^\\"bfnrtu]', '', sanitized_response)
        sanitized_response = regex.sub(r'\\u[0-9A-Fa-f]{0,3}[^0-9A-Fa-f]', '', sanitized_response)
        try:
            response_json: dict[str, Any] = json.loads(sanitized_response) or {}
        except json.JSONDecodeError:
            return Response[dict[str, Any]](
                errors  = [{"id": "_base", "msg": f"Invalid JSON after sanitization"}],
                status  = 500,
                success = False
            )
        
        return Response[dict[str, Any]](
            errors  = response_json.get('errors', []),
            results = response_json.get('results', []),
            status  = response.status,
            success = True if 200 <= response.status <= 299 else False
        )
            
    async def call_api_post(self, api_path: str, data: str | FormData | None = None) -> Response[dict[str, Any]]:
        url = f"{self.server_url}{api_path}"
        async with ClientSession() as session:
            async with session.post(url=url, data=data, headers=self.headers, timeout=self.timeout) as response:
                return await self.__process_and_sanitize_response(response)
