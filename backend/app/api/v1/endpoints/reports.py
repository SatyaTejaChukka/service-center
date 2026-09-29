import json
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import JobCard, Invoice, Payment, User, Setting
from app.services.export_service import (
    generate_sales_register_csv,
    generate_day_book_csv,
    generate_ca_audit_pack_xlsx,
    generate_sales_register_xlsx,
    generate_day_book_xlsx
)

router = APIRouter()

def get_workshop_profile(db: Session) -> Dict[str, Any]:
    s = db.query(Setting).filter(Setting.key == "business_profile").first()
    if s and s.value_json:
        try:
            return json.loads(s.value_json)
        except Exception:
            pass
    return {"name": "Automotive Service Center", "gstin": ""}

def build_invoice_export_dicts(invoices: List[Invoice]) -> List[Dict[str, Any]]:
    results = []
    for inv in invoices:
        paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in inv.payments))
        balance = max(0, inv.grand_total - paid)
        dt = inv.finalized_at or inv.created_at
        taxable = inv.taxable_amount or (inv.grand_total - inv.tax_total)
        cgst = inv.cgst_amount or (inv.tax_total // 2)
        sgst = inv.sgst_amount or (inv.tax_total // 2)
        igst = inv.igst_amount or 0
        cost = inv.total_cost or 0
        parts_cost = 0
        labour_cost = 0
        if inv.job_card:
            parts_cost = sum(int((p.cost_price or 0) * (p.quantity or 1)) for p in inv.job_card.parts_items if p.status in ["APPROVED", "USED"])
            labour_cost = sum(int((l.cost_price or 0) * (l.quantity or 1)) for l in inv.job_card.labour_items if l.status in ["APPROVED", "DONE"])
        if cost == 0 and (parts_cost + labour_cost) > 0:
            cost = parts_cost + labour_cost

        profit = inv.gross_profit if inv.gross_profit is not None else (taxable - cost)
        margin = round((profit / inv.grand_total * 100), 2) if inv.grand_total > 0 else 0.0

        results.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "job_card_id": inv.job_card_id,
            "job_card_number": inv.job_card.job_card_number if inv.job_card else "",
            "customer_name": inv.job_card.customer.name if (inv.job_card and inv.job_card.customer) else "Unknown",
            "customer_phone": inv.job_card.customer.phone if (inv.job_card and inv.job_card.customer) else "",
            "customer_gstin": inv.job_card.customer.gstin if (inv.job_card and inv.job_card.customer) else "",
            "vehicle_reg": inv.job_card.vehicle.registration_number if (inv.job_card and inv.job_card.vehicle) else "",
            "vehicle_model": f"{inv.job_card.vehicle.make} {inv.job_card.vehicle.model}" if (inv.job_card and inv.job_card.vehicle) else "",
            "finalized_at": inv.finalized_at.strftime("%d/%m/%Y") if inv.finalized_at else "",
            "date_iso": dt.strftime("%Y-%m-%d"),
            "parts_total": inv.parts_total,
            "labour_total": inv.labour_total,
            "other_charges_total": inv.other_charges_total,
            "discount": inv.discount,
            "taxable_amount": taxable,
            "cgst_amount": cgst,
            "sgst_amount": sgst,
            "igst_amount": igst,
            "tax_total": inv.tax_total,
            "grand_total": inv.grand_total,
            "total_cost": cost,
            "parts_cost": parts_cost,
            "labour_cost": labour_cost,
            "gross_profit": profit,
            "margin_percent": margin,
            "amount_paid": paid,
            "balance_due": balance,
            "payment_status": inv.payment_status
        })
    return results

def build_payments_export_dicts(payments: List[Payment]) -> List[Dict[str, Any]]:
    results = []
    for p in payments:
        p_dt = p.paid_at
        customer_name = ""
        vehicle_reg = ""
        invoice_number = ""
        if p.invoice:
            invoice_number = p.invoice.invoice_number or ""
            if p.invoice.job_card:
                if p.invoice.job_card.customer:
                    customer_name = p.invoice.job_card.customer.name or ""
                if p.invoice.job_card.vehicle:
                    vehicle_reg = p.invoice.job_card.vehicle.registration_number or ""
        results.append({
            "id": p.id,
            "paid_date": p_dt.strftime("%d/%m/%Y"),
            "date_iso": p_dt.strftime("%Y-%m-%d"),
            "time_str": p_dt.strftime("%I:%M %p"),
            "invoice_id": p.invoice_id,
            "invoice_number": invoice_number,
            "customer_name": customer_name,
            "vehicle_reg": vehicle_reg,
            "method": p.method,
            "reference": p.reference or "",
            "amount": p.amount,
            "is_reversal": p.is_reversal,
            "note": p.note or ""
        })
    return results

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
    invoice_list = build_invoice_export_dicts(invoices)

    total_revenue_paise = sum(i["grand_total"] for i in invoice_list)
    parts_total_paise = sum(i["parts_total"] for i in invoice_list)
    labour_total_paise = sum(i["labour_total"] for i in invoice_list)
    other_charges_total_paise = sum(i["other_charges_total"] for i in invoice_list)
    discount_total_paise = sum(i["discount"] for i in invoice_list)
    tax_total_paise = sum(i["tax_total"] for i in invoice_list)

    total_cost_paise = sum(i["total_cost"] for i in invoice_list)
    parts_cost_paise = sum(i.get("parts_cost", 0) for i in invoice_list)
    labour_cost_paise = sum(i.get("labour_cost", 0) for i in invoice_list)
    gross_profit_paise = sum(i["gross_profit"] for i in invoice_list)
    taxable_paise = sum(i["taxable_amount"] for i in invoice_list)
    cgst_paise = sum(i["cgst_amount"] for i in invoice_list)
    sgst_paise = sum(i["sgst_amount"] for i in invoice_list)
    igst_paise = sum(i["igst_amount"] for i in invoice_list)
    overall_margin = round((gross_profit_paise / total_revenue_paise * 100), 1) if total_revenue_paise > 0 else 0.0

    total_collected_paise = 0
    total_outstanding_paise = 0
    paid_count = 0
    partially_paid_count = 0
    unpaid_count = 0

    method_totals = {}
    monthly_map = {}

    for inv in invoice_list:
        paid = inv["amount_paid"]
        balance = inv["balance_due"]
        total_collected_paise += paid
        total_outstanding_paise += balance

        if balance == 0 and inv["grand_total"] > 0:
            paid_count += 1
        elif paid > 0:
            partially_paid_count += 1
        else:
            unpaid_count += 1

        dt_iso = inv["date_iso"]
        m_key = dt_iso[:7] # YYYY-MM
        dt_obj = datetime.strptime(dt_iso, "%Y-%m-%d")
        m_label = dt_obj.strftime("%b %Y")
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
                "outstanding_paise": 0,
                "cost_paise": 0,
                "profit_paise": 0,
                "margin_percent": 0.0
            }
        monthly_map[m_key]["invoice_count"] += 1
        monthly_map[m_key]["revenue_paise"] += inv["grand_total"]
        monthly_map[m_key]["parts_paise"] += inv["parts_total"]
        monthly_map[m_key]["labour_paise"] += inv["labour_total"]
        monthly_map[m_key]["other_paise"] += inv["other_charges_total"]
        monthly_map[m_key]["collected_paise"] += paid
        monthly_map[m_key]["outstanding_paise"] += balance
        monthly_map[m_key]["cost_paise"] += inv["total_cost"]
        monthly_map[m_key]["profit_paise"] += inv["gross_profit"]
        m_rev = monthly_map[m_key]["revenue_paise"]
        m_prof = monthly_map[m_key]["profit_paise"]
        monthly_map[m_key]["margin_percent"] = round((m_prof / m_rev * 100), 1) if m_rev > 0 else 0.0

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
                "taxable_paise": 0,
                "cgst_paise": 0,
                "sgst_paise": 0,
                "igst_paise": 0,
                "cost_paise": 0,
                "profit_paise": 0,
                "margin_percent": 0.0,
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
        daily_map[d_key]["taxable_paise"] += inv_item["taxable_amount"]
        daily_map[d_key]["cgst_paise"] += inv_item["cgst_amount"]
        daily_map[d_key]["sgst_paise"] += inv_item["sgst_amount"]
        daily_map[d_key]["igst_paise"] += inv_item["igst_amount"]
        daily_map[d_key]["cost_paise"] += inv_item["total_cost"]
        daily_map[d_key]["profit_paise"] += inv_item["gross_profit"]
        d_rev = daily_map[d_key]["invoiced_revenue_paise"]
        d_prof = daily_map[d_key]["profit_paise"]
        daily_map[d_key]["margin_percent"] = round((d_prof / d_rev * 100), 1) if d_rev > 0 else 0.0
        daily_map[d_key]["invoice_count"] += 1
        daily_map[d_key]["invoices"].append(inv_item)

    all_payments = db.query(Payment).all()
    for p in all_payments:
        p_dt = p.paid_at
        d_key = p_dt.strftime("%Y-%m-%d")
        amt = -p.amount if p.is_reversal else p.amount
        method_totals[p.method] = method_totals.get(p.method, 0) + amt

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
                "taxable_paise": 0,
                "cgst_paise": 0,
                "sgst_paise": 0,
                "igst_paise": 0,
                "cost_paise": 0,
                "profit_paise": 0,
                "margin_percent": 0.0,
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
            "total_cost_paise": total_cost_paise,
            "parts_cost_paise": parts_cost_paise,
            "labour_cost_paise": labour_cost_paise,
            "gross_profit_paise": gross_profit_paise,
            "gross_margin_percent": overall_margin,
            "taxable_amount_paise": taxable_paise,
            "cgst_paise": cgst_paise,
            "sgst_paise": sgst_paise,
            "igst_paise": igst_paise,
            "profit_summary": {
                "total_cost_paise": total_cost_paise,
                "parts_cost_paise": parts_cost_paise,
                "labour_cost_paise": labour_cost_paise,
                "gross_profit_paise": gross_profit_paise,
                "overall_margin_percent": overall_margin,
                "gross_margin_percent": overall_margin
            },
            "gst_summary": {
                "taxable_amount_paise": taxable_paise,
                "taxable_paise": taxable_paise,
                "cgst_paise": cgst_paise,
                "sgst_paise": sgst_paise,
                "igst_paise": igst_paise,
                "total_gst_paise": tax_total_paise
            }
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

# ==============================================================================
# 1-CLICK EXCEL / CSV EXPORT FOR CHARTERED ACCOUNTANTS (CA)
# ==============================================================================

@router.get("/export/sales-register")
def export_sales_register(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Invoice).filter(Invoice.status == "FINALIZED")
    if start_date:
        query = query.filter(Invoice.finalized_at >= datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0))
    if end_date:
        query = query.filter(Invoice.finalized_at <= datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59))
    invoices = query.order_by(Invoice.finalized_at.asc()).all()

    inv_data = build_invoice_export_dicts(invoices)
    profile = get_workshop_profile(db)
    date_str = f"{start_date.strftime('%Y%m%d') if start_date else 'all'}_{end_date.strftime('%Y%m%d') if end_date else 'all'}"

    if format == "csv":
        csv_content = generate_sales_register_csv(inv_data, profile)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Sales_Register_{date_str}.csv"}
        )
    else:
        xlsx_bytes = generate_sales_register_xlsx(inv_data, profile)
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=Sales_Register_{date_str}.xlsx"}
        )

@router.get("/export/day-book")
def export_day_book(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Payment)
    if start_date:
        query = query.filter(Payment.paid_at >= datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0))
    if end_date:
        query = query.filter(Payment.paid_at <= datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59))
    payments = query.order_by(Payment.paid_at.asc()).all()

    pay_data = build_payments_export_dicts(payments)
    profile = get_workshop_profile(db)
    date_str = f"{start_date.strftime('%Y%m%d') if start_date else 'all'}_{end_date.strftime('%Y%m%d') if end_date else 'all'}"

    if format == "csv":
        csv_content = generate_day_book_csv(pay_data, profile)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=Day_Book_Receipts_{date_str}.csv"}
        )
    else:
        xlsx_bytes = generate_day_book_xlsx(pay_data, profile)
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=Day_Book_Receipts_{date_str}.xlsx"}
        )

@router.get("/export/ca-audit-pack")
def export_ca_audit_pack(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    inv_query = db.query(Invoice).filter(Invoice.status == "FINALIZED")
    pay_query = db.query(Payment)
    if start_date:
        start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
        inv_query = inv_query.filter(Invoice.finalized_at >= start_dt)
        pay_query = pay_query.filter(Payment.paid_at >= start_dt)
    if end_date:
        end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
        inv_query = inv_query.filter(Invoice.finalized_at <= end_dt)
        pay_query = pay_query.filter(Payment.paid_at <= end_dt)

    invoices = inv_query.order_by(Invoice.finalized_at.asc()).all()
    payments = pay_query.order_by(Payment.paid_at.asc()).all()

    inv_data = build_invoice_export_dicts(invoices)
    pay_data = build_payments_export_dicts(payments)
    profile = get_workshop_profile(db)
    date_str = f"{start_date.strftime('%Y%m%d') if start_date else 'all'}_{end_date.strftime('%Y%m%d') if end_date else 'all'}"

    xlsx_bytes = generate_ca_audit_pack_xlsx(inv_data, pay_data, profile)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=CA_Audit_Pack_{date_str}.xlsx"}
    )

