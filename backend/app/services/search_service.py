import re
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import Vehicle, Customer, JobCard, Invoice

def normalize_registration(reg_no: str) -> str:
    """Removes all non-alphanumeric characters and converts to uppercase."""
    return re.sub(r"[^A-Za-z0-9]", "", reg_no).upper()

def global_search(db: Session, query: str, limit_per_category: int = 10) -> Dict[str, List[Dict[str, Any]]]:
    """
    High-speed omnibox search across vehicles, customers, job cards, and invoices.
    Optimized for sub-300ms response time using indexed columns.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"vehicles": [], "customers": [], "job_cards": [], "invoices": []}

    norm_query = normalize_registration(clean_query)
    like_query = f"%{clean_query}%"
    norm_like_query = f"%{norm_query}%" if norm_query else like_query

    # 1. Search Vehicles (by registration_normalized, registration_number, vin)
    vehicle_rows = db.query(Vehicle).filter(
        or_(
            Vehicle.registration_normalized.like(norm_like_query),
            Vehicle.registration_number.like(like_query),
            Vehicle.vin.like(like_query),
            Vehicle.make.like(like_query),
            Vehicle.model.like(like_query)
        )
    ).limit(limit_per_category).all()

    vehicles = []
    for v in vehicle_rows:
        job_count = db.query(JobCard).filter(JobCard.vehicle_id == v.id).count()
        last_job = db.query(JobCard).filter(JobCard.vehicle_id == v.id).order_by(JobCard.date.desc()).first()
        vehicles.append({
            "id": v.id,
            "registration_number": v.registration_number,
            "make": v.make,
            "model": v.model,
            "customer_name": v.customer.name if v.customer else "Unknown",
            "customer_phone": v.customer.phone if v.customer else "",
            "total_services": job_count,
            "last_service_date": last_job.date.strftime("%d/%m/%Y") if last_job else None,
            "current_odometer": v.current_odometer
        })

    # 2. Search Customers (by phone, name, alt_phone)
    customer_rows = db.query(Customer).filter(
        or_(
            Customer.phone.like(like_query),
            Customer.name.like(like_query),
            Customer.alt_phone.like(like_query)
        )
    ).limit(limit_per_category).all()

    customers = []
    for c in customer_rows:
        veh_count = len(c.vehicles)
        customers.append({
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "address": c.address,
            "vehicles_count": veh_count
        })

    # 3. Search Job Cards (by job_card_number, vehicle reg)
    job_rows = db.query(JobCard).filter(
        or_(
            JobCard.job_card_number.like(like_query),
            JobCard.status.like(like_query)
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

    # 4. Search Invoices (by invoice_number)
    invoice_rows = db.query(Invoice).filter(
        Invoice.invoice_number.like(like_query)
    ).order_by(Invoice.created_at.desc()).limit(limit_per_category).all()

    invoices = []
    for inv in invoice_rows:
        invoices.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "job_card_number": inv.job_card.job_card_number if inv.job_card else "",
            "grand_total": inv.grand_total,
            "payment_status": inv.payment_status,
            "status": inv.status,
            "customer_name": inv.job_card.customer.name if (inv.job_card and inv.job_card.customer) else ""
        })

    return {
        "vehicles": vehicles,
        "customers": customers,
        "job_cards": job_cards,
        "invoices": invoices
    }
