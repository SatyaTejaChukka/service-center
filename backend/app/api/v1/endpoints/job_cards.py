from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit import record_audit
from app.models import (
    JobCard, JobCardStatusHistory, Complaint, Inspection,
    LabourItem, PartItem, Approval, Invoice, Payment, Customer, Vehicle, User, Setting
)
from app.schemas import (
    JobCardCreate, JobCardStatusUpdate, JobCardResponse,
    ComplaintCreate, InspectionItem, LabourItemCreate, PartItemCreate,
    ApprovalRecordRequest
)
from app.services.numbering_service import generate_job_card_number
from app.services.calculation_service import (
    calculate_invoice_totals, calculate_line_total,
    LineItemCalc, OtherChargeCalc, PaymentCalc
)
from app.services.pdf_service import generate_job_card_pdf
import json

router = APIRouter()

STANDARD_INSPECTION_CATEGORIES = [
    "Engine", "Brakes", "Battery", "Tyres", "Suspension",
    "Lights", "Fluids", "AC", "Others"
]

VALID_JOB_CARD_STATUSES = {
    "RECEIVED", "INSPECTION", "WAITING_FOR_APPROVAL", "APPROVED",
    "IN_PROGRESS", "READY_FOR_DELIVERY", "COMPLETED", "CANCELLED"
}

def recalculate_job_card_invoice(db: Session, job_card: JobCard) -> Invoice:
    """Helper to recalculate draft invoice totals from approved job card lines."""
    inv = job_card.invoice
    if not inv or inv.status != "DRAFT":
        return inv

    parts_calc = [
        LineItemCalc(quantity=p.quantity, unit_price=p.unit_price, status=p.status)
        for p in job_card.parts_items
    ]
    labour_calc = [
        LineItemCalc(quantity=l.quantity, unit_price=l.unit_price, status=l.status)
        for l in job_card.labour_items
    ]
    other_calc = [
        OtherChargeCalc(amount=o.amount)
        for o in inv.other_charges
    ]
    all_payments = db.query(Payment).filter(Payment.invoice_id == inv.id).all()
    payments_calc = [
        PaymentCalc(amount=p.amount, is_reversal=p.is_reversal)
        for p in all_payments
    ]

    res = calculate_invoice_totals(
        parts=parts_calc,
        labour=labour_calc,
        other_charges=other_calc,
        discount_paise=inv.discount,
        tax_paise=inv.tax_total,
        round_off_paise=inv.round_off,
        payments=payments_calc,
        is_draft=True
    )

    inv.parts_total = res.parts_total
    inv.labour_total = res.labour_total
    inv.other_charges_total = res.other_charges_total
    inv.discount = res.discount
    inv.grand_total = res.grand_total
    inv.payment_status = res.payment_status
    db.flush()
    return inv

@router.get("")
def list_job_cards(
    status_filter: Optional[str] = None,
    vehicle_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(JobCard)
    if status_filter:
        query = query.filter(JobCard.status == status_filter)
    if vehicle_id:
        query = query.filter(JobCard.vehicle_id == vehicle_id)
    if customer_id:
        query = query.filter(JobCard.customer_id == customer_id)

    job_cards = query.order_by(JobCard.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for j in job_cards:
        results.append({
            "id": j.id,
            "job_card_number": j.job_card_number,
            "date": j.date.strftime("%d/%m/%Y"),
            "status": j.status,
            "customer_name": j.customer.name if j.customer else "",
            "customer_phone": j.customer.phone if j.customer else "",
            "vehicle_reg": j.vehicle.registration_number if j.vehicle else "",
            "vehicle_model": f"{j.vehicle.make} {j.vehicle.model}" if j.vehicle else "",
            "odometer": j.odometer,
            "created_at": j.created_at.isoformat(),
            "invoice_total": j.invoice.grand_total if j.invoice else 0,
            "invoice_status": j.invoice.status if j.invoice else "NONE"
        })
    return results

@router.post("", response_model=JobCardResponse)
def create_job_card(
    req: JobCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    veh = db.query(Vehicle).filter(Vehicle.id == req.vehicle_id).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Check odometer progression
    if req.odometer < veh.current_odometer:
        # Warning logged, but allow intake
        pass
    veh.current_odometer = max(veh.current_odometer, req.odometer)

    jc_number = generate_job_card_number(db)
    
    job_card = JobCard(
        job_card_number=jc_number,
        customer_id=req.customer_id,
        vehicle_id=req.vehicle_id,
        date=req.date or datetime.utcnow().date(),
        time_in=datetime.utcnow(),
        status="RECEIVED",
        odometer=req.odometer,
        fuel_level=req.fuel_level,
        assigned_to=req.assigned_to,
        promised_at=req.promised_at,
        notes=req.notes,
        created_by=current_user.id
    )
    db.add(job_card)
    db.flush()

    # Initial status history entry
    hist = JobCardStatusHistory(
        job_card_id=job_card.id,
        from_status="NONE",
        to_status="RECEIVED",
        changed_by=current_user.id,
        note="Job card opened"
    )
    db.add(hist)

    # Initialize default inspection checklist
    for cat in STANDARD_INSPECTION_CATEGORIES:
        insp = Inspection(
            job_card_id=job_card.id,
            category=cat,
            status="NORMAL",
            notes=None
        )
        db.add(insp)

    # Add complaints
    for idx, comp_text in enumerate(req.complaints, start=1):
        if comp_text.strip():
            c = Complaint(
                job_card_id=job_card.id,
                sequence=idx,
                description=comp_text.strip()
            )
            db.add(c)

    # Initialize linked Draft Invoice
    inv = Invoice(
        job_card_id=job_card.id,
        invoice_number=None,
        status="DRAFT",
        parts_total=0,
        labour_total=0,
        other_charges_total=0,
        discount=0,
        tax_total=0,
        round_off=0,
        grand_total=0,
        payment_status="UNPAID"
    )
    db.add(inv)

    record_audit(db, current_user.id, "JOB_CARD_CREATE", "job_card", str(job_card.id), None, {"number": jc_number})
    db.commit()
    db.refresh(job_card)
    return job_card

@router.get("/{job_card_id}")
def get_job_card_detail(
    job_card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")

    recalculate_job_card_invoice(db, jc)

    # Previous service check for the vehicle (helper card)
    prev_job = db.query(JobCard).filter(
        JobCard.vehicle_id == jc.vehicle_id,
        JobCard.id != jc.id
    ).order_by(JobCard.date.desc(), JobCard.created_at.desc()).first()

    last_service_summary = None
    if prev_job:
        p_work = [l.description for l in prev_job.labour_items if l.status in ("APPROVED", "DONE")]
        p_parts = [p.description for p in prev_job.parts_items if p.status in ("APPROVED", "USED")]
        last_service_summary = {
            "job_card_id": prev_job.id,
            "job_card_number": prev_job.job_card_number,
            "date": prev_job.date.strftime("%d/%m/%Y"),
            "odometer": prev_job.odometer,
            "work_done": ", ".join(p_work + p_parts) or "General Inspection",
            "total_amount": prev_job.invoice.grand_total if prev_job.invoice else 0
        }

    # Estimate vs Approved Summary
    parts_rec = sum(p.total for p in jc.parts_items if p.status == "RECOMMENDED")
    parts_appr = sum(p.total for p in jc.parts_items if p.status in ("APPROVED", "USED"))
    labour_rec = sum(l.total for l in jc.labour_items if l.status == "RECOMMENDED")
    labour_appr = sum(l.total for l in jc.labour_items if l.status in ("APPROVED", "DONE"))
    other_tot = jc.invoice.other_charges_total if jc.invoice else 0
    disc = jc.invoice.discount if jc.invoice else 0

    estimate_summary = {
        "recommended_parts_total": parts_rec,
        "approved_parts_total": parts_appr,
        "estimated_parts_total": parts_rec + parts_appr,
        "recommended_labour_total": labour_rec,
        "approved_labour_total": labour_appr,
        "estimated_labour_total": labour_rec + labour_appr,
        "other_charges_total": other_tot,
        "discount": disc,
        "estimated_grand_total": max(0, (parts_rec + parts_appr + labour_rec + labour_appr + other_tot) - disc),
        "approved_grand_total": max(0, (parts_appr + labour_appr + other_tot) - disc)
    }

    return {
        "id": jc.id,
        "job_card_number": jc.job_card_number,
        "date": jc.date.strftime("%d/%m/%Y"),
        "time_in": jc.time_in.strftime("%I:%M %p") if jc.time_in else "",
        "time_out": jc.time_out.strftime("%I:%M %p") if jc.time_out else None,
        "status": jc.status,
        "odometer": jc.odometer,
        "fuel_level": jc.fuel_level,
        "notes": jc.notes,
        "promised_at": jc.promised_at.strftime("%d/%m/%Y %I:%M %p") if jc.promised_at else None,
        "assigned_to": jc.assigned_to,
        "assigned_to_name": jc.assigned_user.full_name if jc.assigned_user else None,
        "cancelled_reason": jc.cancelled_reason,
        "customer": {
            "id": jc.customer.id,
            "name": jc.customer.name,
            "phone": jc.customer.phone,
            "alt_phone": jc.customer.alt_phone,
            "email": jc.customer.email,
            "address": jc.customer.address
        },
        "vehicle": {
            "id": jc.vehicle.id,
            "registration_number": jc.vehicle.registration_number,
            "make": jc.vehicle.make,
            "model": jc.vehicle.model,
            "variant": jc.vehicle.variant,
            "fuel_type": jc.vehicle.fuel_type,
            "year": jc.vehicle.year,
            "colour": jc.vehicle.colour,
            "vin": jc.vehicle.vin,
            "engine_number": jc.vehicle.engine_number
        },
        "last_service": last_service_summary,
        "complaints": [
            {"id": c.id, "sequence": c.sequence, "description": c.description}
            for c in jc.complaints
        ],
        "inspections": [
            {"id": i.id, "category": i.category, "status": i.status, "notes": i.notes}
            for i in jc.inspections
        ],
        "labour_items": [
            {
                "id": l.id,
                "description": l.description,
                "quantity": l.quantity,
                "unit_price": l.unit_price,
                "total": l.total,
                "status": l.status,
                "catalog_id": l.catalog_id
            } for l in jc.labour_items
        ],
        "parts_items": [
            {
                "id": p.id,
                "description": p.description,
                "part_number": p.part_number,
                "unit": p.unit,
                "quantity": p.quantity,
                "unit_price": p.unit_price,
                "total": p.total,
                "status": p.status,
                "catalog_id": p.catalog_id
            } for p in jc.parts_items
        ],
        "approvals": [
            {
                "id": a.id,
                "approved_by_name": a.approved_by_name,
                "method": a.method,
                "recorded_at": a.recorded_at.strftime("%d/%m/%Y %I:%M %p"),
                "recorded_by_name": a.recorder.full_name if a.recorder else "",
                "note": a.note
            } for a in jc.approvals
        ],
        "invoice": {
            "id": jc.invoice.id,
            "invoice_number": jc.invoice.invoice_number,
            "status": jc.invoice.status,
            "parts_total": jc.invoice.parts_total,
            "labour_total": jc.invoice.labour_total,
            "other_charges_total": jc.invoice.other_charges_total,
            "discount": jc.invoice.discount,
            "tax_total": jc.invoice.tax_total,
            "round_off": jc.invoice.round_off,
            "grand_total": jc.invoice.grand_total,
            "payment_status": jc.invoice.payment_status,
            "payments": [
                {
                    "id": pay.id,
                    "amount": pay.amount,
                    "method": pay.method,
                    "reference": pay.reference,
                    "paid_at": pay.paid_at.strftime("%d/%m/%Y %I:%M %p"),
                    "is_reversal": pay.is_reversal
                } for pay in jc.invoice.payments
            ]
        } if jc.invoice else None,
        "status_history": [
            {
                "from_status": h.from_status,
                "to_status": h.to_status,
                "changed_by": h.user.full_name if h.user else "System",
                "changed_at": h.changed_at.strftime("%d/%m/%Y %I:%M %p"),
                "note": h.note
            } for h in jc.status_history
        ],
        "estimate_summary": estimate_summary
    }

@router.post("/{job_card_id}/status")
def update_job_card_status(
    job_card_id: int,
    req: JobCardStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")

    old_status = jc.status
    new_status = req.status.strip().upper()

    if new_status not in VALID_JOB_CARD_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid job card status '{new_status}'. Allowed statuses: {', '.join(sorted(VALID_JOB_CARD_STATUSES))}"
        )

    # Rule: Completed cannot be edited by Service Staff
    if old_status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only Admin can reopen a COMPLETED job card")

    # Rule: Completed requires finalised invoice
    if new_status == "COMPLETED":
        if not jc.invoice or jc.invoice.status != "FINALIZED":
            raise HTTPException(status_code=400, detail="Cannot complete job card without a finalised invoice")
        jc.time_out = datetime.utcnow()

    # Rule: Cancelled requires reason and no active finalised invoice
    if new_status == "CANCELLED":
        if not req.cancelled_reason:
            raise HTTPException(status_code=400, detail="Cancellation reason is mandatory")
        if jc.invoice and jc.invoice.status == "FINALIZED":
            raise HTTPException(status_code=400, detail="Cannot cancel job card with a finalised invoice. The invoice must be voided first.")
        jc.cancelled_reason = req.cancelled_reason

    jc.status = new_status
    hist = JobCardStatusHistory(
        job_card_id=jc.id,
        from_status=old_status,
        to_status=new_status,
        changed_by=current_user.id,
        note=req.note or req.cancelled_reason
    )
    db.add(hist)
    record_audit(db, current_user.id, "JOB_CARD_STATUS", "job_card", str(jc.id), {"status": old_status}, {"status": new_status})
    db.commit()
    return {"message": f"Status updated to {new_status}"}

# --- Complaints endpoints ---
@router.post("/{job_card_id}/complaints")
def add_complaint(
    job_card_id: int,
    req: ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    seq = len(jc.complaints) + 1
    c = Complaint(job_card_id=jc.id, sequence=seq, description=req.description.strip())
    db.add(c)
    db.commit()
    return {"id": c.id, "sequence": c.sequence, "description": c.description}

@router.delete("/{job_card_id}/complaints/{cid}")
def remove_complaint(
    job_card_id: int,
    cid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    c = db.query(Complaint).filter(Complaint.id == cid, Complaint.job_card_id == job_card_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Complaint not found")
    db.delete(c)
    db.commit()
    return {"message": "Complaint removed"}

# --- Inspections endpoint ---
@router.put("/{job_card_id}/inspections")
def update_inspections(
    job_card_id: int,
    items: List[InspectionItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")

    for item in items:
        insp = db.query(Inspection).filter(
            Inspection.job_card_id == jc.id,
            Inspection.category == item.category
        ).first()
        if insp:
            insp.status = item.status
            insp.notes = item.notes
        else:
            db.add(Inspection(
                job_card_id=jc.id,
                category=item.category,
                status=item.status,
                notes=item.notes
            ))
    db.commit()
    return {"message": "Inspections updated"}

# --- Labour & Parts items ---
@router.post("/{job_card_id}/labour-items")
def add_labour_item(
    job_card_id: int,
    req: LabourItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify line items on a job card with a finalised invoice.")
    if jc.status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot modify lines on completed job card")

    line_tot = calculate_line_total(req.quantity, req.unit_price)
    item = LabourItem(
        job_card_id=jc.id,
        description=req.description.strip(),
        quantity=req.quantity,
        unit_price=req.unit_price,
        total=line_tot,
        status=req.status,
        catalog_id=req.catalog_id
    )
    db.add(item)
    db.flush()
    recalculate_job_card_invoice(db, jc)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{job_card_id}/labour-items/{lid}")
def delete_labour_item(
    job_card_id: int,
    lid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(LabourItem).filter(LabourItem.id == lid, LabourItem.job_card_id == job_card_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Labour line not found")
    jc = item.job_card
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify line items on a job card with a finalised invoice.")
    if jc.status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot modify lines on completed job card")
    db.delete(item)
    db.flush()
    recalculate_job_card_invoice(db, jc)
    db.commit()
    return {"message": "Labour line removed"}

@router.patch("/{job_card_id}/labour-items/{lid}")
def update_labour_item(
    job_card_id: int,
    lid: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify line items on a job card with a finalised invoice.")
    if jc.status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot modify lines on completed job card")

    item = db.query(LabourItem).filter(LabourItem.id == lid, LabourItem.job_card_id == job_card_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Labour line not found")

    if "status" in data:
        new_status = data["status"].upper()
        if new_status not in ("RECOMMENDED", "APPROVED", "REJECTED", "DONE"):
            raise HTTPException(status_code=400, detail="Invalid status for labour item")
        item.status = new_status
    if "quantity" in data:
        item.quantity = float(data["quantity"])
    if "unit_price" in data:
        item.unit_price = int(data["unit_price"])
    if "description" in data and data["description"].strip():
        item.description = data["description"].strip()

    item.total = calculate_line_total(item.quantity, item.unit_price)
    db.flush()
    recalculate_job_card_invoice(db, jc)
    db.commit()
    db.refresh(item)
    return item

@router.post("/{job_card_id}/parts-items")
def add_part_item(
    job_card_id: int,
    req: PartItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify line items on a job card with a finalised invoice.")
    if jc.status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot modify lines on completed job card")

    line_tot = calculate_line_total(req.quantity, req.unit_price)
    item = PartItem(
        job_card_id=jc.id,
        description=req.description.strip(),
        part_number=req.part_number.strip() if req.part_number else None,
        unit=req.unit,
        quantity=req.quantity,
        unit_price=req.unit_price,
        total=line_tot,
        status=req.status,
        catalog_id=req.catalog_id
    )
    db.add(item)
    db.flush()
    recalculate_job_card_invoice(db, jc)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{job_card_id}/parts-items/{pid}")
def delete_part_item(
    job_card_id: int,
    pid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(PartItem).filter(PartItem.id == pid, PartItem.job_card_id == job_card_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Part line not found")
    jc = item.job_card
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify line items on a job card with a finalised invoice.")
    if jc.status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot modify lines on completed job card")
    db.delete(item)
    db.flush()
    recalculate_job_card_invoice(db, jc)
    db.commit()
    return {"message": "Part line removed"}

@router.patch("/{job_card_id}/parts-items/{pid}")
def update_part_item(
    job_card_id: int,
    pid: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify line items on a job card with a finalised invoice.")
    if jc.status == "COMPLETED" and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot modify lines on completed job card")

    item = db.query(PartItem).filter(PartItem.id == pid, PartItem.job_card_id == job_card_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Part line not found")

    if "status" in data:
        new_status = data["status"].upper()
        if new_status not in ("RECOMMENDED", "APPROVED", "REJECTED", "USED"):
            raise HTTPException(status_code=400, detail="Invalid status for part item")
        item.status = new_status
    if "quantity" in data:
        item.quantity = float(data["quantity"])
    if "unit_price" in data:
        item.unit_price = int(data["unit_price"])
    if "description" in data and data["description"].strip():
        item.description = data["description"].strip()
    if "unit" in data:
        item.unit = data["unit"].strip()
    if "part_number" in data:
        item.part_number = data["part_number"].strip() or None

    item.total = calculate_line_total(item.quantity, item.unit_price)
    db.flush()
    recalculate_job_card_invoice(db, jc)
    db.commit()
    db.refresh(item)
    return item

# --- Approval Workflow ---
@router.post("/{job_card_id}/approvals")
def record_customer_approvals(
    job_card_id: int,
    req: ApprovalRecordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Records customer approval / rejection metadata and updates line item statuses.
    Automatic recalculation guarantees unapproved/rejected items are excluded from billing.
    """
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    if jc.invoice and jc.invoice.status == "FINALIZED":
        raise HTTPException(status_code=400, detail="Cannot modify customer approvals on a job card with a finalised invoice.")

    # Record approval metadata
    appr = Approval(
        job_card_id=jc.id,
        approved_by_name=req.approved_by_name.strip(),
        method=req.method,
        recorded_by=current_user.id,
        recorded_at=datetime.utcnow(),
        note=req.note
    )
    db.add(appr)

    # Update item statuses
    for dec in req.line_approvals:
        item_type = dec.get("type")
        item_id = dec.get("id")
        item_status = dec.get("status") # APPROVED or REJECTED

        if item_type == "labour":
            l = db.query(LabourItem).filter(LabourItem.id == item_id, LabourItem.job_card_id == jc.id).first()
            if l:
                l.status = item_status
        elif item_type == "part":
            p = db.query(PartItem).filter(PartItem.id == item_id, PartItem.job_card_id == jc.id).first()
            if p:
                p.status = item_status

    db.flush()
    # Transition status to APPROVED if all decided
    if jc.status == "WAITING_FOR_APPROVAL":
        jc.status = "APPROVED"

    recalculate_job_card_invoice(db, jc)
    record_audit(db, current_user.id, "CUSTOMER_APPROVAL", "job_card", str(jc.id), None, {"approver": req.approved_by_name})
    db.commit()

    return {"message": "Approvals recorded and invoice recalculated successfully"}

# --- PDF export ---
@router.get("/{job_card_id}/pdf")
def get_job_card_pdf_endpoint(
    job_card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    jc = db.query(JobCard).filter(JobCard.id == job_card_id).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")

    setting = db.query(Setting).filter(Setting.key == "business_profile").first()
    profile = json.loads(setting.value_json) if setting else {}

    pdf_bytes = generate_job_card_pdf(jc, profile)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={jc.job_card_number}.pdf"}
    )
