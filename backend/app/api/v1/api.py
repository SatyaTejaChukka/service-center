from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, users, customers, vehicles, job_cards,
    invoices, catalogs, search, dashboard, settings, backup, audit, reports
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(job_cards.router, prefix="/job-cards", tags=["Job Cards"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(catalogs.router, prefix="/catalogs", tags=["Catalogs"])
api_router.include_router(search.router, prefix="/search", tags=["Global Search"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(backup.router, prefix="/backup", tags=["Backup & Restore"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Log"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
