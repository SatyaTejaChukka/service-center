import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.backup_service import restore_backup, run_automated_daily_backup

def test_shutdown_endpoint_rejects_unauthorized():
    with TestClient(app) as client:
        # Simulate configured shutdown token
        original_token = settings.SHUTDOWN_TOKEN
        settings.SHUTDOWN_TOKEN = "test-secret-token-12345"
        try:
            # 1. No token -> 403 Forbidden
            res = client.post("/api/v1/system/shutdown")
            assert res.status_code == 403

            # 2. Wrong token -> 403 Forbidden
            res = client.post("/api/v1/system/shutdown", headers={"X-System-Shutdown-Token": "wrong-token"})
            assert res.status_code == 403
        finally:
            settings.SHUTDOWN_TOKEN = original_token

def test_admin_backdoor_eliminated(db_session=None):
    from app.core.database import SessionLocal
    from app.models import User
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        # Ensure at least one admin exists
        admin = db.query(User).filter(User.role == "ADMIN", User.is_active == True).first()
        if not admin:
            admin = User(username="admin_sec", full_name="Admin Sec", role="ADMIN", password_hash=get_password_hash("AdminPass123!"), is_active=True)
            db.add(admin)
            db.commit()

        with TestClient(app) as client:
            # Attempt to register second admin using old master key backdoor
            res = client.post("/api/v1/auth/register", json={
                "username": "rogue_admin",
                "password": "Password123!",
                "full_name": "Rogue Admin",
                "role": "ADMIN",
                "business_name": "Pushpa Raj Workshop",
                "business_phone": "9876543210",
                "admin_secret_key": "PUSHPARAJ-ADMIN"
            })
            assert res.status_code == 403
            assert "Invalid Admin Authorization" in res.json()["detail"]
            assert "PUSHPARAJ-ADMIN" not in res.json()["detail"]
    finally:
        db.close()

def test_restore_backup_rejects_path_traversal(tmp_path):
    # Create fake backup folder with path traversal manifest
    fake_backup = tmp_path / "fake_backup"
    fake_backup.mkdir()
    manifest_path = fake_backup / "manifest.json"
    manifest_path.write_text('{"checksums": {"../../escaped.txt": {"sha256": "fake", "size_bytes": 10}}}', encoding="utf-8")

    with pytest.raises(ValueError, match="Dangerous path sequence detected"):
        restore_backup(str(fake_backup))

def test_automated_daily_backup_runs():
    res = run_automated_daily_backup(retention_count=3)
    # May return None if run recently, or return dict with status success
    if res is not None:
        assert res["status"] == "success"
        assert "folder_name" in res
