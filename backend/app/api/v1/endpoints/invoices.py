import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.core.audit import record_audit
from app.models import (
    Invoice, InvoiceOtherCharge, Payment, JobCard, User, Setting
)
from app.schemas import (
    InvoiceSummaryResponse, OtherChargeCreate, PaymentCreate, PaymentResponse,
    VoidInvoiceRequest
)
from app.services.numbering_service import generate_invoice_number
from app.services.calculation_service import (
    calculate_invoice_totals, LineItemCalc, OtherChargeCalc, PaymentCalc
)
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter()

def sync_invoice_calculations(db: Session, invoice: Invoice):
    """Authoritative recalculation for the given invoice."""
    jc = invoice.job_card

    # Check if interstate: compare customer GSTIN state code with workshop GSTIN
    is_interstate = False
    customer = jc.customer if jc else None
    if customer and getattr(customer, "gstin", None) and len(customer.gstin) >= 2:
        setting = db.query(Setting).filter(Setting.key == "business_profile").first()
        profile = json.loads(setting.value_json) if setting else {}
        w_gstin = profile.get("gstin", "")
        if w_gstin and len(w_gstin) >= 2:
            is_interstate = (customer.gstin[:2] != w_gstin[:2])

    parts_calc = [
        LineItemCalc(
            quantity=p.quantity,
            unit_price=p.unit_price,
            cost_price=getattr(p, "cost_price", 0),
            gst_rate=getattr(p, "gst_rate", 18),
            hsn_or_sac=getattr(p, "hsn_code", "8708"),
            status=p.status
        )
        for p in jc.parts_items
    ] if jc else []

    labour_calc = [
        LineItemCalc(
            quantity=l.quantity,
            unit_price=l.unit_price,
            cost_price=getattr(l, "cost_price", 0),
            gst_rate=getattr(l, "gst_rate", 18),
            hsn_or_sac=getattr(l, "sac_code", "998729"),
            status=l.status
        )
        for l in jc.labour_items
    ] if jc else []

    other_calc = [
        OtherChargeCalc(amount=o.amount)
        for o in invoice.other_charges
    ]
    all_payments = db.query(Payment).filter(Payment.invoice_id == invoice.id).all()
    payments_calc = [
        PaymentCalc(amount=p.amount, is_reversal=p.is_reversal)
        for p in all_payments
    ]

    res = calculate_invoice_totals(
        parts=parts_calc,
        labour=labour_calc,
        other_charges=other_calc,
        discount_paise=invoice.discount,
        tax_paise=invoice.tax_total,
        round_off_paise=invoice.round_off,
        payments=payments_calc,
        is_draft=(invoice.status == "DRAFT"),
        is_interstate=is_interstate
    )

    invoice.parts_total = res.parts_total
    invoice.labour_total = res.labour_total
    invoice.other_charges_total = res.other_charges_total
    invoice.discount = res.discount
    invoice.tax_total = res.tax_total
    invoice.taxable_amount = res.taxable_amount
    invoice.cgst_amount = res.cgst_amount
    invoice.sgst_amount = res.sgst_amount
    invoice.igst_amount = res.igst_amount
    invoice.total_cost = res.total_cost
    invoice.gross_profit = res.gross_profit
    invoice.round_off = res.round_off
    invoice.grand_total = res.grand_total
    invoice.payment_status = res.payment_status
    db.flush()
    return res

@router.get("")
def list_invoices(
    status_filter: Optional[str] = None,
    payment_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice)
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    if payment_status:
        query = query.filter(Invoice.status == "FINALIZED", Invoice.payment_status == payment_status)

    invoices = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    results = []
    for inv in invoices:
        jc = inv.job_card
        paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in inv.payments))
        balance = max(0, inv.grand_total - paid) if inv.status == "FINALIZED" else 0
        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "job_card_id": jc.id if jc else None,
            "job_card_number": jc.job_card_number if jc else "",
            "customer_id": jc.customer.id if (jc and jc.customer) else None,
            "customer_name": jc.customer.name if (jc and jc.customer) else "",
            "customer_phone": jc.customer.phone if (jc and jc.customer) else "",
            "vehicle_id": jc.vehicle.id if (jc and jc.vehicle) else None,
            "vehicle_reg": jc.vehicle.registration_number if (jc and jc.vehicle) else "",
            "status": inv.status,
            "grand_total": inv.grand_total,
            "amount_paid": paid,
            "balance_due": balance,
            "payment_status": inv.payment_status if inv.status == "FINALIZED" else "DRAFT",
            "finalized_at": inv.finalized_at.strftime("%d/%m/%Y") if inv.finalized_at else None
        })
    return results

@router.get("/{invoice_id}")
def get_invoice_detail(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if inv.status == "DRAFT":
        sync_invoice_calculations(db, inv)
        db.commit()

    jc = inv.job_card
    all_payments = db.query(Payment).filter(Payment.invoice_id == inv.id).all()
    paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in all_payments))
    balance = max(0, inv.grand_total - paid)

    # Approved lines
    approved_parts = [
        {
            "id": p.id, "description": p.description, "part_number": p.part_number,
            "quantity": p.quantity, "unit": p.unit, "unit_price": p.unit_price,
            "cost_price": p.cost_price, "hsn_code": p.hsn_code, "gst_rate": p.gst_rate,
            "total": p.total, "status": p.status
        }
        for p in jc.parts_items if p.status in ("APPROVED", "USED")
    ] if jc else []

    recommended_parts = [
        {
            "id": p.id, "description": p.description, "part_number": p.part_number,
            "quantity": p.quantity, "unit": p.unit, "unit_price": p.unit_price,
            "cost_price": p.cost_price, "hsn_code": p.hsn_code, "gst_rate": p.gst_rate,
            "total": p.total, "status": p.status
        }
        for p in jc.parts_items if p.status == "RECOMMENDED"
    ] if jc else []

    rejected_parts = [
        {
            "id": p.id, "description": p.description, "part_number": p.part_number,
            "quantity": p.quantity, "unit": p.unit, "unit_price": p.unit_price,
            "cost_price": p.cost_price, "hsn_code": p.hsn_code, "gst_rate": p.gst_rate,
            "total": p.total, "status": p.status
        }
        for p in jc.parts_items if p.status == "REJECTED"
    ] if jc else []
    
    # Excluded (rejected or pending) lines for backwards compatibility
    excluded_parts = [
        {"id": p.id, "description": p.description, "quantity": p.quantity, "unit_price": p.unit_price, "status": p.status}
        for p in jc.parts_items if p.status not in ("APPROVED", "USED")
    ] if jc else []

    approved_labour = [
        {
            "id": l.id, "description": l.description, "quantity": l.quantity,
            "unit_price": l.unit_price, "cost_price": l.cost_price,
            "sac_code": l.sac_code, "gst_rate": l.gst_rate,
            "total": l.total, "status": l.status
        }
        for l in jc.labour_items if l.status in ("APPROVED", "DONE")
    ] if jc else []

    recommended_labour = [
        {
            "id": l.id, "description": l.description, "quantity": l.quantity,
            "unit_price": l.unit_price, "cost_price": l.cost_price,
            "sac_code": l.sac_code, "gst_rate": l.gst_rate,
            "total": l.total, "status": l.status
        }
        for l in jc.labour_items if l.status == "RECOMMENDED"
    ] if jc else []

    rejected_labour = [
        {
            "id": l.id, "description": l.description, "quantity": l.quantity,
            "unit_price": l.unit_price, "cost_price": l.cost_price,
            "sac_code": l.sac_code, "gst_rate": l.gst_rate,
            "total": l.total, "status": l.status
        }
        for l in jc.labour_items if l.status == "REJECTED"
    ] if jc else []

    excluded_labour = [
        {"id": l.id, "description": l.description, "quantity": l.quantity, "unit_price": l.unit_price, "status": l.status}
        for l in jc.labour_items if l.status not in ("APPROVED", "DONE")
    ] if jc else []

    # Estimate calculations for transparency
    est_parts_tot = sum(p["total"] for p in approved_parts) + sum(p["total"] for p in recommended_parts)
    est_labour_tot = sum(l["total"] for l in approved_labour) + sum(l["total"] for l in recommended_labour)
    est_grand = max(0, est_parts_tot + est_labour_tot + inv.other_charges_total - inv.discount)

    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "status": inv.status,
        "job_card_id": jc.id if jc else None,
        "job_card_number": jc.job_card_number if jc else "",
        "customer": {
            "id": jc.customer.id,
            "name": jc.customer.name,
            "phone": jc.customer.phone,
            "gstin": getattr(jc.customer, "gstin", "")
        } if (jc and jc.customer) else None,
        "vehicle": {
            "id": jc.vehicle.id,
            "registration_number": jc.vehicle.registration_number,
            "make": jc.vehicle.make,
            "model": jc.vehicle.model,
            "odometer": jc.odometer
        } if (jc and jc.vehicle) else None,
        "parts_total": inv.parts_total,
        "labour_total": inv.labour_total,
        "other_charges_total": inv.other_charges_total,
        "discount": inv.discount,
        "discount_reason": inv.discount_reason,
        "tax_total": inv.tax_total,
        "taxable_amount": getattr(inv, "taxable_amount", 0),
        "cgst_amount": getattr(inv, "cgst_amount", 0),
        "sgst_amount": getattr(inv, "sgst_amount", 0),
        "igst_amount": getattr(inv, "igst_amount", 0),
        "total_cost": getattr(inv, "total_cost", 0),
        "gross_profit": getattr(inv, "gross_profit", 0),
        "profit_margin_percent": round((inv.gross_profit / inv.taxable_amount * 100), 2) if (getattr(inv, "taxable_amount", 0) > 0 and getattr(inv, "gross_profit", 0) != 0) else 0.0,
        "round_off": inv.round_off,
        "grand_total": inv.grand_total,
        "amount_paid": paid,
        "balance_due": balance,
        "payment_status": inv.payment_status,
        "finalized_at": inv.finalized_at.strftime("%d/%m/%Y %I:%M %p") if inv.finalized_at else None,
        "voided_at": inv.voided_at.strftime("%d/%m/%Y %I:%M %p") if inv.voided_at else None,
        "void_reason": inv.void_reason,
        "approved_parts": approved_parts,
        "recommended_parts": recommended_parts,
        "rejected_parts": rejected_parts,
        "excluded_parts": excluded_parts,
        "approved_labour": approved_labour,
        "recommended_labour": recommended_labour,
        "rejected_labour": rejected_labour,
        "excluded_labour": excluded_labour,
        "estimated_parts_total": est_parts_tot,
        "estimated_labour_total": est_labour_tot,
        "estimated_grand_total": est_grand,
        "other_charges": [
            {"id": o.id, "description": o.description, "amount": o.amount}
            for o in inv.other_charges
        ],
        "payments": [
            {
                "id": p.id,
                "amount": p.amount,
                "method": p.method,
                "reference": p.reference,
                "paid_at": p.paid_at.strftime("%d/%m/%Y %I:%M %p"),
                "is_reversal": p.is_reversal,
                "note": p.note
            } for p in inv.payments
        ]
    }

@router.post("/{invoice_id}/other-charges")
def add_other_charge(
    invoice_id: int,
    req: OtherChargeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Cannot modify a finalised or voided invoice")

    charge = InvoiceOtherCharge(invoice_id=inv.id, description=req.description.strip(), amount=req.amount)
    db.add(charge)
    db.flush()
    sync_invoice_calculations(db, inv)
    db.commit()
    return {"id": charge.id, "description": charge.description, "amount": charge.amount}

@router.delete("/{invoice_id}/other-charges/{charge_id}")
def delete_other_charge(
    invoice_id: int,
    charge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    charge = db.query(InvoiceOtherCharge).filter(
        InvoiceOtherCharge.id == charge_id,
        InvoiceOtherCharge.invoice_id == invoice_id
    ).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")
    inv = charge.invoice
    if inv.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Cannot modify a finalised invoice")

    db.delete(charge)
    db.flush()
    sync_invoice_calculations(db, inv)
    db.commit()
    return {"message": "Charge removed"}

@router.post("/{invoice_id}/discount")
def apply_discount(
    invoice_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Cannot modify a finalised invoice")

    discount_amount = data.get("discount", 0) # in paise
    discount_reason = data.get("reason", "")

    # Configurable Service Staff discount threshold
    discount_setting = db.query(Setting).filter(Setting.key == "discount_limit").first()
    staff_limit_paise = int(discount_setting.value_json) if discount_setting else 100000 # default ₹1,000

    if current_user.role != "ADMIN" and discount_amount > staff_limit_paise:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Discounts above ₹{staff_limit_paise/100:.2f} require Admin authorization"
        )

    inv.discount = discount_amount
    inv.discount_reason = discount_reason
    sync_invoice_calculations(db, inv)
    record_audit(db, current_user.id, "INVOICE_DISCOUNT", "invoice", str(inv.id), None, {"discount": discount_amount, "reason": discount_reason})
    db.commit()
    return {"message": "Discount updated", "discount": inv.discount, "grand_total": inv.grand_total}

@router.post("/{invoice_id}/finalize")
def finalize_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT invoices can be finalised")

    # Retry loop handles the rare case where two concurrent finalize
    # requests generate the same sequence number before either commits.
    max_retries = 3
    for attempt in range(max_retries):
        try:
            inv_number = generate_invoice_number(db)
            inv.invoice_number = inv_number
            inv.status = "FINALIZED"
            inv.finalized_at = datetime.utcnow()
            inv.finalized_by = current_user.id

            # Authoritative recalculation under FINALIZED status (strictly approved lines only)
            sync_invoice_calculations(db, inv)

            record_audit(db, current_user.id, "INVOICE_FINALIZE", "invoice", str(inv.id), None, {"number": inv_number, "grand_total": inv.grand_total})
            db.commit()
            db.refresh(inv)
            break
        except IntegrityError:
            db.rollback()
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to generate unique invoice number after multiple attempts. Please try again."
                )
            # Retry with a fresh sequence number
            continue

    # Auto-generate and save PDF to documents/invoices/YYYY/
    setting = db.query(Setting).filter(Setting.key == "business_profile").first()
    profile = json.loads(setting.value_json) if setting else {}
    generate_invoice_pdf(inv, profile, save_to_disk=True)

    return {"message": "Invoice finalised successfully", "invoice_number": inv_number}

@router.post("/{invoice_id}/void")
def void_invoice(
    invoice_id: int,
    req: VoidInvoiceRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status != "FINALIZED":
        raise HTTPException(status_code=400, detail="Only FINALIZED invoices can be voided")

    inv.status = "VOID"
    inv.voided_at = datetime.utcnow()
    inv.voided_by = admin.id
    inv.void_reason = req.reason.strip()

    record_audit(db, admin.id, "INVOICE_VOID", "invoice", str(inv.id), None, {"reason": req.reason})
    db.commit()
    return {"message": "Invoice marked as VOID"}

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf_endpoint(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    setting = db.query(Setting).filter(Setting.key == "business_profile").first()
    profile = json.loads(setting.value_json) if setting else {}

    pdf_bytes = generate_invoice_pdf(inv, profile, save_to_disk=False)
    filename = f"{inv.invoice_number or 'draft_invoice'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

# --- Payment Endpoints ---
@router.post("/{invoice_id}/payments", response_model=PaymentResponse)
def record_payment(
    invoice_id: int,
    req: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "DRAFT":
        raise HTTPException(
            status_code=400,
            detail="Payments can only be recorded on FINALIZED invoices. Please finalise the invoice before recording payments."
        )
    if inv.status == "VOID":
        raise HTTPException(status_code=400, detail="Cannot record payment against a VOID invoice")

    # Current outstanding
    existing_paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in inv.payments))
    balance = max(0, inv.grand_total - existing_paid)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")
    if req.amount > balance:
        raise HTTPException(status_code=400, detail=f"Payment amount (₹{req.amount/100:.2f}) exceeds outstanding balance (₹{balance/100:.2f})")

    payment = Payment(
        invoice_id=inv.id,
        amount=req.amount,
        method=req.method.upper(),
        reference=req.reference.strip() if req.reference else None,
        paid_at=datetime.utcnow(),
        received_by=current_user.id,
        note=req.note.strip() if req.note else None
    )
    db.add(payment)
    db.flush()

    sync_invoice_calculations(db, inv)

    record_audit(db, current_user.id, "PAYMENT_RECORD", "payment", str(payment.id), None, {"amount": payment.amount, "method": payment.method})
    db.commit()
    db.refresh(payment)
    return payment

@router.post("/{invoice_id}/payments/{payment_id}/reverse", response_model=PaymentResponse)
def reverse_payment(
    invoice_id: int,
    payment_id: int,
    data: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "VOID":
        raise HTTPException(status_code=400, detail="Cannot reverse payment on a VOID invoice")

    orig_payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.invoice_id == inv.id
    ).first()
    if not orig_payment:
        raise HTTPException(status_code=404, detail="Payment record not found on this invoice")

    if orig_payment.is_reversal:
        raise HTTPException(status_code=400, detail="Cannot reverse an existing reversal entry")

    # Check if already reversed
    already_reversed = db.query(Payment).filter(
        Payment.invoice_id == inv.id,
        Payment.is_reversal == True,
        Payment.reference == f"REV-{orig_payment.id}"
    ).first()
    if already_reversed:
        raise HTTPException(status_code=400, detail="This payment has already been reversed")

    reason = (data or {}).get("reason", "Receipt correction").strip() if data else "Receipt correction"

    reversal = Payment(
        invoice_id=inv.id,
        amount=orig_payment.amount,
        method=orig_payment.method,
        reference=f"REV-{orig_payment.id}",
        is_reversal=True,
        paid_at=datetime.utcnow(),
        received_by=current_user.id,
        note=f"Reversal of payment #{orig_payment.id}: {reason}"
    )
    db.add(reversal)
    db.flush()

    sync_invoice_calculations(db, inv)

    record_audit(
        db, current_user.id, "PAYMENT_REVERSAL", "payment", str(reversal.id),
        {"reversed_payment_id": orig_payment.id, "amount": orig_payment.amount},
        {"reversal_id": reversal.id, "reason": reason}
    )
    db.commit()
    db.refresh(reversal)
    return reversal
