import pytest
from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings
from app.core.security import create_access_token

def test_token_expiration_is_permanent_desktop_lifetime():
    """Verify ACCESS_TOKEN_EXPIRE_MINUTES is set to effectively permanent (50 years)."""
    assert settings.ACCESS_TOKEN_EXPIRE_MINUTES >= 60 * 24 * 365 * 10
    
    token = create_access_token(subject="workshop_admin")
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    
    assert payload["sub"] == "workshop_admin"
    exp = payload.get("exp")
    assert exp is not None
    
    # Calculate years from now
    now_ts = datetime.utcnow().timestamp()
    diff_years = (exp - now_ts) / (3600 * 24 * 365)
    assert diff_years >= 40, f"Token expiry should be ~50 years in the future, got {diff_years:.1f} years"
