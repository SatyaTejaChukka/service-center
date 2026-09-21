import json
from datetime import datetime
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models import AuditLog

def record_audit(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity: str,
    entity_id: str,
    before: Optional[Any] = None,
    after: Optional[Any] = None
) -> AuditLog:
    """Creates an append-only audit record."""
    entry = AuditLog(
        at=datetime.utcnow(),
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        before_json=json.dumps(before, default=str) if before is not None else None,
        after_json=json.dumps(after, default=str) if after is not None else None
    )
    db.add(entry)
    return entry
