import os
import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import require_admin
from app.core.audit import record_audit
from app.models import User
from app.services.backup_service import create_online_backup, restore_backup

router = APIRouter()

@router.get("/status")
def get_backup_status(
    admin: User = Depends(require_admin)
):
    """Returns the list of backups, the latest backup timestamp, and age warning."""
    backups_dir = settings.backups_dir
    backups = []

    if backups_dir.exists():
        for item in sorted(backups_dir.iterdir(), reverse=True):
            if item.is_dir() and item.name.startswith("backup_"):
                manifest_file = item / "manifest.json"
                manifest_data = {}
                if manifest_file.exists():
                    try:
                        with open(manifest_file, "r", encoding="utf-8") as f:
                            manifest_data = json.load(f)
                    except Exception:
                        pass

                backups.append({
                    "folder_name": item.name,
                    "full_path": str(item),
                    "created_at": manifest_data.get("created_at", item.stat().st_ctime),
                    "total_files": manifest_data.get("total_files", 0),
                    "total_size_bytes": manifest_data.get("total_size_bytes", 0)
                })

    last_backup_time = backups[0]["created_at"] if backups else None
    warning_needed = False

    if last_backup_time:
        try:
            last_dt = datetime.fromisoformat(last_backup_time)
            days_since = (datetime.utcnow() - last_dt).days
            if days_since >= 3:
                warning_needed = True
        except Exception:
            pass
    else:
        warning_needed = True

    return {
        "backups_directory": str(backups_dir),
        "backups": backups,
        "latest_backup": backups[0] if backups else None,
        "warning_needed": warning_needed,
        "warning_message": "Warning: No backup has been performed in the last 3 days!" if warning_needed else None
    }

@router.post("/now")
def trigger_backup_now(
    data: dict = {},
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    dest = data.get("destination_folder")
    try:
        res = create_online_backup(destination_folder=dest)
        record_audit(db, admin.id, "BACKUP_CREATE", "backup", res["folder_name"], None, res)
        db.commit()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@router.post("/restore")
def trigger_restore(
    data: dict,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    folder_path = data.get("backup_folder_path")
    if not folder_path:
        raise HTTPException(status_code=400, detail="backup_folder_path is required")

    try:
        res = restore_backup(folder_path)
        record_audit(db, admin.id, "BACKUP_RESTORE", "backup", folder_path, None, res)
        db.commit()
        return {
            "message": "Database and files successfully restored. Please re-login.",
            "details": res
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
