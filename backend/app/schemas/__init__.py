from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, Field, ConfigDict

# --- Auth Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "STAFF"  # ADMIN or STAFF

class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class SetupWizardRequest(BaseModel):
    admin_username: str
    admin_password: str
    admin_full_name: str
    business_name: str
    business_address: str
    business_phone: str
    business_email: Optional[str] = None
    business_gstin: Optional[str] = None
    business_upi_id: Optional[str] = None
    data_dir_path: Optional[str] = None

# --- Customer Schemas ---
class CustomerBase(BaseModel):
    name: str
    phone: str
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Vehicle Schemas ---
class VehicleBase(BaseModel):
    registration_number: str
    make: str
    model: str
    variant: Optional[str] = None
    fuel_type: str = "Petrol"
    vin: Optional[str] = None
    engine_number: Optional[str] = None
    year: Optional[int] = None
    colour: Optional[str] = None
    current_odometer: int = 0

class VehicleCreate(VehicleBase):
    customer_id: int

class VehicleUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    variant: Optional[str] = None
    fuel_type: Optional[str] = None
    vin: Optional[str] = None
    engine_number: Optional[str] = None
    year: Optional[int] = None
    colour: Optional[str] = None
    current_odometer: Optional[int] = None

class VehicleResponse(VehicleBase):
    id: int
    customer_id: int
    registration_normalized: str
    is_archived: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Complaint Schemas ---
class ComplaintCreate(BaseModel):
    sequence: int = 1
    description: str

class ComplaintResponse(BaseModel):
    id: int
    sequence: int
    description: str

    model_config = ConfigDict(from_attributes=True)

# --- Inspection Schemas ---
class InspectionItem(BaseModel):
    category: str
    status: str = "NORMAL" # NORMAL, NEEDS_ATTENTION
    notes: Optional[str] = None

class InspectionResponse(InspectionItem):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- Labour & Parts Schemas ---
class LabourItemCreate(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: int  # in paise
    status: str = "RECOMMENDED" # RECOMMENDED, APPROVED, REJECTED, DONE
    catalog_id: Optional[int] = None

class LabourItemResponse(LabourItemCreate):
    id: int
    total: int

    model_config = ConfigDict(from_attributes=True)

class PartItemCreate(BaseModel):
    description: str
    part_number: Optional[str] = None
    unit: str = "pcs"
    quantity: float = 1.0
    unit_price: int  # in paise
    status: str = "RECOMMENDED" # RECOMMENDED, APPROVED, REJECTED, USED
    catalog_id: Optional[int] = None

class PartItemResponse(PartItemCreate):
    id: int
    total: int

    model_config = ConfigDict(from_attributes=True)

# --- Approval Schemas ---
class ApprovalRecordRequest(BaseModel):
    approved_by_name: str
    method: str = "IN_PERSON" # IN_PERSON, PHONE, OTHER
    note: Optional[str] = None
    line_approvals: List[dict] # [{"type": "part|labour", "id": 1, "status": "APPROVED|REJECTED"}]

# --- Job Card Schemas ---
class JobCardCreate(BaseModel):
    customer_id: int
    vehicle_id: int
    date: Optional[date] = None
    odometer: int
    fuel_level: Optional[str] = "1/2"
    assigned_to: Optional[int] = None
    promised_at: Optional[datetime] = None
    notes: Optional[str] = None
    complaints: List[str] = []

class JobCardStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None
    cancelled_reason: Optional[str] = None

class JobCardResponse(BaseModel):
    id: int
    job_card_number: str
    customer_id: int
    vehicle_id: int
    date: date
    time_in: datetime
    time_out: Optional[datetime] = None
    status: str
    odometer: int
    fuel_level: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Invoice & Payment Schemas ---
class OtherChargeCreate(BaseModel):
    description: str
    amount: int # in paise

class OtherChargeResponse(OtherChargeCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)

class PaymentCreate(BaseModel):
    amount: int # in paise
    method: str = "CASH" # CASH, UPI, CARD, BANK_TRANSFER, CHEQUE, OTHER
    reference: Optional[str] = None
    note: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    amount: int
    method: str
    reference: Optional[str] = None
    paid_at: datetime
    is_reversal: bool
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class InvoiceSummaryResponse(BaseModel):
    id: int
    invoice_number: Optional[str] = None
    status: str
    parts_total: int
    labour_total: int
    other_charges_total: int
    discount: int
    tax_total: int
    round_off: int
    grand_total: int
    amount_paid: int
    balance_due: int
    payment_status: str
    finalized_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class VoidInvoiceRequest(BaseModel):
    reason: str

# Catalogs
class LabourCatalogItem(BaseModel):
    id: int
    name: str
    default_rate: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class PartsCatalogItem(BaseModel):
    id: int
    name: str
    part_number: Optional[str] = None
    unit: str
    default_price: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

Token.model_rebuild()
