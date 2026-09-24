from typing import Dict, Any, List
import re
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from app.models import Vehicle, Customer, JobCard, Invoice

def normalize_registration(reg_no: str) -> str:
    """Removes all non-alphanumeric characters and converts to uppercase."""
    return re.sub(r"[^A-Za-z0-9]", "", reg_no).upper()

def global_search(db: Session, query: str, limit_per_category: int = 10) -> Dict[str, List[Dict[str, Any]]]:
    """
    High-speed omnibox search across vehicles, customers, job cards, and invoices.
    Optimized for sub-300ms response time using indexed columns and batch aggregation.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"vehicles": [], "customers": [], "job_cards": [], "invoices": []}

    norm_query = normalize_registration(clean_query)
    like_query = f"%{clean_query}%"
    norm_like_query = f"%{norm_query}%" if norm_query else like_query

    # 1. Search Vehicles (by registration_normalized, registration_number, vin, make, model)
    vehicle_rows = db.query(Vehicle).options(joinedload(Vehicle.customer)).filter(
        or_(
            Vehicle.registration_normalized.like(norm_like_query),
            Vehicle.registration_number.like(like_query),
            Vehicle.vin.like(like_query),
            Vehicle.make.like(like_query),
            Vehicle.model.like(like_query)
        )
    ).limit(limit_per_category).all()

    v_ids = [v.id for v in vehicle_rows]
    job_counts: Dict[int, int] = {}
    last_job_dates: Dict[int, Any] = {}
    if v_ids:
        stat_rows = db.query(
            JobCard.vehicle_id,
            func.count(JobCard.id),
            func.max(JobCard.date)
        ).filter(JobCard.vehicle_id.in_(v_ids)).group_by(JobCard.vehicle_id).all()
        for vid, cnt, max_dt in stat_rows:
            job_counts[vid] = cnt
            last_job_dates[vid] = max_dt

    vehicles = []
    for v in vehicle_rows:
        last_dt = last_job_dates.get(v.id)
        vehicles.append({
            "id": v.id,
            "registration_number": v.registration_number,
            "make": v.make,
            "model": v.model,
            "customer_name": v.customer.name if v.customer else "Unknown",
            "customer_phone": v.customer.phone if v.customer else "",
            "total_services": job_counts.get(v.id, 0),
            "last_service_date": last_dt.strftime("%d/%m/%Y") if last_dt else None,
            "current_odometer": v.current_odometer
        })

    # 2. Search Customers (by phone, name, alt_phone)
    customer_rows = db.query(Customer).options(joinedload(Customer.vehicles)).filter(
        or_(
            Customer.phone.like(like_query),
            Customer.name.like(like_query),
            Customer.alt_phone.like(like_query)
        )
    ).limit(limit_per_category).all()

    customers = []
    for c in customer_rows:
        customers.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "address": c.address,
            "vehicles_count": len(c.vehicles)
        })

    # 3. Search Job Cards (by job_card_number, status, vehicle reg, customer name/phone)
    job_rows = db.query(JobCard).options(
        joinedload(JobCard.customer),
        joinedload(JobCard.vehicle)
    ).outerjoin(Vehicle, JobCard.vehicle_id == Vehicle.id).outerjoin(Customer, JobCard.customer_id == Customer.id).filter(
        or_(
            JobCard.job_card_number.like(like_query),
            JobCard.status.like(like_query),
            Vehicle.registration_number.like(like_query),
            Vehicle.registration_normalized.like(norm_like_query),
            Customer.name.like(like_query),
            Customer.phone.like(like_query)
        )
    ).order_by(JobCard.created_at.desc()).limit(limit_per_category).all()

    job_cards = []
    for j in job_rows:
        job_cards.append({
            "id": j.id,
            "job_card_number": j.job_card_number,
            "customer_name": j.customer.name if j.customer else "",
            "vehicle_reg": j.vehicle.registration_number if j.vehicle else "",
            "vehicle_model": f"{j.vehicle.make} {j.vehicle.model}" if j.vehicle else "",
            "status": j.status,
            "date": j.date.strftime("%d/%m/%Y"),
            "odometer": j.odometer
        })

    # 4. Search Invoices (by invoice_number, job_card_number, vehicle reg, customer name/phone)
    invoice_rows = db.query(Invoice).options(
        joinedload(Invoice.job_card).joinedload(JobCard.customer),
        joinedload(Invoice.job_card).joinedload(JobCard.vehicle)
    ).outerjoin(JobCard, Invoice.job_card_id == JobCard.id).outerjoin(
        Vehicle, JobCard.vehicle_id == Vehicle.id
    ).outerjoin(
        Customer, JobCard.customer_id == Customer.id
    ).filter(
        or_(
            Invoice.invoice_number.like(like_query),
            JobCard.job_card_number.like(like_query),
            Vehicle.registration_number.like(like_query),
            Vehicle.registration_normalized.like(norm_like_query),
            Customer.name.like(like_query),
            Customer.phone.like(like_query)
        )
    ).order_by(Invoice.created_at.desc()).limit(limit_per_category).all()

    invoices = []
    for inv in invoice_rows:
        jc = inv.job_card
        invoices.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "job_card_number": jc.job_card_number if jc else "",
            "grand_total": inv.grand_total,
            "payment_status": inv.payment_status,
            "status": inv.status,
            "customer_name": jc.customer.name if (jc and jc.customer) else ""
        })

    return {
        "vehicles": vehicles,
        "customers": customers,
        "job_cards": job_cards,
        "invoices": invoices
    }
