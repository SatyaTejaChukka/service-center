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
    current_user: User = Depends(get_current_user)
):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Labour item name is required")
    rate = data.get("default_rate", 0)
    if rate < 0:
        raise HTTPException(status_code=400, detail="Default rate cannot be negative")
    cost_price = data.get("cost_price", 0)
    sac_code = data.get("sac_code", "998729")
    gst_rate = float(data.get("gst_rate", 18.0) if data.get("gst_rate") is not None else 18.0)

    existing = db.query(LabourCatalog).filter(LabourCatalog.name == name).first()
    if existing:
        existing.is_active = True
        existing.default_rate = rate
        existing.cost_price = cost_price
        existing.sac_code = sac_code
        existing.gst_rate = gst_rate
        db.commit()
        db.refresh(existing)
        return existing

    item = LabourCatalog(
        name=name,
        default_rate=rate,
        cost_price=cost_price,
        sac_code=sac_code,
        gst_rate=gst_rate,
        is_active=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/labour/{item_id}", response_model=LabourCatalogItem)
@router.patch("/labour/{item_id}", response_model=LabourCatalogItem)
def update_labour_catalog_item(
    item_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(LabourCatalog).filter(LabourCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Labour item not found")

    if "name" in data and str(data["name"]).strip():
        new_name = str(data["name"]).strip()
        conflict = db.query(LabourCatalog).filter(
            LabourCatalog.name == new_name,
            LabourCatalog.id != item_id,
            LabourCatalog.is_active == True
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Another labour item with this name already exists")
        item.name = new_name
    if "default_rate" in data and data["default_rate"] is not None:
        rate = int(data["default_rate"])
        if rate < 0:
            raise HTTPException(status_code=400, detail="Default rate cannot be negative")
        item.default_rate = rate
    if "cost_price" in data and data["cost_price"] is not None:
        item.cost_price = max(0, int(data["cost_price"]))
    if "sac_code" in data:
        item.sac_code = str(data["sac_code"]).strip() or "998729"
    if "gst_rate" in data and data["gst_rate"] is not None:
        try:
            item.gst_rate = float(data["gst_rate"])
        except (ValueError, TypeError):
            pass

    db.commit()
    db.refresh(item)
    return item

@router.delete("/labour/{item_id}")
def deactivate_labour_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
    current_user: User = Depends(get_current_user)
):
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Part name is required")
    price = data.get("default_price", 0)
    if price < 0:
        raise HTTPException(status_code=400, detail="Default price cannot be negative")
    cost_price = data.get("cost_price", data.get("purchase_cost", 0))
    if cost_price < 0:
        cost_price = 0
    part_no = data.get("part_number", "").strip() if data.get("part_number") else None
    unit = data.get("unit", "pcs").strip() or "pcs"
    hsn_code = data.get("hsn_code", "8708").strip() or "8708"
    gst_rate = float(data.get("gst_rate", 18.0) if data.get("gst_rate") is not None else 18.0)

    existing = db.query(PartsCatalog).filter(PartsCatalog.name == name).first()
    if existing:
        existing.is_active = True
        existing.part_number = part_no
        existing.unit = unit
        existing.default_price = price
        existing.cost_price = cost_price
        existing.purchase_cost = cost_price
        existing.hsn_code = hsn_code
        existing.gst_rate = gst_rate
        db.commit()
        db.refresh(existing)
        return existing

    item = PartsCatalog(
        name=name,
        part_number=part_no,
        unit=unit,
        default_price=price,
        purchase_cost=cost_price,
        hsn_code=hsn_code,
        gst_rate=gst_rate,
        is_active=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/parts/{item_id}", response_model=PartsCatalogItem)
@router.patch("/parts/{item_id}", response_model=PartsCatalogItem)
def update_parts_catalog_item(
    item_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(PartsCatalog).filter(PartsCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Part item not found")

    if "name" in data and str(data["name"]).strip():
        new_name = str(data["name"]).strip()
        conflict = db.query(PartsCatalog).filter(
            PartsCatalog.name == new_name,
            PartsCatalog.id != item_id,
            PartsCatalog.is_active == True
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="Another part with this name already exists")
        item.name = new_name
    if "part_number" in data:
        item.part_number = str(data["part_number"]).strip() if data["part_number"] else None
    if "unit" in data and str(data["unit"]).strip():
        item.unit = str(data["unit"]).strip()
    if "default_price" in data and data["default_price"] is not None:
        price = int(data["default_price"])
        if price < 0:
            raise HTTPException(status_code=400, detail="Default price cannot be negative")
        item.default_price = price
    cost = data.get("cost_price") if data.get("cost_price") is not None else data.get("purchase_cost")
    if cost is not None:
        c_val = max(0, int(cost))
        item.purchase_cost = c_val
        item.cost_price = c_val
    if "hsn_code" in data:
        item.hsn_code = str(data["hsn_code"]).strip() or "8708"
    if "gst_rate" in data and data["gst_rate"] is not None:
        try:
            item.gst_rate = float(data["gst_rate"])
        except (ValueError, TypeError):
            pass

    db.commit()
    db.refresh(item)
    return item

@router.delete("/parts/{item_id}")
def deactivate_parts_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = db.query(PartsCatalog).filter(PartsCatalog.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    db.commit()
    return {"message": "Part deactivated"}

