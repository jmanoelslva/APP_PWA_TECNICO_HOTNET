from typing import Any

from ..base import BrByteAPIBase
from ..response import Response

class ControllrContractItem(BrByteAPIBase):
    async def contract_item_list(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/list", body)

    async def contract_item_charge_add(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/charge_add", body)

    async def contract_item_charge_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/charge_update", body)

    async def contract_item_discount_add(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/discount_add", body)

    async def contract_item_discount_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/discount_update", body)

    async def contract_item_equipment_add(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/equipment_add", body)

    async def contract_item_integration_update(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/integration_update", body)

    async def contract_item_charge_delete(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/charge_delete", body)

    async def contract_item_discount_delete(self, body: str) -> Response[dict[str, Any]]:
        return await self.call_api_post("/controllrctl/contract_item/discount_delete", body)

    async def contract_item_charge_add_wizard(
        self,
        contract_pk: int,
        contract_item_pk: int,
        cpe_pk: int | None,
        plan_pk: int,
        contract_item_description: str,
        contract_item_gen_nf: int,
        contract_item_amount: float,
        contract_item_status: int = 1,
        contract_item_client_show: str = "true",
        contract_item_tag: str = "",
    ) -> Response[dict[str, Any]]:
        body = f"contract_pk={contract_pk}&contract_item_pk={contract_item_pk}&contract_item_status={contract_item_status}&contract_item_client_show={contract_item_client_show}&plan_pk={plan_pk}&contract_item_description={contract_item_description}&contract_item_tag={contract_item_tag}&contract_item_gen_nf={contract_item_gen_nf}&contract_item_amount={contract_item_amount}"
        if cpe_pk is not None:
            body += f"&cpe_pk={cpe_pk}"

        return await self.call_api_post("/controllrctl/contract_item/charge_add", body)
