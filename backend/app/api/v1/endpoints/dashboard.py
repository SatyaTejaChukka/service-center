from datetime import datetime, date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import JobCard, Payment, User

router = APIRouter()

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = datetime.utcnow().date()
    start_of_day = datetime(today.year, today.month, today.day, 0, 0, 0)

    # 1. Today's Jobs
    todays_jobs_count = db.query(JobCard).filter(JobCard.date == today).count()

    # 2. In Service (INSPECTION, WAITING_FOR_APPROVAL, APPROVED, IN_PROGRESS)
    in_service_count = db.query(JobCard).filter(
        JobCard.status.in_(["INSPECTION", "WAITING_FOR_APPROVAL", "APPROVED", "IN_PROGRESS"])
    ).count()

    # 3. Ready for Delivery
    ready_count = db.query(JobCard).filter(JobCard.status == "READY_FOR_DELIVERY").count()

    # 4. Today's Revenue (cash-basis: payments received today net of reversals)
    today_payments = db.query(Payment).filter(Payment.paid_at >= start_of_day).all()
    todays_revenue_paise = sum(p.amount for p in today_payments if not p.is_reversal) - sum(p.amount for p in today_payments if p.is_reversal)
    todays_revenue_paise = max(0, todays_revenue_paise)

    # 5. Recent Job Cards (up to 8)
    recent_jobs = db.query(JobCard).order_by(JobCard.created_at.desc()).limit(8).all()
    recent_jobs_list = [
        {
            "id": j.id,
            "job_card_number": j.job_card_number,
            "vehicle_reg": j.vehicle.registration_number if j.vehicle else "",
            "vehicle_model": f"{j.vehicle.make} {j.vehicle.model}" if j.vehicle else "",
            "status": j.status,
            "odometer": j.odometer,
            "date": j.date.strftime("%d/%m/%Y")
        } for j in recent_jobs
    ]

    # 6. Action Widgets
    pending_approvals = db.query(JobCard).filter(JobCard.status == "WAITING_FOR_APPROVAL").limit(5).all()
    ready_delivery = db.query(JobCard).filter(JobCard.status == "READY_FOR_DELIVERY").limit(5).all()
    recent_pays = db.query(Payment).order_by(Payment.paid_at.desc()).limit(5).all()

    return {
        "tiles": {
            "todays_jobs": todays_jobs_count,
            "in_service": in_service_count,
            "ready_for_delivery": ready_count,
            "todays_revenue_paise": todays_revenue_paise
        },
        "recent_job_cards": recent_jobs_list,
        "widgets": {
            "pending_approvals": [
                {
                    "id": j.id,
                    "job_card_number": j.job_card_number,
                    "vehicle": f"{j.vehicle.make} {j.vehicle.model}" if j.vehicle else "",
                    "reg": j.vehicle.registration_number if j.vehicle else ""
                } for j in pending_approvals
            ],
            "ready_for_delivery": [
                {
                    "id": j.id,
                    "job_card_number": j.job_card_number,
                    "vehicle": f"{j.vehicle.make} {j.vehicle.model}" if j.vehicle else "",
                    "reg": j.vehicle.registration_number if j.vehicle else ""
                } for j in ready_delivery
            ],
            "recent_payments": [
                {
                    "id": p.id,
                    "amount": p.amount,
                    "method": p.method,
                    "invoice_id": p.invoice_id,
                    "invoice_number": p.invoice.invoice_number if p.invoice else "",
                    "paid_at": p.paid_at.strftime("%I:%M %p")
                } for p in recent_pays
            ]
        }
    }
