from .acl_user import ControllrACLUser
from .address import ControllrAddress
from .annex import ControllrAnnex
from .client import ControllrClient
from .client_category import ControllrClientCategory
from .contract_details import ControllrContractDetails
from .contract_item import ControllrContractItem
from .contract_tpl import ControllrContractTemplate
from .contract import ControllrContract
from .co_service import ControllrCoService
from .cpe import ControllrCPE
from .email import ControllrEmail
from .invoice import ControllrInvoice
from .dp import ControllrDP
from .ds import ControllrDS
from .login import ControllrLogin
from .olt import ControllrOLT
from .onu import ControllrONU
from .op import ControllrOp
from .phone import ControllrPhone
from .plan import ControllrPlan
from .session_online import ControllrSessionOnline
from .stock_equipment import ControllrStockEquipment
from .support_category import ControllrSupportCategory
from .ticket import ControllrTicket

class AsyncControllr(
    ControllrACLUser,
    ControllrAddress,
    ControllrAnnex,
    ControllrClient,
    ControllrClientCategory,
    ControllrContractDetails,
    ControllrContractItem,
    ControllrContractTemplate,
    ControllrContract,
    ControllrCoService,
    ControllrCPE,
    ControllrEmail,
    ControllrInvoice,
    ControllrDP,
    ControllrDS,
    ControllrLogin,
    ControllrOLT,
    ControllrONU,
    ControllrOp,
    ControllrPhone,
    ControllrPlan,
    ControllrSessionOnline,
    ControllrStockEquipment,
    ControllrSupportCategory,
    ControllrTicket
):
    pass