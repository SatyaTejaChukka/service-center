import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token, get_current_user
)
from app.core.audit import record_audit
from app.models import User, Setting
from app.schemas import LoginRequest, Token, UserResponse, SetupWizardRequest, UserCreate, UserRegisterRequest

router = APIRouter()

@router.get("/setup-status")
def get_setup_status(db: Session = Depends(get_db)):
    """Checks whether the first-run setup wizard has already completed."""
    admin_count = db.query(User).filter(User.role == "ADMIN").count()
    return {"is_setup_complete": admin_count > 0}

@router.post("/setup", response_model=Token)
def run_setup_wizard(req: SetupWizardRequest, db: Session = Depends(get_db)):
    """First-run setup wizard: creates initial Admin account and saves business profile."""
    existing_admin = db.query(User).filter(User.role == "ADMIN").first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System has already been set up with an Admin account."
        )

    # 1. Create Admin User
    admin = User(
        username=req.admin_username.strip(),
        password_hash=get_password_hash(req.admin_password),
        full_name=req.admin_full_name.strip(),
        role="ADMIN",
        is_active=True,
        last_login_at=datetime.utcnow()
    )
    db.add(admin)
    db.flush()

    # 2. Store Business Profile in settings
    profile_data = {
        "name": req.business_name.strip(),
        "address": req.business_address.strip(),
        "phone": req.business_phone.strip(),
        "email": req.business_email.strip() if req.business_email else "",
        "gstin": req.business_gstin.strip() if req.business_gstin else "",
        "upi_id": req.business_upi_id.strip() if req.business_upi_id else "",
        "terms": "1. All disputes subject to local jurisdiction.\n2. Goods once sold will not be taken back.\n3. Payment due upon delivery.",
        "footer": "Thank you for choosing Pushpa Raj Automotive Services!"
    }
    
    setting = db.query(Setting).filter(Setting.key == "business_profile").first()
    if setting:
        setting.value_json = json.dumps(profile_data)
    else:
        setting = Setting(key="business_profile", value_json=json.dumps(profile_data))
        db.add(setting)

    record_audit(db, admin.id, "INITIAL_SETUP", "system", "1", None, {"username": admin.username})
    db.commit()
    db.refresh(admin)

    access_token = create_access_token(subject=admin.username)
    return Token(access_token=access_token, token_type="bearer", user=UserResponse.model_validate(admin))

@router.post("/login", response_model=Token)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username.strip()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    user.last_login_at = datetime.utcnow()
    db.commit()

    access_token = create_access_token(subject=user.username)
    return Token(access_token=access_token, token_type="bearer", user=UserResponse.model_validate(user))

@router.post("/register", response_model=Token)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user account with role-specific profile validation."""
    existing = db.query(User).filter(User.username == req.username.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists. Please choose a different username."
        )

    if not req.password or len(req.password.strip()) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long."
        )

    total_users = db.query(User).count()
    assigned_role = "ADMIN" if total_users == 0 else (req.role.upper() if req.role in ("ADMIN", "STAFF") else "STAFF")

    # If registering as ADMIN, enforce workshop business and authorization requirements
    if assigned_role == "ADMIN":
        if not req.business_name or not req.business_name.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Workshop/Business Name is required for Administrator registration."
            )
        if not req.business_phone or not req.business_phone.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Official Workshop Phone is required for Administrator registration."
            )

        # If an active admin already exists in the system, require master security key or existing admin password
        admin_count = db.query(User).filter(User.role == "ADMIN", User.is_active == True).count()
        if admin_count > 0:
            MASTER_KEY = "PUSHPARAJ-ADMIN"
            provided_key = (req.admin_secret_key or "").strip()
            verified = (provided_key == MASTER_KEY)
            if not verified:
                # Also check if it matches password of any active admin
                admins = db.query(User).filter(User.role == "ADMIN", User.is_active == True).all()
                for a in admins:
                    if verify_password(provided_key, a.password_hash):
                        verified = True
                        break
            if not verified:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid Admin Authorization Key. Please provide the workshop Master Key (PUSHPARAJ-ADMIN) or an active Admin's password to create an Administrator account."
                )

        # Update business profile in settings with the provided business details
        profile_data = {
            "name": req.business_name.strip(),
            "address": req.business_address.strip() if req.business_address else "",
            "phone": req.business_phone.strip(),
            "email": req.business_email.strip() if req.business_email else "",
            "gstin": req.business_gstin.strip() if req.business_gstin else "",
            "upi_id": req.business_upi_id.strip() if req.business_upi_id else "",
            "terms": "1. All disputes subject to local jurisdiction.\n2. Goods once sold will not be taken back.\n3. Payment due upon delivery.",
            "footer": f"Thank you for choosing {req.business_name.strip()}!"
        }
        setting = db.query(Setting).filter(Setting.key == "business_profile").first()
        if setting:
            setting.value_json = json.dumps(profile_data)
        else:
            setting = Setting(key="business_profile", value_json=json.dumps(profile_data))
            db.add(setting)

    new_user = User(
        username=req.username.strip(),
        password_hash=get_password_hash(req.password),
        full_name=req.full_name.strip(),
        role=assigned_role,
        is_active=True,
        last_login_at=datetime.utcnow()
    )
    db.add(new_user)
    db.flush()
    record_audit(db, new_user.id, "USER_REGISTER", "user", str(new_user.id), None, {
        "username": new_user.username,
        "role": new_user.role,
        "designation": req.designation if assigned_role == "STAFF" else "Administrator",
        "phone": req.phone or req.business_phone
    })
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(subject=new_user.username)
    return Token(access_token=access_token, token_type="bearer", user=UserResponse.model_validate(new_user))

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}
