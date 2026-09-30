import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.models import LabourCatalog, PartsCatalog
from app.api.v1.api import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pushparaj.backend")

def seed_initial_catalogs():
    """Seeds default common workshop services and parts if catalogs are empty."""
    db = SessionLocal()
    try:
        if db.query(LabourCatalog).count() == 0:
            defaults = [
                ("General Service", 100000),      # ₹1,000.00
                ("Brake Service", 50000),         # ₹500.00
                ("Oil & Filter Replacement", 35000), # ₹350.00
                ("AC Gas Refill & Servicing", 150000),# ₹1,500.00
                ("Wheel Balancing & Alignment", 80000),# ₹800.00
                ("Clutch Overhaul Labour", 350000),# ₹3,500.00
                ("Suspension Inspection & Repair", 120000),# ₹1,200.00
                ("Car Wash & Interior Detailing", 75000),# ₹750.00
            ]
            for name, rate in defaults:
                db.add(LabourCatalog(name=name, default_rate=rate, is_active=True))

        if db.query(PartsCatalog).count() == 0:
            parts = [
                ("Engine Oil (Synthetic 5W-30)", "EO-SYN-5W30", "litre", 65000), # ₹650/litre
                ("Engine Oil (Standard 15W-40)", "EO-STD-15W40", "litre", 45000), # ₹450/litre
                ("Oil Filter", "OF-GEN-01", "pcs", 50000),     # ₹500.00
                ("Brake Pad Set (Front)", "BP-FR-02", "set", 280000), # ₹2,800.00
                ("Air Filter", "AF-GEN-03", "pcs", 80000),      # ₹800.00
                ("Coolant (Green)", "CL-GRN-01", "litre", 35000), # ₹350.00
                ("Brake Fluid DOT-4", "BF-DOT4", "pcs", 30000),  # ₹300.00
                ("Spark Plug", "SP-NGK-01", "pcs", 25000),      # ₹250.00
                ("Wiper Blade Set", "WB-AERO-24", "set", 70000),# ₹700.00
            ]
            for name, part_no, unit, price in parts:
                db.add(PartsCatalog(name=name, part_number=part_no, unit=unit, default_price=price, is_active=True))

        db.commit()
    except Exception as e:
        logger.error(f"Catalog seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

from typing import Optional
import threading

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Pushpa Raj Automotive Services database...")
    init_db()
    seed_initial_catalogs()
    logger.info("Database initialized with WAL mode and catalogs verified.")

    # Trigger non-blocking automated daily backup snapshot in background
    def _run_bg_backup():
        try:
            from app.services.backup_service import run_automated_daily_backup
            res = run_automated_daily_backup(retention_count=7)
            if res:
                logger.info(f"Automated daily safety backup completed: {res.get('folder_name')}")
        except Exception as e:
            logger.error(f"Automated background backup notice: {e}")

    threading.Thread(target=_run_bg_backup, daemon=True).start()

    yield
    # Graceful shutdown handler: Flush SQLite WAL checkpoint before process termination
    try:
        from sqlalchemy import text
        logger.info("Executing SQLite WAL Checkpoint (TRUNCATE) before shutdown...")
        db = SessionLocal()
        db.execute(text("PRAGMA wal_checkpoint(TRUNCATE);"))
        db.commit()
        db.close()
        logger.info("SQLite WAL Checkpoint completed successfully.")
    except Exception as e:
        logger.error(f"WAL Checkpoint error on shutdown: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def home():
    return {"message": "Welcome to the Service Center Management API"}

@app.get("/health")
def healthcheck():
    return {"status": "ok", "app": "Service Center Management System", "offline_ready": True}

from fastapi import Header, HTTPException, status, Depends
from app.core.database import get_db, engine
from sqlalchemy.orm import Session
from sqlalchemy import text

@app.post(f"{settings.API_V1_STR}/system/shutdown")
def shutdown_system(
    x_system_shutdown_token: Optional[str] = Header(None, alias="X-System-Shutdown-Token"),
    db: Session = Depends(get_db)
):
    """Allows desktop host process to signal clean server termination with authentication and WAL flush."""
    # Verify authorization if SHUTDOWN_TOKEN is configured
    if settings.SHUTDOWN_TOKEN:
        if not x_system_shutdown_token or x_system_shutdown_token != settings.SHUTDOWN_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized: Invalid system shutdown token"
            )

    # Cleanly flush WAL checkpoint right now
    try:
        logger.info("Flushing SQLite WAL checkpoint prior to host shutdown...")
        db.execute(text("PRAGMA wal_checkpoint(TRUNCATE);"))
        db.commit()
    except Exception as e:
        logger.error(f"Error flushing WAL on shutdown: {e}")

    import os, time
    def _delayed_exit():
        time.sleep(0.3)
        try:
            engine.dispose()
        except Exception:
            pass
        os._exit(0)

    threading.Thread(target=_delayed_exit, daemon=True).start()
    return {"message": "Server shutting down cleanly and WAL checkpoint committed"}

