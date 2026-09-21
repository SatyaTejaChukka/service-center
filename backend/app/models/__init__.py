from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="STAFF", nullable=False)  # ADMIN, STAFF
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    job_cards_created = relationship("JobCard", foreign_keys="JobCard.created_by", back_populates="creator")
    job_cards_assigned = relationship("JobCard", foreign_keys="JobCard.assigned_to", back_populates="assigned_user")


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    phone = Column(String(20), nullable=False, index=True)
    alt_phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    vehicles = relationship("Vehicle", back_populates="customer")
    job_cards = relationship("JobCard", back_populates="customer")


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    registration_number = Column(String(30), nullable=False)
    registration_normalized = Column(String(30), nullable=False, index=True) # Upper alphanumeric without spaces/hyphens
    make = Column(String(50), nullable=False)
    model = Column(String(50), nullable=False)
    variant = Column(String(50), nullable=True)
    fuel_type = Column(String(20), default="Petrol", nullable=False) # Petrol, Diesel, CNG, LPG, Electric, Hybrid, Other
    vin = Column(String(50), nullable=True, index=True)
    engine_number = Column(String(50), nullable=True)
    year = Column(Integer, nullable=True)
    colour = Column(String(30), nullable=True)
    current_odometer = Column(Integer, default=0, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)

    customer = relationship("Customer", back_populates="vehicles")
    job_cards = relationship("JobCard", back_populates="vehicle")


class JobCard(Base, TimestampMixin):
    __tablename__ = "job_cards"

    id = Column(Integer, primary_key=True, index=True)
    job_card_number = Column(String(30), unique=True, index=True, nullable=False) # JC-YYYY-NNNNN
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False, index=True)
    date = Column(Date, default=datetime.utcnow().date, nullable=False, index=True)
    time_in = Column(DateTime, default=datetime.utcnow, nullable=False)
    time_out = Column(DateTime, nullable=True)
    status = Column(String(30), default="RECEIVED", nullable=False, index=True) 
    # RECEIVED, INSPECTION, WAITING_FOR_APPROVAL, APPROVED, IN_PROGRESS, READY_FOR_DELIVERY, COMPLETED, CANCELLED
    odometer = Column(Integer, default=0, nullable=False)
    fuel_level = Column(String(20), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    promised_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    cancelled_reason = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    customer = relationship("Customer", back_populates="job_cards")
    vehicle = relationship("Vehicle", back_populates="job_cards")
    creator = relationship("User", foreign_keys=[created_by], back_populates="job_cards_created")
    assigned_user = relationship("User", foreign_keys=[assigned_to], back_populates="job_cards_assigned")

    status_history = relationship("JobCardStatusHistory", back_populates="job_card", cascade="all, delete-orphan", order_by="JobCardStatusHistory.changed_at")
    complaints = relationship("Complaint", back_populates="job_card", cascade="all, delete-orphan", order_by="Complaint.sequence")
    inspections = relationship("Inspection", back_populates="job_card", cascade="all, delete-orphan")
    labour_items = relationship("LabourItem", back_populates="job_card", cascade="all, delete-orphan")
    parts_items = relationship("PartItem", back_populates="job_card", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="job_card", cascade="all, delete-orphan")
    invoice = relationship("Invoice", back_populates="job_card", uselist=False, cascade="all, delete-orphan")


class JobCardStatusHistory(Base):
    __tablename__ = "job_card_status_history"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), nullable=False, index=True)
    from_status = Column(String(30), nullable=False)
    to_status = Column(String(30), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    note = Column(Text, nullable=True)

    job_card = relationship("JobCard", back_populates="status_history")
    user = relationship("User")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), nullable=False, index=True)
    sequence = Column(Integer, default=1, nullable=False)
    description = Column(Text, nullable=False)

    job_card = relationship("JobCard", back_populates="complaints")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), nullable=False, index=True)
    category = Column(String(50), nullable=False) # Engine, Brakes, Battery, Tyres, Suspension, Lights, Fluids, AC, Others
    status = Column(String(20), default="NORMAL", nullable=False) # NORMAL, NEEDS_ATTENTION
    notes = Column(Text, nullable=True)

    job_card = relationship("JobCard", back_populates="inspections")


class LabourItem(Base, TimestampMixin):
    __tablename__ = "labour_items"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), nullable=False, index=True)
    catalog_id = Column(Integer, nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    unit_price = Column(Integer, default=0, nullable=False) # in paise
    total = Column(Integer, default=0, nullable=False) # in paise (qty * unit_price)
    status = Column(String(20), default="RECOMMENDED", nullable=False) # RECOMMENDED, APPROVED, REJECTED, DONE

    job_card = relationship("JobCard", back_populates="labour_items")


class PartItem(Base, TimestampMixin):
    __tablename__ = "parts_items"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), nullable=False, index=True)
    catalog_id = Column(Integer, nullable=True)
    description = Column(String(255), nullable=False)
    part_number = Column(String(50), nullable=True)
    unit = Column(String(20), default="pcs", nullable=False) # pcs, litre, set
    quantity = Column(Float, default=1.0, nullable=False) # allows decimal e.g. 3.5
    unit_price = Column(Integer, default=0, nullable=False) # in paise
    total = Column(Integer, default=0, nullable=False) # in paise (qty * unit_price)
    status = Column(String(20), default="RECOMMENDED", nullable=False) # RECOMMENDED, APPROVED, REJECTED, USED

    job_card = relationship("JobCard", back_populates="parts_items")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), nullable=False, index=True)
    approved_by_name = Column(String(100), nullable=False)
    method = Column(String(20), default="IN_PERSON", nullable=False) # IN_PERSON, PHONE, OTHER
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    note = Column(Text, nullable=True)

    job_card = relationship("JobCard", back_populates="approvals")
    recorder = relationship("User")


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    job_card_id = Column(Integer, ForeignKey("job_cards.id"), unique=True, nullable=False, index=True)
    invoice_number = Column(String(30), unique=True, index=True, nullable=True) # Assigned at finalisation: INV-YYYY-NNNNN
    status = Column(String(20), default="DRAFT", nullable=False, index=True) # DRAFT, FINALIZED, VOID
    parts_total = Column(Integer, default=0, nullable=False) # in paise
    labour_total = Column(Integer, default=0, nullable=False) # in paise
    other_charges_total = Column(Integer, default=0, nullable=False) # in paise
    discount = Column(Integer, default=0, nullable=False) # in paise
    discount_reason = Column(Text, nullable=True)
    tax_total = Column(Integer, default=0, nullable=False) # in paise (reserved for GST)
    round_off = Column(Integer, default=0, nullable=False) # in paise
    grand_total = Column(Integer, default=0, nullable=False) # in paise
    payment_status = Column(String(20), default="UNPAID", nullable=False, index=True) # UNPAID, PARTIALLY_PAID, PAID
    finalized_at = Column(DateTime, nullable=True)
    finalized_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    voided_at = Column(DateTime, nullable=True)
    voided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    void_reason = Column(Text, nullable=True)

    job_card = relationship("JobCard", back_populates="invoice")
    finalizer = relationship("User", foreign_keys=[finalized_by])
    voider = relationship("User", foreign_keys=[voided_by])
    other_charges = relationship("InvoiceOtherCharge", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceOtherCharge(Base):
    __tablename__ = "invoice_other_charges"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    description = Column(String(100), nullable=False)
    amount = Column(Integer, default=0, nullable=False) # in paise

    invoice = relationship("Invoice", back_populates="other_charges")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False) # in paise
    method = Column(String(30), default="CASH", nullable=False) # CASH, UPI, CARD, BANK_TRANSFER, CHEQUE, OTHER
    reference = Column(String(100), nullable=True) # UPI UTR, Cheque #, etc.
    paid_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    received_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_reversal = Column(Boolean, default=False, nullable=False)
    reversed_payment_id = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)

    invoice = relationship("Invoice", back_populates="payments")
    receiver = relationship("User")


class LabourCatalog(Base, TimestampMixin):
    __tablename__ = "labour_catalog"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    default_rate = Column(Integer, default=0, nullable=False) # in paise
    is_active = Column(Boolean, default=True, nullable=False)


class PartsCatalog(Base, TimestampMixin):
    __tablename__ = "parts_catalog"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    part_number = Column(String(50), nullable=True, index=True)
    unit = Column(String(20), default="pcs", nullable=False)
    default_price = Column(Integer, default=0, nullable=False) # in paise
    is_active = Column(Boolean, default=True, nullable=False)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(50), primary_key=True)
    value_json = Column(Text, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False) # INVOICE_FINALIZE, INVOICE_VOID, PAYMENT_ADD, PAYMENT_REVERSE, etc.
    entity = Column(String(50), nullable=False) # job_card, invoice, payment, user, settings
    entity_id = Column(String(50), nullable=False)
    before_json = Column(Text, nullable=True)
    after_json = Column(Text, nullable=True)

    user = relationship("User")


# Performance Indexes specified in Section 9.3
Index("ix_vehicles_reg_search", Vehicle.registration_normalized, Vehicle.vin, Vehicle.customer_id)
Index("ix_customers_search", Customer.phone, Customer.name)
Index("ix_job_cards_search", JobCard.job_card_number, JobCard.status, JobCard.date, JobCard.vehicle_id, JobCard.customer_id)
Index("ix_invoices_search", Invoice.invoice_number, Invoice.status, Invoice.payment_status, Invoice.job_card_id)
Index("ix_payments_search", Payment.invoice_id, Payment.paid_at)
