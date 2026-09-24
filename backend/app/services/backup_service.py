import os
import shutil
import sqlite3
import hashlib
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

from app.core.config import settings

def calculate_sha256(filepath: Path) -> str:
    """Computes SHA-256 checksum of a file."""
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def create_online_backup(destination_folder: Optional[str] = None) -> Dict[str, Any]:
    """
    Creates a consistent transactional snapshot of the database using SQLite online backup API
    along with documents and a verified manifest.
    """
    now = datetime.utcnow()
    timestamp_str = now.strftime("%Y-%m-%d_%H%M%S")
    folder_name = f"backup_{timestamp_str}"
    
    if destination_folder:
        base_dest = Path(destination_folder)
    else:
        base_dest = settings.backups_dir
    
    base_dest.mkdir(parents=True, exist_ok=True)
    target_dir = base_dest / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    # 1. SQLite Online Backup (Consistent snapshot)
    source_db_path = settings.db_path
    backup_db_path = target_dir / "automotive.db"

    if source_db_path.exists():
        src_conn = sqlite3.connect(source_db_path.as_posix())
        dst_conn = sqlite3.connect(backup_db_path.as_posix())
        with dst_conn:
            src_conn.backup(dst_conn, pages=100)
        dst_conn.close()
        src_conn.close()

        # Verify integrity of backup copy
        verify_conn = sqlite3.connect(backup_db_path.as_posix())
        res = verify_conn.execute("PRAGMA integrity_check;").fetchone()
        verify_conn.close()
        if not res or res[0] != "ok":
            raise RuntimeError(f"Backup SQLite integrity check failed: {res}")
    else:
        # Create empty db placeholder if db not yet created
        backup_db_path.touch()

    # 2. Copy documents
    for sub in ["invoices", "job_cards", "vehicle_photos", "attachments"]:
        src_sub = settings.documents_dir / sub
        dst_sub = target_dir / sub
        if src_sub.exists():
            shutil.copytree(src_sub, dst_sub, dirs_exist_ok=True)
        else:
            dst_sub.mkdir(parents=True, exist_ok=True)

    # 3. Create Manifest with checksums
    checksums = {}
    file_count = 0
    total_size = 0

    for root, _, files in os.walk(target_dir):
        for f in files:
            fp = Path(root) / f
            rel_path = fp.relative_to(target_dir).as_posix()
            cs = calculate_sha256(fp)
            size = fp.stat().st_size
            checksums[rel_path] = {
                "sha256": cs,
                "size_bytes": size
            }
            file_count += 1
            total_size += size

    manifest = {
        "app_name": "Pushpa Raj Automotive Services",
        "app_version": "1.0.0",
        "schema_version": "1.0",
        "created_at": now.isoformat(),
        "total_files": file_count,
        "total_size_bytes": total_size,
        "checksums": checksums
    }

    manifest_path = target_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return {
        "status": "success",
        "backup_path": str(target_dir),
        "folder_name": folder_name,
        "total_files": file_count,
        "total_size_bytes": total_size,
        "created_at": now.isoformat()
    }


from sqlalchemy import text
from app.core.database import engine, verify_db_integrity

def restore_backup(backup_folder_path: str) -> Dict[str, Any]:
    """
    Restores data from a backup snapshot safely on Windows.
    Flushes WAL, disposes engine connection pool, cleans stale journals, overwrites DB, and verifies integrity.
    """
    b_path = Path(backup_folder_path)
    manifest_path = b_path / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError("Invalid backup folder: manifest.json not found")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Verify backup checksums before restoring
    for rel_path, meta in manifest.get("checksums", {}).items():
        fp = b_path / rel_path
        if not fp.exists():
            raise FileNotFoundError(f"Corrupted backup: missing file {rel_path}")
        cur_hash = calculate_sha256(fp)
        if cur_hash != meta["sha256"]:
            raise ValueError(f"Corrupted backup: checksum mismatch for {rel_path}")

    # 1. Take safety backup of current state
    now = datetime.utcnow()
    safety_dir = settings.backups_dir / f"safety_pre_restore_{now.strftime('%Y-%m-%d_%H%M%S')}"
    safety_dir.mkdir(parents=True, exist_ok=True)
    if settings.db_path.exists():
        # Checkpoint WAL first to flush any uncommitted transactions into .db
        try:
            with engine.connect() as conn:
                conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE);"))
        except Exception:
            pass
        shutil.copy2(settings.db_path, safety_dir / "automotive.db")

    # 2. Safely close all engine connection pool handles so Windows unlocks the file
    try:
        engine.dispose()
    except Exception:
        pass

    # 3. Clean up stale WAL / SHM files if present on disk
    wal_file = settings.db_path.with_name(f"{settings.db_path.name}-wal")
    shm_file = settings.db_path.with_name(f"{settings.db_path.name}-shm")
    if wal_file.exists():
        try:
            wal_file.unlink()
        except Exception:
            pass
    if shm_file.exists():
        try:
            shm_file.unlink()
        except Exception:
            pass

    # 4. Overwrite database with verified backup file
    b_db = b_path / "automotive.db"
    if b_db.exists():
        shutil.copy2(b_db, settings.db_path)

    # 5. Restore documents
    for sub in ["invoices", "job_cards", "vehicle_photos", "attachments"]:
        src_sub = b_path / sub
        dst_sub = settings.documents_dir / sub
        if src_sub.exists():
            shutil.copytree(src_sub, dst_sub, dirs_exist_ok=True)

    # 6. Verify integrity of newly restored database
    verify_db_integrity()

    return {
        "status": "success",
        "restored_from": str(b_path),
        "safety_backup": str(safety_dir),
        "timestamp": now.isoformat()
    }
