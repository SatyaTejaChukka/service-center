from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import JobCard, Invoice, Payment, User

router = APIRouter()

@router.get("/daily-summary")
def get_daily_summary(
    report_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    target_date = report_date or datetime.utcnow().date()
    start_dt = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0)
    end_dt = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59)

    jobs_opened = db.query(JobCard).filter(JobCard.date == target_date).count()
    jobs_completed = db.query(JobCard).filter(
        JobCard.status == "COMPLETED",
        JobCard.time_out >= start_dt,
        JobCard.time_out <= end_dt
    ).count()

    invoices_finalized = db.query(Invoice).filter(
        Invoice.status == "FINALIZED",
        Invoice.finalized_at >= start_dt,
        Invoice.finalized_at <= end_dt
    ).all()
    
    invoiced_value = sum(i.grand_total for i in invoices_finalized)

    # Payments by method
    payments = db.query(Payment).filter(
        Payment.paid_at >= start_dt,
        Payment.paid_at <= end_dt
    ).all()

    by_method = {}
    total_received = 0
    for p in payments:
        amount = -p.amount if p.is_reversal else p.amount
        by_method[p.method] = by_method.get(p.method, 0) + amount
        total_received += amount

    return {
        "date": target_date.strftime("%d/%m/%Y"),
        "jobs_opened": jobs_opened,
        "jobs_completed": jobs_completed,
        "invoices_issued_count": len(invoices_finalized),
        "invoiced_value_paise": invoiced_value,
        "payments_total_paise": max(0, total_received),
        "payments_by_method": by_method
    }

@router.get("/outstanding-receivables")
def get_outstanding_receivables(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invoices = db.query(Invoice).filter(
        Invoice.status == "FINALIZED",
        Invoice.payment_status.in_(["UNPAID", "PARTIALLY_PAID"])
    ).all()

    results = []
    total_outstanding = 0
    for inv in invoices:
        paid = sum(p.amount for p in inv.payments if not p.is_reversal)
        balance = max(0, inv.grand_total - paid)
        if balance > 0:
            total_outstanding += balance
            results.append({
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_name": inv.job_card.customer.name if (inv.job_card and inv.job_card.customer) else "",
                "customer_phone": inv.job_card.customer.phone if (inv.job_card and inv.job_card.customer) else "",
                "vehicle_reg": inv.job_card.vehicle.registration_number if (inv.job_card and inv.job_card.vehicle) else "",
                "finalized_at": inv.finalized_at.strftime("%d/%m/%Y") if inv.finalized_at else "",
                "grand_total": inv.grand_total,
                "amount_paid": paid,
                "balance_due": balance,
                "days_overdue": (datetime.utcnow() - (inv.finalized_at or datetime.utcnow())).days
            })

    return {
        "total_outstanding_paise": total_outstanding,
        "invoices": sorted(results, key=lambda x: x["days_overdue"], reverse=True)
    }
