from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.services.search_service import global_search

router = APIRouter()

@router.get("")
def search_all(
    q: str = Query(..., min_length=1),
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return global_search(db, query=q, limit_per_category=limit)
