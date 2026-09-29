import io
import csv
from datetime import datetime
from typing import List, Dict, Any
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def format_paise_to_rupees(paise: int) -> float:
    """Converts integer paise to float rupees formatted to 2 decimals."""
    return round((paise or 0) / 100.0, 2)

# ==============================================================================
# CSV EXPORTERS
# ==============================================================================

def generate_sales_register_csv(invoices: List[Dict[str, Any]], workshop_profile: Dict[str, Any]) -> str:
    """Generates standard CSV Sales Register for import into Tally, Zoho, Excel."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Title Metadata
    w_name = workshop_profile.get("name", "Workshop Management System")
    w_gstin = workshop_profile.get("gstin", "")
    writer.writerow([f"{w_name} - SALES REGISTER (CA AUDIT)"])
    writer.writerow([f"Generated On: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}", f"Workshop GSTIN: {w_gstin or 'Unregistered'}"])
    writer.writerow([]) # Empty row

    # Header Columns
    headers = [
        "Invoice Number",
        "Invoice Date",
        "Customer Name",
        "Customer Phone",
        "Customer GSTIN",
        "Vehicle Reg",
        "Vehicle Model",
        "Parts Total (₹)",
        "Labour Total (₹)",
        "Other Charges (₹)",
        "Discount (₹)",
        "Taxable Value (₹)",
        "CGST (₹)",
        "SGST (₹)",
        "IGST (₹)",
        "Total Tax (₹)",
        "Invoice Grand Total (₹)",
        "Amount Paid (₹)",
        "Balance Due (₹)",
        "Payment Status",
        "Est. Total Cost (₹)",
        "Est. Gross Profit (₹)"
    ]
    writer.writerow(headers)

    # Data Rows
    for inv in invoices:
        writer.writerow([
            inv.get("invoice_number", ""),
            inv.get("finalized_at", ""),
            inv.get("customer_name", ""),
            inv.get("customer_phone", ""),
            inv.get("customer_gstin", "") or "B2C Consumer",
            inv.get("vehicle_reg", ""),
            inv.get("vehicle_model", ""),
            format_paise_to_rupees(inv.get("parts_total", 0)),
            format_paise_to_rupees(inv.get("labour_total", 0)),
            format_paise_to_rupees(inv.get("other_charges_total", 0)),
            format_paise_to_rupees(inv.get("discount", 0)),
            format_paise_to_rupees(inv.get("taxable_amount", 0) or (inv.get("grand_total", 0) - inv.get("tax_total", 0))),
            format_paise_to_rupees(inv.get("cgst_amount", 0)),
            format_paise_to_rupees(inv.get("sgst_amount", 0)),
            format_paise_to_rupees(inv.get("igst_amount", 0)),
            format_paise_to_rupees(inv.get("tax_total", 0)),
            format_paise_to_rupees(inv.get("grand_total", 0)),
            format_paise_to_rupees(inv.get("amount_paid", 0)),
            format_paise_to_rupees(inv.get("balance_due", 0)),
            inv.get("payment_status", "UNPAID"),
            format_paise_to_rupees(inv.get("total_cost", 0)),
            format_paise_to_rupees(inv.get("gross_profit", 0))
        ])

    return output.getvalue()


def generate_day_book_csv(payments: List[Dict[str, Any]], workshop_profile: Dict[str, Any]) -> str:
    """Generates standard CSV Day Book / Cash & Bank Receipts Register."""
    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    w_name = workshop_profile.get("name", "Workshop Management System")
    writer.writerow([f"{w_name} - DAY BOOK & RECEIPTS REGISTER"])
    writer.writerow([f"Generated On: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}"])
    writer.writerow([])

    headers = [
        "Receipt Date",
        "Payment Time",
        "Payment ID",
        "Invoice Number",
        "Customer Name",
        "Payment Method",
        "Reference / UTR",
        "Amount (₹)",
        "Transaction Type",
        "Notes"
    ]
    writer.writerow(headers)

    for p in payments:
        amt = -format_paise_to_rupees(p.get("amount", 0)) if p.get("is_reversal") else format_paise_to_rupees(p.get("amount", 0))
        writer.writerow([
            p.get("paid_date", ""),
            p.get("time_str", ""),
            f"PAY-{p.get('id', '')}",
            p.get("invoice_number", ""),
            p.get("customer_name", ""),
            p.get("method", "CASH"),
            p.get("reference", ""),
            amt,
            "REVERSAL" if p.get("is_reversal") else "RECEIPT",
            p.get("note", "")
        ])

    return output.getvalue()


# ==============================================================================
# MULTI-SHEET EXCEL (XLSX) AUDIT PACK
# ==============================================================================

def generate_ca_audit_pack_xlsx(
    invoices: List[Dict[str, Any]],
    payments: List[Dict[str, Any]],
    workshop_profile: Dict[str, Any]
) -> bytes:
    """
    Creates a styled multi-tab Excel workbook:
    - Tab 1: Sales Register (GST details, Invoice totals, Due balance)
    - Tab 2: Day Book & Receipts (Cash/Bank collection ledger)
    - Tab 3: GSTR-1 & Tax Summary (B2B vs B2C taxable, CGST, SGST, IGST)
    - Tab 4: Profitability & Margins (Costs, Gross Profit, Margin %)
    """
    wb = Workbook()

    # Styling presets
    header_fill = PatternFill(start_color="1E4074", end_color="1E4074", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=10, bold=True)
    regular_font = Font(name="Calibri", size=10)
    title_font = Font(name="Calibri", size=14, bold=True, color="1E4074")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="555555")
    thin_border = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0")
    )
    total_border = Border(
        top=Side(style="thin", color="000000"),
        bottom=Side(style="double", color="000000")
    )

    w_name = workshop_profile.get("name", "Workshop Management System")
    w_gstin = workshop_profile.get("gstin", "")

    # --------------------------------------------------------------------------
    # TAB 1: SALES REGISTER
    # --------------------------------------------------------------------------
    ws_sales = wb.active
    ws_sales.title = "Sales Register"

    ws_sales.append([f"{w_name.upper()} - SALES REGISTER (CA AUDIT)"])
    ws_sales["A1"].font = title_font
    ws_sales.append([f"GSTIN: {w_gstin or 'Unregistered / Composition'} | Generated: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}"])
    ws_sales["A2"].font = subtitle_font
    ws_sales.append([]) # Blank

    sales_headers = [
        "Invoice #", "Date", "Customer Name", "Customer Phone", "Customer GSTIN",
        "Vehicle Reg", "Vehicle Model", "Parts (₹)", "Labour (₹)", "Other (₹)",
        "Discount (₹)", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)",
        "Total Tax (₹)", "Grand Total (₹)", "Paid (₹)", "Balance Due (₹)", "Status"
    ]
    ws_sales.append(sales_headers)
    header_row_idx = 4

    for col_idx in range(1, len(sales_headers) + 1):
        cell = ws_sales.cell(row=header_row_idx, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    tot_taxable = 0
    tot_cgst = 0
    tot_sgst = 0
    tot_igst = 0
    tot_tax = 0
    tot_grand = 0
    tot_paid = 0
    tot_due = 0

    current_row = 5
    for inv in invoices:
        taxable = format_paise_to_rupees(inv.get("taxable_amount", 0) or (inv.get("grand_total", 0) - inv.get("tax_total", 0)))
        cgst = format_paise_to_rupees(inv.get("cgst_amount", 0))
        sgst = format_paise_to_rupees(inv.get("sgst_amount", 0))
        igst = format_paise_to_rupees(inv.get("igst_amount", 0))
        tax = format_paise_to_rupees(inv.get("tax_total", 0))
        grand = format_paise_to_rupees(inv.get("grand_total", 0))
        paid = format_paise_to_rupees(inv.get("amount_paid", 0))
        due = format_paise_to_rupees(inv.get("balance_due", 0))

        tot_taxable += taxable
        tot_cgst += cgst
        tot_sgst += sgst
        tot_igst += igst
        tot_tax += tax
        tot_grand += grand
        tot_paid += paid
        tot_due += due

        row_vals = [
            inv.get("invoice_number", ""),
            inv.get("finalized_at", ""),
            inv.get("customer_name", ""),
            inv.get("customer_phone", ""),
            inv.get("customer_gstin", "") or "B2C Consumer",
            inv.get("vehicle_reg", ""),
            inv.get("vehicle_model", ""),
            format_paise_to_rupees(inv.get("parts_total", 0)),
            format_paise_to_rupees(inv.get("labour_total", 0)),
            format_paise_to_rupees(inv.get("other_charges_total", 0)),
            format_paise_to_rupees(inv.get("discount", 0)),
            taxable,
            cgst,
            sgst,
            igst,
            tax,
            grand,
            paid,
            due,
            inv.get("payment_status", "")
        ]
        ws_sales.append(row_vals)
        for col_idx in range(1, len(row_vals) + 1):
            c = ws_sales.cell(row=current_row, column=col_idx)
            c.font = regular_font
            c.border = thin_border
            if col_idx in (8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19):
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
        current_row += 1

    # Totals Row
    ws_sales.append([
        "TOTAL", "", "", "", "", "", "", "", "", "", "",
        round(tot_taxable, 2),
        round(tot_cgst, 2),
        round(tot_sgst, 2),
        round(tot_igst, 2),
        round(tot_tax, 2),
        round(tot_grand, 2),
        round(tot_paid, 2),
        round(tot_due, 2),
        f"{len(invoices)} INVOICES"
    ])
    for col_idx in range(1, len(sales_headers) + 1):
        c = ws_sales.cell(row=current_row, column=col_idx)
        c.font = bold_font
        c.border = total_border
        if col_idx in (12, 13, 14, 15, 16, 17, 18, 19):
            c.number_format = "#,##0.00"
            c.alignment = Alignment(horizontal="right")

    # --------------------------------------------------------------------------
    # TAB 2: DAY BOOK & RECEIPTS
    # --------------------------------------------------------------------------
    ws_day = wb.create_sheet(title="Day Book Receipts")
    ws_day.append([f"{w_name.upper()} - DAY BOOK / CASH & BANK REGISTER"])
    ws_day["A1"].font = title_font
    ws_day.append([f"Generated: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}"])
    ws_day["A2"].font = subtitle_font
    ws_day.append([])

    day_headers = [
        "Receipt Date", "Time", "Payment ID", "Invoice #", "Customer Name",
        "Vehicle Reg", "Method", "Reference / UTR", "Amount (₹)", "Status"
    ]
    ws_day.append(day_headers)
    for col_idx in range(1, len(day_headers) + 1):
        cell = ws_day.cell(row=4, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    d_row = 5
    tot_collections = 0
    for p in payments:
        amt = -format_paise_to_rupees(p.get("amount", 0)) if p.get("is_reversal") else format_paise_to_rupees(p.get("amount", 0))
        tot_collections += amt
        p_vals = [
            p.get("paid_date", ""),
            p.get("time_str", ""),
            f"PAY-{p.get('id', '')}",
            p.get("invoice_number", ""),
            p.get("customer_name", ""),
            p.get("vehicle_reg", ""),
            p.get("method", "CASH"),
            p.get("reference", ""),
            amt,
            "REVERSED" if p.get("is_reversal") else "VALID"
        ]
        ws_day.append(p_vals)
        for col_idx in range(1, len(p_vals) + 1):
            c = ws_day.cell(row=d_row, column=col_idx)
            c.font = regular_font
            c.border = thin_border
            if col_idx == 9:
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
        d_row += 1

    ws_day.append(["TOTAL COLLECTIONS", "", "", "", "", "", "", "", round(tot_collections, 2), f"{len(payments)} RECEIPTS"])
    for col_idx in range(1, len(day_headers) + 1):
        c = ws_day.cell(row=d_row, column=col_idx)
        c.font = bold_font
        c.border = total_border
        if col_idx == 9:
            c.number_format = "#,##0.00"
            c.alignment = Alignment(horizontal="right")

    # --------------------------------------------------------------------------
    # TAB 3: GSTR-1 TAX SUMMARY
    # --------------------------------------------------------------------------
    ws_gst = wb.create_sheet(title="GSTR-1 Tax Summary")
    ws_gst.append([f"{w_name.upper()} - GSTR-1 MONTHLY RECONCILIATION"])
    ws_gst["A1"].font = title_font
    ws_gst.append([f"Workshop GSTIN: {w_gstin or 'Unregistered'} | CA Tax Audit Sheet"])
    ws_gst["A2"].font = subtitle_font
    ws_gst.append([])

    # B2B vs B2C Split
    b2b_invoices = [i for i in invoices if i.get("customer_gstin")]
    b2c_invoices = [i for i in invoices if not i.get("customer_gstin")]

    b2b_taxable = sum(format_paise_to_rupees(i.get("taxable_amount", 0) or (i.get("grand_total", 0) - i.get("tax_total", 0))) for i in b2b_invoices)
    b2b_tax = sum(format_paise_to_rupees(i.get("tax_total", 0)) for i in b2b_invoices)
    b2c_taxable = sum(format_paise_to_rupees(i.get("taxable_amount", 0) or (i.get("grand_total", 0) - i.get("tax_total", 0))) for i in b2c_invoices)
    b2c_tax = sum(format_paise_to_rupees(i.get("tax_total", 0)) for i in b2c_invoices)

    gst_headers = ["Section", "Invoice Count", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)", "Total Tax (₹)", "Total Value (₹)"]
    ws_gst.append(gst_headers)
    for col_idx in range(1, len(gst_headers) + 1):
        cell = ws_gst.cell(row=4, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    gst_rows = [
        ["B2B Registered Sales (Table 4)", len(b2b_invoices), round(b2b_taxable, 2), round(tot_cgst if b2b_invoices else 0, 2), round(tot_sgst if b2b_invoices else 0, 2), round(tot_igst if b2b_invoices else 0, 2), round(b2b_tax, 2), round(b2b_taxable + b2b_tax, 2)],
        ["B2C Small Consumer Sales (Table 7)", len(b2c_invoices), round(b2c_taxable, 2), round(tot_cgst if b2c_invoices else 0, 2), round(tot_sgst if b2c_invoices else 0, 2), round(tot_igst if b2c_invoices else 0, 2), round(b2c_tax, 2), round(b2c_taxable + b2c_tax, 2)],
        ["TOTAL OUTWARD SUPPLIES", len(invoices), round(tot_taxable, 2), round(tot_cgst, 2), round(tot_sgst, 2), round(tot_igst, 2), round(tot_tax, 2), round(tot_grand, 2)]
    ]
    for r_idx, r_data in enumerate(gst_rows, start=5):
        ws_gst.append(r_data)
        is_total = (r_idx == 7)
        for c_idx in range(1, len(r_data) + 1):
            c = ws_gst.cell(row=r_idx, column=c_idx)
            c.font = bold_font if is_total else regular_font
            c.border = total_border if is_total else thin_border
            if c_idx >= 3:
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")

    # --------------------------------------------------------------------------
    # TAB 4: PROFITABILITY & GROSS MARGINS
    # --------------------------------------------------------------------------
    ws_prof = wb.create_sheet(title="Profitability & Margins")
    ws_prof.append([f"{w_name.upper()} - GROSS PROFIT & MARGIN ANALYSIS"])
    ws_prof["A1"].font = title_font
    ws_prof.append([f"Generated: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}"])
    ws_prof["A2"].font = subtitle_font
    ws_prof.append([])

    prof_headers = [
        "Invoice #", "Customer", "Vehicle", "Invoiced Revenue (₹)",
        "Parts Cost (₹)", "Labour Cost (₹)", "Total Cost (₹)",
        "Gross Profit (₹)", "Margin (%)"
    ]
    ws_prof.append(prof_headers)
    for col_idx in range(1, len(prof_headers) + 1):
        cell = ws_prof.cell(row=4, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    p_row = 5
    tot_rev = 0
    tot_cost_all = 0
    tot_profit_all = 0

    for inv in invoices:
        rev = format_paise_to_rupees(inv.get("grand_total", 0))
        cost = format_paise_to_rupees(inv.get("total_cost", 0))
        profit = format_paise_to_rupees(inv.get("gross_profit", 0)) or (rev - cost)
        margin = round((profit / rev * 100), 1) if rev > 0 else 0.0

        tot_rev += rev
        tot_cost_all += cost
        tot_profit_all += profit

        row_data = [
            inv.get("invoice_number", ""),
            inv.get("customer_name", ""),
            inv.get("vehicle_reg", ""),
            rev,
            0.0, # Parts cost
            0.0, # Labour cost
            cost,
            profit,
            margin
        ]
        ws_prof.append(row_data)
        for col_idx in range(1, len(row_data) + 1):
            c = ws_prof.cell(row=p_row, column=col_idx)
            c.font = regular_font
            c.border = thin_border
            if col_idx in (4, 5, 6, 7, 8):
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
            elif col_idx == 9:
                c.number_format = '0.0"%"'
                c.alignment = Alignment(horizontal="right")
        p_row += 1

    overall_margin = round((tot_profit_all / tot_rev * 100), 1) if tot_rev > 0 else 0.0
    ws_prof.append([
        "OVERALL WORKSHOP PROFIT", "", "", round(tot_rev, 2),
        "", "", round(tot_cost_all, 2), round(tot_profit_all, 2), overall_margin
    ])
    for col_idx in range(1, len(prof_headers) + 1):
        c = ws_prof.cell(row=p_row, column=col_idx)
        c.font = bold_font
        c.border = total_border
        if col_idx in (4, 7, 8):
            c.number_format = "#,##0.00"
            c.alignment = Alignment(horizontal="right")
        elif col_idx == 9:
            c.number_format = '0.0"%"'
            c.alignment = Alignment(horizontal="right")

    # Auto-fit column widths across all sheets
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len and "\n" not in val and len(val) < 50:
                    max_len = len(val)
            ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_sales_register_xlsx(invoices: List[Dict[str, Any]], workshop_profile: Dict[str, Any]) -> bytes:
    """Generates a standalone single-sheet Sales Register Excel workbook."""
    wb = Workbook()
    header_fill = PatternFill(start_color="1E4074", end_color="1E4074", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=10, bold=True)
    regular_font = Font(name="Calibri", size=10)
    title_font = Font(name="Calibri", size=14, bold=True, color="1E4074")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="555555")
    thin_border = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0")
    )
    total_border = Border(
        top=Side(style="thin", color="000000"),
        bottom=Side(style="double", color="000000")
    )

    w_name = workshop_profile.get("name", "Workshop Management System")
    w_gstin = workshop_profile.get("gstin", "")

    ws = wb.active
    ws.title = "Sales Register"
    ws.append([f"{w_name.upper()} - SALES REGISTER"])
    ws["A1"].font = title_font
    ws.append([f"GSTIN: {w_gstin or 'Unregistered'} | Generated: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}"])
    ws["A2"].font = subtitle_font
    ws.append([])

    headers = [
        "Invoice #", "Date", "Customer Name", "Customer Phone", "Customer GSTIN",
        "Vehicle Reg", "Vehicle Model", "Parts (₹)", "Labour (₹)", "Other (₹)",
        "Discount (₹)", "Taxable Value (₹)", "CGST (₹)", "SGST (₹)", "IGST (₹)",
        "Total Tax (₹)", "Grand Total (₹)", "Paid (₹)", "Balance Due (₹)", "Status"
    ]
    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=4, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    tot_taxable = tot_cgst = tot_sgst = tot_igst = tot_tax = tot_grand = tot_paid = tot_due = 0
    row_idx = 5
    for inv in invoices:
        taxable = format_paise_to_rupees(inv.get("taxable_amount", 0) or (inv.get("grand_total", 0) - inv.get("tax_total", 0)))
        cgst = format_paise_to_rupees(inv.get("cgst_amount", 0))
        sgst = format_paise_to_rupees(inv.get("sgst_amount", 0))
        igst = format_paise_to_rupees(inv.get("igst_amount", 0))
        tax = format_paise_to_rupees(inv.get("tax_total", 0))
        grand = format_paise_to_rupees(inv.get("grand_total", 0))
        paid = format_paise_to_rupees(inv.get("amount_paid", 0))
        due = format_paise_to_rupees(inv.get("balance_due", 0))

        tot_taxable += taxable
        tot_cgst += cgst
        tot_sgst += sgst
        tot_igst += igst
        tot_tax += tax
        tot_grand += grand
        tot_paid += paid
        tot_due += due

        vals = [
            inv.get("invoice_number", ""),
            inv.get("finalized_at", ""),
            inv.get("customer_name", ""),
            inv.get("customer_phone", ""),
            inv.get("customer_gstin", "") or "B2C Consumer",
            inv.get("vehicle_reg", ""),
            inv.get("vehicle_model", ""),
            format_paise_to_rupees(inv.get("parts_total", 0)),
            format_paise_to_rupees(inv.get("labour_total", 0)),
            format_paise_to_rupees(inv.get("other_charges_total", 0)),
            format_paise_to_rupees(inv.get("discount", 0)),
            taxable, cgst, sgst, igst, tax, grand, paid, due,
            inv.get("payment_status", "")
        ]
        ws.append(vals)
        for col_idx in range(1, len(vals) + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.font = regular_font
            c.border = thin_border
            if col_idx in (8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19):
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
        row_idx += 1

    ws.append([
        "TOTAL", "", "", "", "", "", "", "", "", "", "",
        round(tot_taxable, 2), round(tot_cgst, 2), round(tot_sgst, 2), round(tot_igst, 2),
        round(tot_tax, 2), round(tot_grand, 2), round(tot_paid, 2), round(tot_due, 2),
        f"{len(invoices)} INVOICES"
    ])
    for col_idx in range(1, len(headers) + 1):
        c = ws.cell(row=row_idx, column=col_idx)
        c.font = bold_font
        c.border = total_border
        if col_idx in (12, 13, 14, 15, 16, 17, 18, 19):
            c.number_format = "#,##0.00"
            c.alignment = Alignment(horizontal="right")

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or "")
            if len(val) > max_len and "\n" not in val and len(val) < 50:
                max_len = len(val)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def generate_day_book_xlsx(payments: List[Dict[str, Any]], workshop_profile: Dict[str, Any]) -> bytes:
    """Generates a standalone single-sheet Day Book / Cash & Bank Register Excel workbook."""
    wb = Workbook()
    header_fill = PatternFill(start_color="1E4074", end_color="1E4074", fill_type="solid")
    header_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=10, bold=True)
    regular_font = Font(name="Calibri", size=10)
    title_font = Font(name="Calibri", size=14, bold=True, color="1E4074")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="555555")
    thin_border = Border(
        left=Side(style="thin", color="E0E0E0"),
        right=Side(style="thin", color="E0E0E0"),
        top=Side(style="thin", color="E0E0E0"),
        bottom=Side(style="thin", color="E0E0E0")
    )
    total_border = Border(
        top=Side(style="thin", color="000000"),
        bottom=Side(style="double", color="000000")
    )

    w_name = workshop_profile.get("name", "Workshop Management System")
    ws = wb.active
    ws.title = "Day Book Receipts"
    ws.append([f"{w_name.upper()} - DAY BOOK / RECEIPTS"])
    ws["A1"].font = title_font
    ws.append([f"Generated: {datetime.utcnow().strftime('%d/%m/%Y %I:%M %p')}"])
    ws["A2"].font = subtitle_font
    ws.append([])

    headers = [
        "Receipt Date", "Time", "Payment ID", "Invoice #", "Customer Name",
        "Vehicle Reg", "Method", "Reference / UTR", "Amount (₹)", "Status"
    ]
    ws.append(headers)
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=4, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    d_row = 5
    tot_collections = 0
    for p in payments:
        amt = -format_paise_to_rupees(p.get("amount", 0)) if p.get("is_reversal") else format_paise_to_rupees(p.get("amount", 0))
        tot_collections += amt
        p_vals = [
            p.get("paid_date", ""),
            p.get("time_str", ""),
            f"PAY-{p.get('id', '')}",
            p.get("invoice_number", ""),
            p.get("customer_name", ""),
            p.get("vehicle_reg", ""),
            p.get("method", "CASH"),
            p.get("reference", ""),
            amt,
            "REVERSED" if p.get("is_reversal") else "VALID"
        ]
        ws.append(p_vals)
        for col_idx in range(1, len(p_vals) + 1):
            c = ws.cell(row=d_row, column=col_idx)
            c.font = regular_font
            c.border = thin_border
            if col_idx == 9:
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
        d_row += 1

    ws.append(["TOTAL COLLECTIONS", "", "", "", "", "", "", "", round(tot_collections, 2), f"{len(payments)} RECEIPTS"])
    for col_idx in range(1, len(headers) + 1):
        c = ws.cell(row=d_row, column=col_idx)
        c.font = bold_font
        c.border = total_border
        if col_idx == 9:
            c.number_format = "#,##0.00"
            c.alignment = Alignment(horizontal="right")

    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or "")
            if len(val) > max_len and "\n" not in val and len(val) < 50:
                max_len = len(val)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
