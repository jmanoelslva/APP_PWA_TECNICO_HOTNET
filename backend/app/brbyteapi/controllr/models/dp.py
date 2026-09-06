from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from pydantic import Field, field_validator
from ...model import WSBaseModel

class DP(WSBaseModel):
    pk          : int           = Field(...,    alias='dp_pk')
    id          : int | None    = Field(None,   alias='dp_id')
    name        : str | None    = Field(None,   alias='dp_name')
    desc        : str | None    = Field(None,   alias='dp_desc')
    type        : int           = Field(...,    alias='dp_type')
    status      : int           = Field(...,    alias='dp_status')
    limit       : int           = Field(...,    alias='dp_limit')
    color       : str | None    = Field(None,   alias='dp_color')
    latitude    : Decimal       = Field(...,    alias='dp_lat')
    longitude   : Decimal       = Field(...,    alias='dp_lng')
    ds_pk       : int           = Field(...,    alias='ds_pk')
    ds_name     : str | None    = Field(None,   alias='ds_name')
    ds_color    : str | None    = Field(None,   alias='ds_color')

    @field_validator('id', mode='before')
    def validate_id(cls, value: str) -> int | None:
        if value.isdigit():
            return int(value)
        return None

    @field_validator('pk', 'type', 'status', 'limit', 'ds_pk', mode='before')
    def validate_int(cls, value: str) -> int:
        return int(value)

    @field_validator('latitude', 'longitude', mode='before')
    def validate_decimal(cls, value: str) -> Decimal:
        return Decimal(value).quantize(Decimal('0.00000001'), rounding=ROUND_HALF_UP)

class DPType(Enum):
    GENERIC = 0
    FTTP = 1
    FTTB = 2
    FTTD = 3
    FTTH = 4
    FTTN = 5
    FTTC = 6
