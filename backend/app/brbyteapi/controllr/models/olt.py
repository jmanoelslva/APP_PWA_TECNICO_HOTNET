from enum import Enum
from pydantic import Field

from ...default_enum import DefaultEnum
from ...model import Empty, WSBaseModel

class OLTVendor(DefaultEnum, Enum):
    ALL         = -1
    UNKNOWN     = 0
    FIBERHOME   = 1
    DIGISTAR    = 2
    HUAWEI      = 3
    ZTE         = 4
    PARKS       = 5
    VSOL        = 6
    FURUKAWA    = 7
    DATACOM     = 8
    INTELBRAS   = 11
    CDATA       = 16

    DEFAULT = UNKNOWN

class OLT(WSBaseModel):
    pk				        : int               = Field(..., alias='olt_pk')
    name			        : str       | Empty = Field(default_factory=Empty, alias='olt_name')
    enabled			        : bool      | Empty = Field(default_factory=Empty, alias='olt_enabled')
    ip				        : str       | Empty = Field(default_factory=Empty, alias='olt_ip')
    port			        : int       | Empty = Field(default_factory=Empty, alias='olt_port')
    login			        : str       | Empty = Field(default_factory=Empty, alias='olt_login')
    vendor			        : OLTVendor | Empty = Field(default_factory=Empty, alias='olt_vendor')
    password		        : str       | Empty = Field(default_factory=Empty, alias='olt_password')
    password_enable	        : str       | Empty = Field(default_factory=Empty, alias='olt_password_enable')
    offices_pk			    : int       | Empty = Field(default_factory=Empty, alias='offices_pk')
    olt_debug			    : bool      | Empty = Field(default_factory=Empty, alias='olt_debug')
    onu_signal_alert	    : int       | Empty = Field(default_factory=Empty, alias='onu_signal_alert')
    onu_signal_warning	    : int       | Empty = Field(default_factory=Empty, alias='onu_signal_warning')
    tpl_wan			        : int       | Empty = Field(default_factory=Empty, alias='olt_tpl_wan')
    tpl_web			        : int       | Empty = Field(default_factory=Empty, alias='olt_tpl_web')
    tpl_wifi		        : int       | Empty = Field(default_factory=Empty, alias='olt_tpl_wifi')
    tpl_reboot		        : int       | Empty = Field(default_factory=Empty, alias='olt_tpl_reboot')
    tpl_rename		        : int       | Empty = Field(default_factory=Empty, alias='olt_tpl_rename')
    update_register	        : int       | Empty = Field(default_factory=Empty, alias='olt_update_register')
    update_info		        : int       | Empty = Field(default_factory=Empty, alias='olt_update_info')
