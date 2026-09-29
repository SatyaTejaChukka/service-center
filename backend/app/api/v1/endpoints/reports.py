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

    clean_by_method = {k: v for k, v in by_method.items() if v > 0}

    return {
        "date": target_date.strftime("%d/%m/%Y"),
        "jobs_opened": jobs_opened,
        "jobs_completed": jobs_completed,
        "invoices_issued_count": len(invoices_finalized),
        "invoiced_value_paise": invoiced_value,
        "payments_total_paise": max(0, total_received),
        "payments_by_method": clean_by_method
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
        paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in inv.payments))
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

@router.get("/revenue-overview")
def get_revenue_overview(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice).filter(Invoice.status == "FINALIZED")
    if start_date:
        start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
        query = query.filter(Invoice.finalized_at >= start_dt)
    if end_date:
        end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
        query = query.filter(Invoice.finalized_at <= end_dt)

    invoices = query.order_by(Invoice.finalized_at.desc()).all()

    total_revenue_paise = sum(i.grand_total for i in invoices)
    parts_total_paise = sum(i.parts_total for i in invoices)
    labour_total_paise = sum(i.labour_total for i in invoices)
    other_charges_total_paise = sum(i.other_charges_total for i in invoices)
    discount_total_paise = sum(i.discount for i in invoices)
    tax_total_paise = sum(i.tax_total for i in invoices)

    invoice_list = []
    total_collected_paise = 0
    total_outstanding_paise = 0
    paid_count = 0
    partially_paid_count = 0
    unpaid_count = 0

    method_totals = {}
    monthly_map = {}

    for inv in invoices:
        paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in inv.payments))
        balance = max(0, inv.grand_total - paid)
        total_collected_paise += paid
        total_outstanding_paise += balance

        if balance == 0 and inv.grand_total > 0:
            paid_count += 1
        elif paid > 0:
            partially_paid_count += 1
        else:
            unpaid_count += 1

        for p in inv.payments:
            amt = -p.amount if p.is_reversal else p.amount
            method_totals[p.method] = method_totals.get(p.method, 0) + amt

        dt = inv.finalized_at or inv.created_at
        m_key = dt.strftime("%Y-%m")
        m_label = dt.strftime("%b %Y")
        if m_key not in monthly_map:
            monthly_map[m_key] = {
                "month_key": m_key,
                "month_label": m_label,
                "invoice_count": 0,
                "revenue_paise": 0,
                "parts_paise": 0,
                "labour_paise": 0,
                "other_paise": 0,
                "collected_paise": 0,
                "outstanding_paise": 0
            }
        monthly_map[m_key]["invoice_count"] += 1
        monthly_map[m_key]["revenue_paise"] += inv.grand_total
        monthly_map[m_key]["parts_paise"] += inv.parts_total
        monthly_map[m_key]["labour_paise"] += inv.labour_total
        monthly_map[m_key]["other_paise"] += inv.other_charges_total
        monthly_map[m_key]["collected_paise"] += paid
        monthly_map[m_key]["outstanding_paise"] += balance

        inv_item = {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "job_card_id": inv.job_card_id,
            "job_card_number": inv.job_card.job_card_number if inv.job_card else "",
            "customer_name": inv.job_card.customer.name if (inv.job_card and inv.job_card.customer) else "Unknown",
            "customer_phone": inv.job_card.customer.phone if (inv.job_card and inv.job_card.customer) else "",
            "vehicle_reg": inv.job_card.vehicle.registration_number if (inv.job_card and inv.job_card.vehicle) else "",
            "vehicle_model": f"{inv.job_card.vehicle.make} {inv.job_card.vehicle.model}" if (inv.job_card and inv.job_card.vehicle) else "",
            "finalized_at": inv.finalized_at.strftime("%d/%m/%Y") if inv.finalized_at else "",
            "date_iso": dt.strftime("%Y-%m-%d"),
            "parts_total": inv.parts_total,
            "labour_total": inv.labour_total,
            "other_charges_total": inv.other_charges_total,
            "discount": inv.discount,
            "tax_total": inv.tax_total,
            "grand_total": inv.grand_total,
            "amount_paid": paid,
            "balance_due": balance,
            "payment_status": inv.payment_status
        }
        invoice_list.append(inv_item)

    # Build daily calendar breakdown (invoiced sales + cash collections)
    daily_map = {}
    for inv_item in invoice_list:
        d_key = inv_item["date_iso"]
        if d_key not in daily_map:
            dt_obj = datetime.strptime(d_key, "%Y-%m-%d")
            daily_map[d_key] = {
                "date": d_key,
                "formatted_date": dt_obj.strftime("%d %b %Y"),
                "day_name": dt_obj.strftime("%A"),
                "invoiced_revenue_paise": 0,
                "parts_paise": 0,
                "labour_paise": 0,
                "other_paise": 0,
                "discount_paise": 0,
                "tax_paise": 0,
                "invoice_count": 0,
                "collections_paise": 0,
                "invoices": [],
                "payments": []
            }
        daily_map[d_key]["invoiced_revenue_paise"] += inv_item["grand_total"]
        daily_map[d_key]["parts_paise"] += inv_item["parts_total"]
        daily_map[d_key]["labour_paise"] += inv_item["labour_total"]
        daily_map[d_key]["other_paise"] += inv_item["other_charges_total"]
        daily_map[d_key]["discount_paise"] += inv_item["discount"]
        daily_map[d_key]["tax_paise"] += inv_item["tax_total"]
        daily_map[d_key]["invoice_count"] += 1
        daily_map[d_key]["invoices"].append(inv_item)

    all_payments = db.query(Payment).all()
    for p in all_payments:
        p_dt = p.paid_at
        d_key = p_dt.strftime("%Y-%m-%d")
        amt = -p.amount if p.is_reversal else p.amount
        if d_key not in daily_map:
            daily_map[d_key] = {
                "date": d_key,
                "formatted_date": p_dt.strftime("%d %b %Y"),
                "day_name": p_dt.strftime("%A"),
                "invoiced_revenue_paise": 0,
                "parts_paise": 0,
                "labour_paise": 0,
                "other_paise": 0,
                "discount_paise": 0,
                "tax_paise": 0,
                "invoice_count": 0,
                "collections_paise": 0,
                "invoices": [],
                "payments": []
            }
        daily_map[d_key]["collections_paise"] += amt
        daily_map[d_key]["payments"].append({
            "id": p.id,
            "amount": p.amount,
            "method": p.method,
            "reference": p.reference or "",
            "invoice_id": p.invoice_id,
            "invoice_number": p.invoice.invoice_number if p.invoice else "",
            "is_reversal": p.is_reversal,
            "time_str": p_dt.strftime("%I:%M %p")
        })

    clean_by_method = {k: v for k, v in method_totals.items() if v > 0}
    collection_rate = round((total_collected_paise / total_revenue_paise * 100), 1) if total_revenue_paise > 0 else 0.0
    avg_ticket = int(total_revenue_paise / len(invoices)) if invoices else 0

    return {
        "summary": {
            "total_revenue_paise": total_revenue_paise,
            "parts_total_paise": parts_total_paise,
            "labour_total_paise": labour_total_paise,
            "other_charges_total_paise": other_charges_total_paise,
            "discount_total_paise": discount_total_paise,
            "tax_total_paise": tax_total_paise,
            "total_collected_paise": total_collected_paise,
            "total_outstanding_paise": total_outstanding_paise,
            "collection_rate_percent": collection_rate,
            "finalized_count": len(invoices),
            "average_ticket_paise": avg_ticket,
            "paid_count": paid_count,
            "partially_paid_count": partially_paid_count,
            "unpaid_count": unpaid_count,
        },
        "breakdown": {
            "parts_percent": round((parts_total_paise / total_revenue_paise * 100), 1) if total_revenue_paise > 0 else 0.0,
            "labour_percent": round((labour_total_paise / total_revenue_paise * 100), 1) if total_revenue_paise > 0 else 0.0,
            "other_percent": round((other_charges_total_paise / total_revenue_paise * 100), 1) if total_revenue_paise > 0 else 0.0,
        },
        "payments_by_method": clean_by_method,
        "monthly_trend": [monthly_map[k] for k in sorted(monthly_map.keys(), reverse=True)],
        "daily_breakdown": daily_map,
        "invoices": invoice_list
    }

