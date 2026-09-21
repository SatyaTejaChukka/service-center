from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin, get_password_hash
from app.core.audit import record_audit
from app.models import User
from app.schemas import UserResponse, UserCreate

router = APIRouter()

@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    return db.query(User).order_by(User.id).all()

@router.post("", response_model=UserResponse)
def create_user(
    req: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    existing = db.query(User).filter(User.username == req.username.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=req.username.strip(),
        password_hash=get_password_hash(req.password),
        full_name=req.full_name.strip(),
        role=req.role.upper(),
        is_active=True
    )
    db.add(new_user)
    db.flush()
    record_audit(db, admin.id, "USER_CREATE", "user", str(new_user.id), None, {"username": new_user.username, "role": new_user.role})
    db.commit()
    db.refresh(new_user)
    return new_user

@router.patch("/{user_id}/toggle-status", response_model=UserResponse)
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    old_status = user.is_active
    user.is_active = not user.is_active
    record_audit(db, admin.id, "USER_STATUS_CHANGE", "user", str(user.id), {"is_active": old_status}, {"is_active": user.is_active})
    db.commit()
    db.refresh(user)
    return user

@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_password = data.get("new_password")
    if not new_password:
        raise HTTPException(status_code=400, detail="New password required")

    user.password_hash = get_password_hash(new_password)
    record_audit(db, admin.id, "USER_PASSWORD_RESET", "user", str(user.id), None, None)
    db.commit()
    return {"message": "Password reset successfully"}
