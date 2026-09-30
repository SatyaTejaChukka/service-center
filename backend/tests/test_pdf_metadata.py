import re
import pytest
from app.core.database import SessionLocal, engine
from app.models import Base, JobCard, Invoice, Customer, Vehicle
from app.services.pdf_service import generate_invoice_pdf, generate_job_card_detailed_pdf

def test_pdf_metadata_has_vehicle_reg_not_anonymous():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        cust = Customer(name="Ramesh Kumar", phone="9876543210")
        db.add(cust)
        db.flush()

        veh = Vehicle(
            customer_id=cust.id,
            registration_number="TS09EA1234",
            registration_normalized="TS09EA1234",
            make="Hyundai",
            model="Creta"
        )
        db.add(veh)
        db.flush()

        from app.models import User
        user = User(username="admin_test", full_name="Admin", role="ADMIN", password_hash="x")
        db.add(user)
        db.flush()

        jc = JobCard(
            job_card_number="JC-2026-TEST",
            customer_id=cust.id,
            vehicle_id=veh.id,
            status="WORK_IN_PROGRESS",
            created_by=user.id
        )
        db.add(jc)
        db.flush()

        inv = Invoice(
            invoice_number="INV-2026-TEST",
            job_card_id=jc.id,
            status="DRAFT"
        )
        db.add(inv)
        db.commit()

        business_profile = {"name": "Pushpa Raj Automotive Services"}

        # 1. Test Invoice PDF
        inv_pdf_bytes = generate_invoice_pdf(inv, business_profile)
        pdf_text = inv_pdf_bytes.decode('latin1', errors='ignore')
        match = re.search(r'/Title\s*\((.*?)\)', pdf_text)
        assert match is not None, "PDF must have /Title metadata"
        title_str = match.group(1)
        assert "Anonymous" not in title_str
        assert "TS09EA1234" in title_str
        assert "INV-2026-TEST" in title_str

        # 2. Test Job Card PDF
        jc_pdf_bytes = generate_job_card_detailed_pdf(jc, business_profile)
        jc_pdf_text = jc_pdf_bytes.decode('latin1', errors='ignore')
        match_jc = re.search(r'/Title\s*\((.*?)\)', jc_pdf_text)
        assert match_jc is not None, "Job Card PDF must have /Title metadata"
        title_jc_str = match_jc.group(1)
        assert "Anonymous" not in title_jc_str
        assert "TS09EA1234" in title_jc_str
        assert "JC-2026-TEST" in title_jc_str
    finally:
        db.close()
