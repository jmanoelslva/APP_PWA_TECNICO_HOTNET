from pydantic import Field
from ...model import WSBaseModel

class ContractTemplate(WSBaseModel):
    pk          : int           = Field(...,    alias='contract_layouts_pk')
    deleted     : bool          = Field(False,  alias='contract_layouts_deleted')
    sign        : str | None    = Field(...,    alias='contract_layouts_sign')
    signed      : str | None    = Field(...,    alias='contract_layouts_signed')
    text        : str | None    = Field(...,    alias='contract_layouts_text')
    title       : str | None    = Field(...,    alias='contract_layouts_title')

class ContractTemplateCombo(WSBaseModel):
    pk          : int           = Field(...,    alias='contract_layouts_pk')
    title       : str | None    = Field(...,    alias='contract_layouts_title')
