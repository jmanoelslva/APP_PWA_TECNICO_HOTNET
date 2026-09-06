from pydantic import Field
from typing import Any

from ...model import Empty, WSBaseModel

class PhoneCombo(WSBaseModel):
    pk                      : int           = Field(..., alias='phone_pk')
    identification          : str   | Empty = Field(default_factory=Empty, alias='phone_identification')
    number                  : str   | Empty = Field(default_factory=Empty, alias='phone_number')
    operator                : str   | Empty = Field(default_factory=Empty, alias='phone_operator')
    type                    : int   | Empty = Field(default_factory=Empty, alias='phone_type')
    client_pk               : int   | Empty = Field(default_factory=Empty, alias='client_pk')
    sva                     : int   | Empty = Field(default_factory=Empty, alias='phone_sva')
    status                  : int   | Empty = Field(default_factory=Empty, alias='phone_status')
    valid                   : int   | Empty = Field(default_factory=Empty, alias='phone_valid')
    code                    : str   | Empty = Field(default_factory=Empty, alias='phone_code')

class PhoneExtended(PhoneCombo):
    phone_date_cad          : bool  | Empty = Field(default_factory=Empty, alias='phone_phone_date_cad')
    phone_date_edt          : float | Empty = Field(default_factory=Empty, alias='phone_phone_date_edt')
    client_name             : Any   | Empty = Field(default_factory=Empty, alias='client_name')
    client_lastname         : Any   | Empty = Field(default_factory=Empty, alias='client_lastname')
    client_complete_name    : Any   | Empty = Field(default_factory=Empty, alias='client_complete_name')
    client_status           : bool  | Empty = Field(default_factory=Empty, alias='client_status')
    client_type             : Any   | Empty = Field(default_factory=Empty, alias='client_type')
    category_pk             : Any   | Empty = Field(default_factory=Empty, alias='category_pk')
    category_name           : float | Empty = Field(default_factory=Empty, alias='category_name')
    category_color          : float | Empty = Field(default_factory=Empty, alias='category_color')

