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

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Pushpa Raj Automotive Services database...")
    init_db()
    seed_initial_catalogs()
    logger.info("Database initialized with WAL mode and catalogs verified.")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def healthcheck():
    return {"status": "ok", "app": "Pushpa Raj Automotive Services", "offline_ready": True}
