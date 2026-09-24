import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_initial_catalogs
from app.core.database import engine
from app.models import Base

@pytest.fixture(autouse=True)
def clean_db():
    """Ensures each test starts with a fresh, clean database."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_catalogs()
    yield
    # cleanup
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_catalogs()

def test_full_workshop_lifecycle():
    with TestClient(app) as client:
        # 1. Setup Status check
        res = client.get("/api/v1/auth/setup-status")
        assert res.status_code == 200
        assert res.json()["is_setup_complete"] == False

        # 2. Run Setup Wizard
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

        # 3. Create Customer
        cust_data = {
            "name": "Rahul Kumar",
            "phone": "9876543210",
            "address": "Benz Circle, Vijayawada"
        }
        res = client.post("/api/v1/customers", json=cust_data, headers=headers)
        assert res.status_code == 200
        cust_id = res.json()["id"]

        # Test Duplicate Phone Detection (FR-CUST-004)
        res_dup = client.post("/api/v1/customers", json=cust_data, headers=headers)
        assert res_dup.status_code == 409
        assert res_dup.json()["detail"]["existing_customer_id"] == cust_id

        # 4. Create Vehicle (with spaces in reg number)
        veh_data = {
            "customer_id": cust_id,
            "registration_number": "AP 31 XX 1234",
            "make": "Hyundai",
            "model": "Creta",
            "fuel_type": "Petrol",
            "current_odometer": 45230
        }
        res = client.post("/api/v1/vehicles", json=veh_data, headers=headers)
        assert res.status_code == 200
        veh = res.json()
        veh_id = veh["id"]
        assert veh["registration_normalized"] == "AP31XX1234"

        # 5. Create Job Card
        jc_data = {
            "customer_id": cust_id,
            "vehicle_id": veh_id,
            "odometer": 45230,
            "fuel_level": "1/2",
            "complaints": ["Engine vibration", "Brake noise", "AC not cooling"]
        }
        res = client.post("/api/v1/job-cards", json=jc_data, headers=headers)
        assert res.status_code == 200
        jc = res.json()
        jc_id = jc["id"]
        assert "JC-" in jc["job_card_number"]

        # 6. Add Labour Items (General Service ₹1,000, Brake Service ₹500)
        client.post(f"/api/v1/job-cards/{jc_id}/labour-items", json={
            "description": "General Service", "quantity": 1, "unit_price": 100000, "status": "APPROVED"
        }, headers=headers)
        client.post(f"/api/v1/job-cards/{jc_id}/labour-items", json={
            "description": "Brake Service", "quantity": 1, "unit_price": 50000, "status": "APPROVED"
        }, headers=headers)

        # 7. Add Parts Items (Engine Oil ₹2,500, Oil Filter ₹500, Brake Pad ₹2,800, Air Filter ₹800)
        client.post(f"/api/v1/job-cards/{jc_id}/parts-items", json={
            "description": "Engine Oil", "quantity": 1, "unit_price": 250000, "status": "APPROVED"
        }, headers=headers)
        client.post(f"/api/v1/job-cards/{jc_id}/parts-items", json={
            "description": "Oil Filter", "quantity": 1, "unit_price": 50000, "status": "APPROVED"
        }, headers=headers)
        client.post(f"/api/v1/job-cards/{jc_id}/parts-items", json={
            "description": "Brake Pad", "quantity": 1, "unit_price": 280000, "status": "APPROVED"
        }, headers=headers)
        p_air = client.post(f"/api/v1/job-cards/{jc_id}/parts-items", json={
            "description": "Air Filter", "quantity": 1, "unit_price": 80000, "status": "RECOMMENDED"
        }, headers=headers).json()

        # 8. Record Customer Decision (Reject Air Filter)
        res_appr = client.post(f"/api/v1/job-cards/{jc_id}/approvals", json={
            "approved_by_name": "Rahul Kumar",
            "method": "PHONE",
            "note": "Customer opted out of air filter replacement",
            "line_approvals": [{"type": "part", "id": p_air["id"], "status": "REJECTED"}]
        }, headers=headers)
        assert res_appr.status_code == 200

        # 9. Check Job Card Detail and Invoice Draft
        res_jc = client.get(f"/api/v1/job-cards/{jc_id}", headers=headers)
        assert res_jc.status_code == 200
        inv = res_jc.json()["invoice"]
        inv_id = inv["id"]

        # Add other charges (Consumables ₹200) and discount (₹100)
        client.post(f"/api/v1/invoices/{inv_id}/other-charges", json={"description": "Consumables", "amount": 20000}, headers=headers)
        client.post(f"/api/v1/invoices/{inv_id}/discount", json={"discount": 10000, "reason": "Festive seasonal discount"}, headers=headers)

        res_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        inv_detail = res_inv.json()
        assert inv_detail["parts_total"] == 580000  # Air filter excluded!
        assert inv_detail["labour_total"] == 150000
        assert inv_detail["other_charges_total"] == 20000
        assert inv_detail["discount"] == 10000
        assert inv_detail["grand_total"] == 740000  # Exact ₹7,400.00!

        # 10. Finalise Invoice
        res_fin = client.post(f"/api/v1/invoices/{inv_id}/finalize", headers=headers)
        assert res_fin.status_code == 200
        inv_number = res_fin.json()["invoice_number"]
        assert "INV-" in inv_number

        # 11. Generate PDF
        res_pdf = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers)
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert len(res_pdf.content) > 1000

        # 12. Record Payment (UPI ₹7,400)
        pay_res = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
            "amount": 740000,
            "method": "UPI",
            "reference": "UPI987654321012"
        }, headers=headers)
        assert pay_res.status_code == 200

        # Verify payment status is now PAID
        res_paid_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        assert res_paid_inv.json()["payment_status"] == "PAID"
        assert res_paid_inv.json()["balance_due"] == 0

        # Verify finalized invoice locks line item modification
        res_lock = client.post(f"/api/v1/job-cards/{jc_id}/labour-items", json={
            "description": "Extra Labour", "quantity": 1, "unit_price": 50000, "status": "APPROVED"
        }, headers=headers)
        assert res_lock.status_code == 400
        assert "finalised" in res_lock.json()["detail"].lower()

        # Test Vehicle Update PUT endpoint
        res_v_up = client.put(f"/api/v1/vehicles/{veh_id}", json={
            "colour": "Polar White", "current_odometer": 45300
        }, headers=headers)
        assert res_v_up.status_code == 200
        assert res_v_up.json()["colour"] == "Polar White"
        assert res_v_up.json()["current_odometer"] == 45300

        # Test Payment Reversal endpoint
        pay_id = pay_res.json()["id"]
        rev_res = client.post(f"/api/v1/invoices/{inv_id}/payments/{pay_id}/reverse", json={"reason": "Mistaken entry"}, headers=headers)
        assert rev_res.status_code == 200
        assert rev_res.json()["is_reversal"] == True
        
        # Verify invoice payment_status is back to UNPAID
        res_rev_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        assert res_rev_inv.json()["payment_status"] == "UNPAID"
        assert res_rev_inv.json()["balance_due"] == 740000

        # Settle invoice again with Cash
        repay_res = client.post(f"/api/v1/invoices/{inv_id}/payments", json={
            "amount": 740000, "method": "CASH", "reference": "REC-001"
        }, headers=headers)
        assert repay_res.status_code == 200

        # 13. Complete Job Card
        res_status = client.post(f"/api/v1/job-cards/{jc_id}/status", json={"status": "COMPLETED"}, headers=headers)
        assert res_status.status_code == 200

        # 14. Global Search test
        res_search = client.get("/api/v1/search?q=ap31", headers=headers)
        assert res_search.status_code == 200
        search_data = res_search.json()
        assert len(search_data["vehicles"]) >= 1
        assert search_data["vehicles"][0]["registration_number"] == "AP 31 XX 1234"

        # 15. Dashboard test
        res_dash = client.get("/api/v1/dashboard/summary", headers=headers)
        assert res_dash.status_code == 200
        dash_data = res_dash.json()
        assert dash_data["tiles"]["todays_jobs"] >= 1
        assert dash_data["tiles"]["todays_revenue_paise"] == 740000

        # 16. Online Backup Test
        res_backup = client.post("/api/v1/backup/now", headers=headers)
        assert res_backup.status_code == 200
        assert res_backup.json()["status"] == "success"
        assert res_backup.json()["total_files"] >= 1
