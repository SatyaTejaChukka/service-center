from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models import AuditLog, User

router = APIRouter()

@router.get("")
def get_audit_logs(
    entity: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    query = db.query(AuditLog)
    if entity:
        query = query.filter(AuditLog.entity == entity)
    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.at.desc()).offset(skip).limit(limit).all()
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "at": l.at.strftime("%d/%m/%Y %I:%M:%S %p"),
            "user": l.user.full_name if l.user else "System",
            "action": l.action,
            "entity": l.entity,
            "entity_id": l.entity_id,
            "before_json": l.before_json,
            "after_json": l.after_json
        })
    return results
