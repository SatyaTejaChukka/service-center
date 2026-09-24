from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models import LabourCatalog, PartsCatalog, User
from app.schemas import LabourCatalogItem, PartsCatalogItem

router = APIRouter()

# --- Labour Catalog ---
@router.get("/labour", response_model=List[LabourCatalogItem])
def get_labour_catalog(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(LabourCatalog).filter(LabourCatalog.is_active == True).order_by(LabourCatalog.name).all()

@router.post("/labour", response_model=LabourCatalogItem)
def create_labour_catalog_item(
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Labour item name is required")
    rate = data.get("default_rate", 0)
    if rate < 0:
        raise HTTPException(status_code=400, detail="Default rate cannot be negative")

    existing = db.query(LabourCatalog).filter(LabourCatalog.name == name).first()
    if existing:
        existing.is_active = True
        existing.default_rate = rate
        db.commit()
        db.refresh(existing)
        return existing

    item = LabourCatalog(name=name, default_rate=rate, is_active=True)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/labour/{item_id}")
def deactivate_labour_item(item_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.query(LabourCatalog).filter(LabourCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    db.commit()
    return {"message": "Labour item deactivated"}

# --- Parts Catalog ---
@router.get("/parts", response_model=List[PartsCatalogItem])
def get_parts_catalog(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(PartsCatalog).filter(PartsCatalog.is_active == True).order_by(PartsCatalog.name).all()

@router.post("/parts", response_model=PartsCatalogItem)
def create_parts_catalog_item(
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Part name is required")
    price = data.get("default_price", 0)
    if price < 0:
        raise HTTPException(status_code=400, detail="Default price cannot be negative")
    part_no = data.get("part_number", "").strip() or None
    unit = data.get("unit", "pcs").strip() or "pcs"

    existing = db.query(PartsCatalog).filter(PartsCatalog.name == name).first()
    if existing:
        existing.is_active = True
        existing.part_number = part_no
        existing.unit = unit
        existing.default_price = price
        db.commit()
        db.refresh(existing)
        return existing

    item = PartsCatalog(
        name=name,
        part_number=part_no,
        unit=unit,
        default_price=price,
        is_active=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/parts/{item_id}")
def deactivate_parts_item(item_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = db.query(PartsCatalog).filter(PartsCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    db.commit()
    return {"message": "Part deactivated"}
