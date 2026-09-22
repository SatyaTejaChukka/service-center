from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit import record_audit
from app.models import Customer, Vehicle, JobCard, Invoice, User
from app.schemas import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter()

@router.get("", response_model=List[CustomerResponse])
def get_customers(
    search: Optional[str] = None,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Customer)
    if not include_archived:
        query = query.filter(Customer.is_archived == False)
    
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(Customer.name.like(s), Customer.phone.like(s)))
    
    return query.order_by(Customer.name).offset(skip).limit(limit).all()

@router.post("", response_model=CustomerResponse)
def create_customer(
    req: CustomerCreate,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    clean_phone = req.phone.strip()
    existing = db.query(Customer).filter(Customer.phone == clean_phone, Customer.is_archived == False).first()
    if existing and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "A customer with this phone number already exists",
                "existing_customer_id": existing.id,
                "name": existing.name,
                "phone": existing.phone
            }
        )

    customer = Customer(
        name=req.name.strip(),
        phone=clean_phone,
        alt_phone=req.alt_phone.strip() if req.alt_phone else None,
        email=req.email.strip() if req.email else None,
        address=req.address.strip() if req.address else None,
        notes=req.notes.strip() if req.notes else None
    )
    db.add(customer)
    db.flush()
    record_audit(db, current_user.id, "CUSTOMER_CREATE", "customer", str(customer.id), None, {"name": customer.name, "phone": customer.phone})
    db.commit()
    db.refresh(customer)
    return customer

@router.get("/{customer_id}")
def get_customer_detail(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Fetch customer vehicles
    vehicles = db.query(Vehicle).filter(Vehicle.customer_id == cust.id, Vehicle.is_archived == False).all()

    # Fetch all job cards & invoices
    job_cards = db.query(JobCard).filter(JobCard.customer_id == cust.id).order_by(JobCard.date.desc()).all()
    
    lifetime_spend = 0
    total_outstanding = 0
    jobs_summary = []

    for jc in job_cards:
        inv = jc.invoice
        inv_data = None
        if inv and inv.status != "VOID":
            lifetime_spend += inv.grand_total
            paid = sum(p.amount for p in inv.payments if not p.is_reversal)
            balance = max(0, inv.grand_total - paid)
            total_outstanding += balance
            inv_data = {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "grand_total": inv.grand_total,
                "payment_status": inv.payment_status,
                "balance_due": balance
            }

        jobs_summary.append({
            "id": jc.id,
            "job_card_number": jc.job_card_number,
            "date": jc.date.strftime("%d/%m/%Y"),
            "status": jc.status,
            "vehicle_reg": jc.vehicle.registration_number if jc.vehicle else "",
            "vehicle_model": f"{jc.vehicle.make} {jc.vehicle.model}" if jc.vehicle else "",
            "invoice": inv_data
        })

    return {
        "customer": CustomerResponse.model_validate(cust),
        "vehicles": [
            {
                "id": v.id,
                "registration_number": v.registration_number,
                "make": v.make,
                "model": v.model,
                "current_odometer": v.current_odometer
            } for v in vehicles
        ],
        "lifetime_spend": lifetime_spend,
        "total_outstanding": total_outstanding,
        "job_cards": jobs_summary
    }

@router.patch("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    req: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    before = {"name": cust.name, "phone": cust.phone, "address": cust.address}
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(cust, k, v)

    record_audit(db, current_user.id, "CUSTOMER_UPDATE", "customer", str(cust.id), before, update_data)
    db.commit()
    db.refresh(cust)
    return cust

@router.post("/{customer_id}/archive")
def archive_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    cust.is_archived = True
    record_audit(db, current_user.id, "CUSTOMER_ARCHIVE", "customer", str(cust.id), None, {"is_archived": True})
    db.commit()
    return {"message": "Customer archived successfully"}
