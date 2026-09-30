import json
import os
import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_initial_catalogs
from app.core.database import engine, SessionLocal
from app.models import Base, JobCard, PartItem, LabourItem, Invoice, Payment

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_catalogs()
    yield
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_catalogs()

def test_invoice_immutability_lifecycle():
    with TestClient(app) as client:
        # 1. Setup Admin
        setup_data = {
            "admin_username": "pushparaj",
            "admin_password": "securepassword123",
            "admin_full_name": "Pushpa Raj",
            "business_name": "Pushpa Raj Automotive Services",
            "business_address": "Plot 45, Auto Nagar, Vijayawada",
            "business_phone": "+91 98765 43210",
            "business_email": "service@pushparajauto.com",
            "business_gstin": "37AAAAA0000A1Z5",
            "business_upi_id": "pushparaj@upi"
        }
        res = client.post("/api/v1/auth/setup", json=setup_data)
        assert res.status_code == 200
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Create Customer & Vehicle
        res_cust = client.post("/api/v1/customers", json={
            "name": "Venkat Raman",
            "phone": "9988776655",
            "address": "Ring Road, Vijayawada"
        }, headers=headers)
        cust_id = res_cust.json()["id"]

        res_veh = client.post("/api/v1/vehicles", json={
            "customer_id": cust_id,
            "registration_number": "AP 16 AB 9999",
            "make": "Hyundai",
            "model": "Creta",
            "year": 2022
        }, headers=headers)
        veh_id = res_veh.json()["id"]

        # 3. Create Job Card
        res_jc = client.post("/api/v1/job-cards", json={
            "customer_id": cust_id,
            "vehicle_id": veh_id,
            "odometer": 35000,
            "fuel_level": "1/2",
            "customer_complaints": "Brake pad replacement and oil change",
            "supervisor_id": 1
        }, headers=headers)
        jc_id = res_jc.json()["id"]

        # 4. Add Part and Labour items
        # Part: Front Brake Pads (Qty 1, 150000 paise = 1500 rs, cost 100000 = 1000 rs, 18% GST)
        res_part = client.post(f"/api/v1/job-cards/{jc_id}/parts-items", json={
            "description": "Front Brake Pads",
            "part_number": "BP-HY-001",
            "quantity": 1,
            "unit": "set",
            "unit_price": 150000,
            "cost_price": 100000,
            "gst_rate": 18,
            "status": "APPROVED"
        }, headers=headers)
        assert res_part.status_code == 200

        # Labour: Brake Overhaul (Qty 1, 60000 paise = 600 rs, cost 20000 = 200 rs, 18% GST)
        res_labour = client.post(f"/api/v1/job-cards/{jc_id}/labour-items", json={
            "description": "Brake Overhaul Labour",
            "quantity": 1,
            "unit_price": 60000,
            "cost_price": 20000,
            "gst_rate": 18,
            "status": "APPROVED"
        }, headers=headers)
        assert res_labour.status_code == 200

        # 5. Transition JobCard to READY_FOR_BILLING & Retrieve Draft Invoice
        client.patch(f"/api/v1/job-cards/{jc_id}/status", json={"status": "IN_PROGRESS"}, headers=headers)
        client.patch(f"/api/v1/job-cards/{jc_id}/status", json={"status": "READY_FOR_BILLING"}, headers=headers)

        res_jc_detail = client.get(f"/api/v1/job-cards/{jc_id}", headers=headers)
        assert res_jc_detail.status_code == 200
        inv_id = res_jc_detail.json()["invoice"]["id"]

        # Fetch Draft Invoice Details
        res_draft = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        draft_data = res_draft.json()
        assert draft_data["status"] == "DRAFT"
        assert draft_data["is_locked"] is False
        assert draft_data["parts_total"] == 150000
        assert draft_data["labour_total"] == 60000
        orig_grand_total = draft_data["grand_total"]
        orig_tax_total = draft_data["tax_total"]
        orig_taxable_amount = draft_data["taxable_amount"]
        orig_total_cost = draft_data["total_cost"]

        # 6. Finalize Invoice -> Locks and snapshots line items and generates disk PDF
        res_fin = client.post(f"/api/v1/invoices/{inv_id}/finalize", headers=headers)
        assert res_fin.status_code == 200
        inv_number = res_fin.json()["invoice_number"]
        assert inv_number.startswith("INV-")

        # Verify finalized details
        res_fin_detail = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        fin_data = res_fin_detail.json()
        assert fin_data["status"] == "FINALIZED"
        assert fin_data["is_locked"] is True
        assert fin_data["grand_total"] == orig_grand_total
        assert fin_data["pdf_file_path"] is not None
        assert os.path.exists(fin_data["pdf_file_path"])

        # 7. MUTATE LIVE JOB CARD AND CATALOG IN DATABASE
        # Directly tamper with the underlying JobCard line items to simulate catalog/labor changes
        db = SessionLocal()
        try:
            tampered_part = db.query(PartItem).filter(PartItem.job_card_id == jc_id).first()
            if tampered_part:
                tampered_part.unit_price = 9999999 # Changed price to ₹99,999.99
                tampered_part.cost_price = 5000000
                tampered_part.quantity = 10
                tampered_part.total = 99999990
            db.commit()
        finally:
            db.close()

        # 8. VERIFY STATUTORY INVARIANCE
        # Even after underlying JobCard lines were tampered, re-fetching finalized invoice MUST return snapshot
        res_after_tamper = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        tamper_data = res_after_tamper.json()
        assert tamper_data["grand_total"] == orig_grand_total
        assert tamper_data["parts_total"] == 150000
        assert tamper_data["tax_total"] == orig_tax_total
        assert tamper_data["taxable_amount"] == orig_taxable_amount
        assert tamper_data["total_cost"] == orig_total_cost
        assert len(tamper_data["approved_parts"]) == 1
        assert tamper_data["approved_parts"][0]["unit_price"] == 150000 # Snapshot price preserved!
        assert tamper_data["approved_parts"][0]["quantity"] == 1        # Snapshot quantity preserved!

        # 9. Verify PDF Endpoint streams exact disk file
        res_pdf = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers)
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert len(res_pdf.content) > 1000

        # 10. Record Partial Payment
        pay_amount = orig_grand_total // 2
        res_pay = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
            "amount": pay_amount,
            "method": "UPI",
            "reference": "UPI/12345/TXN"
        }, headers=headers)
        assert res_pay.status_code == 200

        res_check_pay = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        assert res_check_pay.json()["amount_paid"] == pay_amount
        assert res_check_pay.json()["grand_total"] == orig_grand_total # Grand total invariant after payment!

        # 11. VOID Invoice -> Must auto-reverse payment & seal VOID PDF
        res_void = client.post(f"/api/v1/invoices/{inv_id}/void", json={
            "reason": "Customer returned vehicle and requested cancellation"
        }, headers=headers)
        assert res_void.status_code == 200

        res_void_detail = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        void_data = res_void_detail.json()
        assert void_data["status"] == "VOID"
        assert void_data["payment_status"] == "VOIDED"
        assert void_data["amount_paid"] == 0 # Auto-reversed to 0!
        assert len(void_data["payments"]) == 2
        assert void_data["payments"][1]["is_reversal"] is True
        assert void_data["payments"][1]["amount"] == pay_amount

        # 12. Verify Reports Export includes sealed numbers
        res_rep = client.get("/api/v1/reports/export/sales-register?format=csv", headers=headers)
        assert res_rep.status_code == 200
        assert res_rep.headers["content-type"] == "text/csv; charset=utf-8"
        assert len(res_rep.content) > 100

        res_audit = client.get("/api/v1/reports/export/ca-audit-pack", headers=headers)
        assert res_audit.status_code == 200
        assert res_audit.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert len(res_audit.content) > 1000
