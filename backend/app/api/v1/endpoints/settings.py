import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.core.audit import record_audit
from app.models import Setting, User

router = APIRouter()

DEFAULT_PROFILE = {
    "name": "Pushpa Raj Automotive Services",
    "address": "12-4-56, Autonagar, Main Bypass Road",
    "phone": "+91 98765 43210",
    "email": "service@pushparajauto.com",
    "gstin": "",
    "upi_id": "pushparajauto@okaxis",
    "terms": "1. All estimates subject to unseen internal damages.\n2. Payment required on delivery of vehicle.\n3. Replaced parts to be claimed within 24 hours.",
    "footer": "Thank you for trusting Pushpa Raj Automotive Services!"
}

@router.get("/business")
def get_business_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Setting).filter(Setting.key == "business_profile").first()
    if not s:
        return DEFAULT_PROFILE
    return json.loads(s.value_json)

@router.put("/business")
def update_business_profile(
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    s = db.query(Setting).filter(Setting.key == "business_profile").first()
    if not s:
        s = Setting(key="business_profile", value_json=json.dumps(data))
        db.add(s)
    else:
        s.value_json = json.dumps(data)

    record_audit(db, admin.id, "SETTINGS_UPDATE", "settings", "business_profile", None, data)
    db.commit()
    return {"message": "Business profile updated successfully"}

@router.get("/discount-limit")
def get_discount_limit(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Setting).filter(Setting.key == "discount_limit").first()
    limit_paise = int(s.value_json) if s else 100000 # default ₹1,000
    return {"staff_discount_limit_paise": limit_paise}

@router.put("/discount-limit")
def update_discount_limit(
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    limit_paise = data.get("staff_discount_limit_paise", 100000)
    s = db.query(Setting).filter(Setting.key == "discount_limit").first()
    if not s:
        s = Setting(key="discount_limit", value_json=str(limit_paise))
        db.add(s)
    else:
        s.value_json = str(limit_paise)

    record_audit(db, admin.id, "SETTINGS_UPDATE", "settings", "discount_limit", None, {"limit_paise": limit_paise})
    db.commit()
    return {"message": "Discount limit updated", "staff_discount_limit_paise": limit_paise}
