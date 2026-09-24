from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.audit import record_audit
from app.models import Vehicle, Customer, JobCard, User
from app.schemas import VehicleCreate, VehicleUpdate, VehicleResponse
from app.services.search_service import normalize_registration

router = APIRouter()

@router.get("", response_model=List[VehicleResponse])
def get_vehicles(
    search: Optional[str] = None,
    customer_id: Optional[int] = None,
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Vehicle)
    if not include_archived:
        query = query.filter(Vehicle.is_archived == False)
    if customer_id:
        query = query.filter(Vehicle.customer_id == customer_id)
    if search:
        s_norm = normalize_registration(search)
        query = query.filter(
            or_(
                Vehicle.registration_normalized.like(f"%{s_norm}%"),
                Vehicle.make.like(f"%{search}%"),
                Vehicle.model.like(f"%{search}%"),
                Vehicle.vin.like(f"%{search}%")
            )
        )
    return query.order_by(Vehicle.created_at.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=VehicleResponse)
def create_vehicle(
    req: VehicleCreate,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    cust = db.query(Customer).filter(Customer.id == req.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    norm_reg = normalize_registration(req.registration_number)
    if not norm_reg:
        raise HTTPException(status_code=400, detail="Invalid registration number")

    existing = db.query(Vehicle).filter(
        Vehicle.registration_normalized == norm_reg,
        Vehicle.is_archived == False
    ).first()

    if existing and not force:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Vehicle with this registration number already exists",
                "existing_vehicle_id": existing.id,
                "current_owner_id": existing.customer_id,
                "current_owner_name": existing.customer.name if existing.customer else ""
            }
        )

    veh = Vehicle(
        customer_id=req.customer_id,
        registration_number=req.registration_number.strip().upper(),
        registration_normalized=norm_reg,
        make=req.make.strip(),
        model=req.model.strip(),
        variant=req.variant.strip() if req.variant else None,
        fuel_type=req.fuel_type,
        vin=req.vin.strip().upper() if req.vin else None,
        engine_number=req.engine_number.strip().upper() if req.engine_number else None,
        year=req.year,
        colour=req.colour.strip() if req.colour else None,
        current_odometer=req.current_odometer
    )
    db.add(veh)
    db.flush()
    record_audit(db, current_user.id, "VEHICLE_CREATE", "vehicle", str(veh.id), None, {"reg": veh.registration_number})
    db.commit()
    db.refresh(veh)
    return veh

@router.get("/{vehicle_id}")
def get_vehicle_detail(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    veh = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # Chronological history of past job cards
    jobs = db.query(JobCard).filter(JobCard.vehicle_id == veh.id).order_by(JobCard.date.desc(), JobCard.created_at.desc()).all()
    history = []
    for j in jobs:
        inv = j.invoice
        # summarize work done
        work_descriptions = [l.description for l in j.labour_items if l.status in ("APPROVED", "DONE")]
        parts_descriptions = [p.description for p in j.parts_items if p.status in ("APPROVED", "USED")]
        summary_str = ", ".join(work_descriptions + parts_descriptions) or "General Inspection"
        
        history.append({
            "job_card_id": j.id,
            "job_card_number": j.job_card_number,
            "date": j.date.strftime("%d/%m/%Y"),
            "odometer": j.odometer,
            "status": j.status,
            "work_summary": summary_str,
            "total_amount": inv.grand_total if inv else 0,
            "invoice_id": inv.id if inv else None,
            "invoice_number": inv.invoice_number if inv else None,
            "invoice_status": inv.status if inv else None
        })

    return {
        "vehicle": VehicleResponse.model_validate(veh),
        "owner": {
            "id": veh.customer.id,
            "name": veh.customer.name,
            "phone": veh.customer.phone
        } if veh.customer else None,
        "history": history
    }

@router.post("/{vehicle_id}/transfer-ownership")
def transfer_vehicle_ownership(
    vehicle_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    veh = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    new_customer_id = data.get("new_customer_id")
    new_cust = db.query(Customer).filter(Customer.id == new_customer_id).first()
    if not new_cust:
        raise HTTPException(status_code=404, detail="Target customer not found")

    old_owner_id = veh.customer_id
    veh.customer_id = new_customer_id
    record_audit(db, current_user.id, "VEHICLE_TRANSFER", "vehicle", str(veh.id), {"old_customer_id": old_owner_id}, {"new_customer_id": new_customer_id})
    db.commit()
    return {"message": "Ownership transferred successfully"}

@router.put("/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(
    vehicle_id: int,
    req: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    veh = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not veh:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    old_data = {
        "make": veh.make,
        "model": veh.model,
        "odometer": veh.current_odometer
    }

    if req.make is not None:
        veh.make = req.make.strip()
    if req.model is not None:
        veh.model = req.model.strip()
    if req.variant is not None:
        veh.variant = req.variant.strip() if req.variant else None
    if req.fuel_type is not None:
        veh.fuel_type = req.fuel_type
    if req.vin is not None:
        veh.vin = req.vin.strip().upper() if req.vin else None
    if req.engine_number is not None:
        veh.engine_number = req.engine_number.strip().upper() if req.engine_number else None
    if req.year is not None:
        veh.year = req.year
    if req.colour is not None:
        veh.colour = req.colour.strip() if req.colour else None
    if req.current_odometer is not None:
        veh.current_odometer = req.current_odometer

    record_audit(db, current_user.id, "VEHICLE_UPDATE", "vehicle", str(veh.id), old_data, {"make": veh.make, "model": veh.model, "odometer": veh.current_odometer})
    db.commit()
    db.refresh(veh)
    return veh
