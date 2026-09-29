import io
import pytest
from openpyxl import load_workbook
from fastapi.testclient import TestClient
from app.main import app, seed_initial_catalogs
from app.core.database import engine
from app.models import Base

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_catalogs()
    yield
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_initial_catalogs()

def test_ca_features_end_to_end():
    with TestClient(app) as client:
        # 1. Setup Wizard with Workshop GSTIN (Andhra Pradesh: 37)
        setup_data = {
            "admin_username": "ca_test_admin",
            "admin_password": "securepassword123",
            "admin_full_name": "Test Admin",
            "business_name": "Elite Auto Care Services",
            "business_address": "Auto Hub, Vijayawada",
            "business_phone": "+91 98765 00000",
            "business_email": "audit@eliteauto.com",
            "business_gstin": "37AAAAA0000A1Z5",
            "business_upi_id": "eliteauto@upi"
        }
        res = client.post("/api/v1/auth/setup", json=setup_data)
        assert res.status_code == 200
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Add Catalog Items with Cost & HSN/SAC
        part_cat = {
            "name": "Synthetic Engine Oil 5W40",
            "part_number": "ENG-OIL-5W40",
            "unit": "ltr",
            "default_price": 75000, # ₹750 selling
            "cost_price": 50000,    # ₹500 purchase
            "hsn_code": "2710",
            "gst_rate": 18.0
        }
        res = client.post("/api/v1/catalogs/parts", json=part_cat, headers=headers)
        assert res.status_code == 200
        assert res.json()["cost_price"] == 50000
        assert res.json()["hsn_code"] == "2710"

        labour_cat = {
            "name": "General Service & Diagnostic Inspection",
            "default_rate": 120000, # ₹1200 selling
            "cost_price": 30000,    # ₹300 mechanic cost
            "sac_code": "998729",
            "gst_rate": 18.0
        }
        res = client.post("/api/v1/catalogs/labour", json=labour_cat, headers=headers)
        assert res.status_code == 200
        assert res.json()["cost_price"] == 30000
        assert res.json()["sac_code"] == "998729"

        # 3. Create B2B Customer with GSTIN (Same state 37 -> CGST + SGST)
        cust_data = {
            "name": "TransLogistics India Pvt Ltd",
            "phone": "9988776655",
            "gstin": "37BBBPS1234F1Z8",
            "address": "Port Area, Visakhapatnam"
        }
        res = client.post("/api/v1/customers", json=cust_data, headers=headers)
        assert res.status_code == 200
        cust_id = res.json()["id"]
        assert res.json()["gstin"] == "37BBBPS1234F1Z8"

        # 4. Create Vehicle & Job Card
        veh_data = {
            "customer_id": cust_id,
            "registration_number": "AP 16 TX 9999",
            "make": "Tata",
            "model": "Ace Gold",
            "current_odometer": 45000
        }
        res = client.post("/api/v1/vehicles", json=veh_data, headers=headers)
        assert res.status_code == 200
        veh_id = res.json()["id"]

        jc_data = {
            "customer_id": cust_id,
            "vehicle_id": veh_id,
            "odometer": 45000,
            "complaints": ["Periodic general maintenance", "Engine oil change"]
        }
        res = client.post("/api/v1/job-cards", json=jc_data, headers=headers)
        assert res.status_code == 200
        jc_id = res.json()["id"]

        # Add part item with purchase cost
        part_item = {
            "description": "Synthetic Engine Oil 5W40",
            "part_number": "ENG-OIL-5W40",
            "unit": "ltr",
            "quantity": 3.0,
            "unit_price": 75000, # ₹750/ltr = ₹2250 total
            "cost_price": 50000, # ₹500/ltr = ₹1500 total cost
            "purchase_cost": 50000,
            "hsn_code": "2710",
            "gst_rate": 18.0
        }
        res = client.post(f"/api/v1/job-cards/{jc_id}/parts-items", json=part_item, headers=headers)
        assert res.status_code == 200
        part_id = res.json()["id"]

        # Add labour item with mechanic cost
        labour_item = {
            "description": "General Service & Diagnostic Inspection",
            "quantity": 1.0,
            "unit_price": 120000, # ₹1200
            "cost_price": 30000,  # ₹300 cost
            "sac_code": "998729",
            "gst_rate": 18.0
        }
        res = client.post(f"/api/v1/job-cards/{jc_id}/labour-items", json=labour_item, headers=headers)
        assert res.status_code == 200
        labour_id = res.json()["id"]

        # Approve items
        appr_payload = {
            "approved_by_name": "Fleet Manager",
            "method": "PHONE",
            "line_approvals": [
                {"type": "part", "id": part_id, "status": "APPROVED"},
                {"type": "labour", "id": labour_id, "status": "APPROVED"}
            ]
        }
        res = client.post(f"/api/v1/job-cards/{jc_id}/approvals", json=appr_payload, headers=headers)
        assert res.status_code == 200

        # Fetch Job Card to get draft invoice ID
        res_jc = client.get(f"/api/v1/job-cards/{jc_id}", headers=headers)
        assert res_jc.status_code == 200
        inv_id = res_jc.json()["invoice"]["id"]

        # Finalize Invoice
        res_fin = client.post(f"/api/v1/invoices/{inv_id}/finalize", headers=headers)
        assert res_fin.status_code == 200

        # Complete Job Card
        res = client.post(f"/api/v1/job-cards/{jc_id}/status", json={"status": "COMPLETED"}, headers=headers)
        assert res.status_code == 200

        # Fetch Finalized Invoice details
        res_inv = client.get(f"/api/v1/invoices/{inv_id}", headers=headers)
        assert res_inv.status_code == 200
        inv_data = res_inv.json()

        # Verify Calculations:
        # Parts Total = 3 * 75000 = 225000 paise (₹2250)
        # Labour Total = 1 * 120000 = 120000 paise (₹1200)
        # Taxable Amount = 345000 paise (₹3450)
        # 18% GST = 62100 paise (₹621) -> CGST 9% (31050), SGST 9% (31050)
        # Grand Total = 407100 paise (₹4071)
        # Total Cost = (3 * 50000) + (1 * 30000) = 180000 paise (₹1800)
        # Gross Profit = 407100 - 180000 = 227100 paise (₹2271)
        assert inv_data["parts_total"] == 225000
        assert inv_data["labour_total"] == 120000
        assert inv_data["taxable_amount"] == 345000
        assert inv_data["cgst_amount"] == 31050
        assert inv_data["sgst_amount"] == 31050
        assert inv_data["igst_amount"] == 0
        assert inv_data["tax_total"] == 62100
        assert inv_data["grand_total"] == 407100
        assert inv_data["total_cost"] == 180000
        assert inv_data["gross_profit"] == 165000 # Taxable sales (345000) - Total cost (180000)

        # Record full payment
        pay_payload = {
            "amount": 407100,
            "method": "BANK_TRANSFER",
            "reference": "NEFT12345678"
        }
        res = client.post(f"/api/v1/invoices/{inv_id}/payments", json=pay_payload, headers=headers)
        assert res.status_code == 200

        # 5. Check Reports Revenue Overview
        res = client.get("/api/v1/reports/revenue-overview", headers=headers)
        assert res.status_code == 200
        rep = res.json()
        summary = rep["summary"]
        assert summary["total_revenue_paise"] == 407100
        assert summary["profit_summary"]["total_cost_paise"] == 180000
        assert summary["profit_summary"]["gross_profit_paise"] == 165000
        assert summary["profit_summary"]["overall_margin_percent"] > 35.0
        assert summary["gst_summary"]["taxable_paise"] == 345000
        assert summary["gst_summary"]["cgst_paise"] == 31050
        assert summary["gst_summary"]["sgst_paise"] == 31050
        assert summary["gst_summary"]["igst_paise"] == 0

        # 6. Test CSV Export Endpoints
        res_csv_sales = client.get("/api/v1/reports/export/sales-register?format=csv", headers=headers)
        assert res_csv_sales.status_code == 200
        assert "text/csv" in res_csv_sales.headers["content-type"]
        csv_text = res_csv_sales.text
        assert "SALES REGISTER" in csv_text
        assert "37BBBPS1234F1Z8" in csv_text
        assert "4071.0" in csv_text or "4071.00" in csv_text

        res_csv_day = client.get("/api/v1/reports/export/day-book?format=csv", headers=headers)
        assert res_csv_day.status_code == 200
        assert "DAY BOOK & RECEIPTS REGISTER" in res_csv_day.text
        assert "NEFT12345678" in res_csv_day.text

        # 7. Test Excel (XLSX) Export Endpoints
        res_xlsx_sales = client.get("/api/v1/reports/export/sales-register?format=xlsx", headers=headers)
        assert res_xlsx_sales.status_code == 200
        wb_sales = load_workbook(io.BytesIO(res_xlsx_sales.content))
        assert "Sales Register" in wb_sales.sheetnames

        res_xlsx_day = client.get("/api/v1/reports/export/day-book?format=xlsx", headers=headers)
        assert res_xlsx_day.status_code == 200
        wb_day = load_workbook(io.BytesIO(res_xlsx_day.content))
        assert "Day Book Receipts" in wb_day.sheetnames

        # 8. Test CA Audit Pack (Multi-sheet)
        res_ca_pack = client.get("/api/v1/reports/export/ca-audit-pack", headers=headers)
        assert res_ca_pack.status_code == 200
        wb_pack = load_workbook(io.BytesIO(res_ca_pack.content))
        expected_sheets = ["Sales Register", "Day Book Receipts", "GSTR-1 Tax Summary", "Profitability & Margins"]
        for sheet in expected_sheets:
            assert sheet in wb_pack.sheetnames

        # 9. Test PDF Generation (Contains GSTIN, HSN, SAC, CGST/SGST)
        res_pdf = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers)
        assert res_pdf.status_code == 200
        assert "application/pdf" in res_pdf.headers["content-type"]
        assert len(res_pdf.content) > 1000
