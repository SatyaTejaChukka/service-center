import os
from pathlib import Path
from io import BytesIO
from datetime import datetime
from typing import Dict, Any, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app.core.config import settings
from app.models import Invoice, JobCard

# Register TrueType fonts available on Windows for exact Unicode Rupee glyph
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

try:
    if os.path.exists("C:/Windows/Fonts/segoeui.ttf"):
        pdfmetrics.registerFont(TTFont("SegoeUI", "C:/Windows/Fonts/segoeui.ttf"))
        pdfmetrics.registerFont(TTFont("SegoeUI-Bold", "C:/Windows/Fonts/segoeuib.ttf"))
        FONT_REGULAR = "SegoeUI"
        FONT_BOLD = "SegoeUI-Bold"
    elif os.path.exists("C:/Windows/Fonts/arial.ttf"):
        pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
        pdfmetrics.registerFont(TTFont("Arial-Bold", "C:/Windows/Fonts/arialbd.ttf"))
        FONT_REGULAR = "Arial"
        FONT_BOLD = "Arial-Bold"
except Exception:
    pass

def format_inr(paise: int) -> str:
    """Formats paise as INR string (e.g. ₹7,400.00 or Rs. 7,400.00 fallback)."""
    rupees = paise / 100.0
    prefix = "₹" if FONT_REGULAR != "Helvetica" else "Rs. "
    return f"{prefix}{rupees:,.2f}"

def format_date(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.strftime("%d/%m/%Y")

def format_time(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.strftime("%I:%M %p")

PRIMARY_COLOR = colors.HexColor("#0F172A")    # Slate 900
SECONDARY_COLOR = colors.HexColor("#1E40AF")  # Royal Blue 800
ACCENT_BG = colors.HexColor("#F8FAFC")        # Slate 50
BORDER_COLOR = colors.HexColor("#E2E8F0")     # Slate 200
BORDER_DARK = colors.HexColor("#CBD5E1")      # Slate 300
TEXT_MUTED = colors.HexColor("#64748B")       # Slate 500
STATUS_GREEN = colors.HexColor("#15803D")     # Emerald 700
STATUS_AMBER = colors.HexColor("#B45309")     # Amber 700

class WatermarkCanvas(canvas.Canvas):
    """Custom canvas that adds a VOID watermark if specified."""
    def __init__(self, *args, **kwargs):
        self.is_void = kwargs.pop("is_void", False)
        super().__init__(*args, **kwargs)

    def draw_watermark(self):
        if self.is_void:
            self.saveState()
            self.setFont(FONT_BOLD, 72)
            self.setFillColor(colors.Color(0.8, 0.2, 0.2, alpha=0.25))
            self.translate(A4[0] / 2.0, A4[1] / 2.0)
            self.rotate(45)
            self.drawCentredString(0, 0, "VOID")
            self.restoreState()

    def showPage(self):
        self.draw_watermark()
        super().showPage()


def generate_invoice_pdf(
    invoice: Invoice,
    business_profile: Dict[str, Any],
    save_to_disk: bool = True
) -> bytes:
    """Generates an authoritative A4 Invoice PDF from database data."""
    buffer = BytesIO()
    
    is_void = (invoice.status == "VOID")
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle",
        fontName=FONT_BOLD,
        fontSize=15,
        leading=18,
        alignment=1, # Center
        textColor=colors.HexColor("#1A1D22")
    )
    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        fontName=FONT_REGULAR,
        fontSize=10,
        leading=13,
        alignment=1,
        textColor=colors.HexColor("#4A5568")
    )
    normal_style = ParagraphStyle(
        "InvoiceNormal",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1A1D22")
    )
    bold_style = ParagraphStyle(
        "InvoiceBold",
        fontName=FONT_BOLD,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1A1D22")
    )
    right_style = ParagraphStyle(
        "InvoiceRight",
        fontName=FONT_REGULAR,
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#1A1D22")
    )
    right_bold = ParagraphStyle(
        "InvoiceRightBold",
        fontName=FONT_BOLD,
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#1A1D22")
    )

    story = []

    # 1. Header Branding
    w_name = business_profile.get("name", "PUSHPA RAJ AUTOMOTIVE SERVICES")
    w_address = business_profile.get("address", "Main Road, Industrial Area")
    w_phone = business_profile.get("phone", "9876543210")
    w_gstin = business_profile.get("gstin", "")
    w_upi = business_profile.get("upi_id", "")

    story.append(Paragraph(w_name.upper(), title_style))
    header_info = f"{w_address} &bull; Phone: {w_phone}"
    if w_gstin:
        header_info += f" &bull; GSTIN: {w_gstin}"
    story.append(Paragraph(header_info, subtitle_style))
    doc_title = "TAX INVOICE / SERVICE BILL" if invoice.status == "FINALIZED" else ("VOID INVOICE" if invoice.status == "VOID" else "ESTIMATE / SERVICE QUOTATION")
    story.append(Paragraph(f"<b>{doc_title}</b>", subtitle_style))
    story.append(Spacer(1, 10))

    # 2. Meta Grid (Invoice #, Date, Customer, Vehicle)
    jc = invoice.job_card
    cust = jc.customer if jc else None
    veh = jc.vehicle if jc else None

    # Check if frozen snapshot is available for FINALIZED / VOID invoices
    snapshot_items = None
    snapshot_meta = {}
    if invoice.status in ("FINALIZED", "VOID") and getattr(invoice, "line_items_snapshot", None):
        try:
            parsed = json.loads(invoice.line_items_snapshot)
            if isinstance(parsed, dict):
                snapshot_items = parsed.get("items", [])
                snapshot_meta = parsed.get("metadata", {})
            elif isinstance(parsed, list):
                snapshot_items = parsed
        except Exception:
            snapshot_items = None

    cust_name = snapshot_meta.get("customer_name") or (cust.name if cust else "")
    cust_phone = snapshot_meta.get("customer_phone") or (cust.phone if cust else "")
    cust_gstin_val = snapshot_meta.get("customer_gstin") or (getattr(cust, "gstin", "") if cust else "")
    veh_reg = snapshot_meta.get("vehicle_reg") or (veh.registration_number if veh else "")
    veh_make = snapshot_meta.get("vehicle_make") or (veh.make if veh else "")
    veh_model = snapshot_meta.get("vehicle_model") or (veh.model if veh else "")
    jc_number = snapshot_meta.get("job_card_number") or (jc.job_card_number if jc else "")
    odometer_val = snapshot_meta.get("odometer", (jc.odometer if jc else 0))

    cust_gstin_str = f"<br/><b>GSTIN:</b> {cust_gstin_val}" if cust_gstin_val else "<br/><b>Type:</b> Consumer (B2C)"

    meta_data = [
        [
            Paragraph(f"<b>{'Invoice No:' if invoice.status == 'FINALIZED' else 'Document:'}</b> {invoice.invoice_number or 'DRAFT ESTIMATE'}", normal_style),
            Paragraph(f"<b>Date:</b> {format_date(invoice.finalized_at or invoice.created_at)}", right_style)
        ],
        [
            Paragraph(f"<b>Job Card:</b> {jc_number}", normal_style),
            Paragraph(f"<b>Status:</b> {invoice.status}", right_bold)
        ],
        [
            Paragraph(f"<b>Customer:</b> {cust_name} &bull; {cust_phone}{cust_gstin_str}", normal_style),
            Paragraph(f"<b>Vehicle:</b> {veh_make} {veh_model}", right_style)
        ],
        [
            Paragraph(f"<b>Reg No:</b> {veh_reg}", normal_style),
            Paragraph(f"<b>Odometer:</b> {odometer_val:,} km" if isinstance(odometer_val, int) else f"<b>Odometer:</b> {odometer_val}", right_style)
        ]
    ]

    meta_table = Table(meta_data, colWidths=[90 * mm, 90 * mm])
    meta_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E1")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # Helper class for frozen snapshot items
    class FrozenPdfItem:
        def __init__(self, data: Dict[str, Any]):
            self.description = data.get("description", "")
            self.part_number = data.get("part_number")
            self.quantity = data.get("quantity", 1)
            self.unit = data.get("unit", "pcs")
            self.unit_price = data.get("unit_price", 0)
            self.total = data.get("total", 0)
            self.status = data.get("status", "APPROVED")
            self.hsn_code = data.get("hsn_sac", "8708")
            self.sac_code = data.get("hsn_sac", "998729")

    # 3. Parts Table (Frozen snapshot if finalized/void, else live query)
    if snapshot_items is not None:
        active_parts = [FrozenPdfItem(i) for i in snapshot_items if i.get("type") == "PART"]
    elif invoice.status == "FINALIZED":
        active_parts = [p for p in jc.parts_items if p.status in ("APPROVED", "USED")] if jc else []
    else:
        active_parts = [p for p in jc.parts_items if p.status != "REJECTED"] if jc else []

    if active_parts:
        parts_header = "PARTS / MATERIALS" if invoice.status == "FINALIZED" else "ESTIMATED PARTS / MATERIALS"
        story.append(Paragraph(f"<b>{parts_header}</b>", bold_style))
        parts_data = [
            [
                Paragraph("<b>#</b>", bold_style),
                Paragraph("<b>Description</b>", bold_style),
                Paragraph("<b>HSN</b>", normal_style),
                Paragraph("<b>Qty</b>", right_bold),
                Paragraph("<b>Rate</b>", right_bold),
                Paragraph("<b>Amount</b>", right_bold)
            ]
        ]
        for idx, p in enumerate(active_parts, start=1):
            desc = p.description
            if p.part_number:
                desc += f" ({p.part_number})"
            if invoice.status == "DRAFT" and p.status == "RECOMMENDED":
                desc += " <i>[Recommended]</i>"

            hsn = getattr(p, "hsn_code", None) or "8708"

            parts_data.append([
                Paragraph(str(idx), normal_style),
                Paragraph(desc, normal_style),
                Paragraph(hsn, normal_style),
                Paragraph(f"{p.quantity:g} {p.unit}", right_style),
                Paragraph(format_inr(p.unit_price), right_style),
                Paragraph(format_inr(p.total), right_style)
            ])
        parts_label = "Parts Total" if invoice.status == "FINALIZED" else "Parts Estimate"
        parts_data.append([
            "", Paragraph(f"<b>{parts_label}</b>", bold_style), "", "", "", Paragraph(format_inr(invoice.parts_total), right_bold)
        ])
        
        parts_table = Table(parts_data, colWidths=[7 * mm, 68 * mm, 20 * mm, 22 * mm, 28 * mm, 35 * mm])
        parts_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#1A1D22")),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor("#E2E8F0")),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#1A1D22")),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(parts_table)
        story.append(Spacer(1, 10))

    # 4. Labour Table (Frozen snapshot if finalized/void, else live query)
    if snapshot_items is not None:
        active_labour = [FrozenPdfItem(i) for i in snapshot_items if i.get("type") == "LABOUR"]
    elif invoice.status == "FINALIZED":
        active_labour = [l for l in jc.labour_items if l.status in ("APPROVED", "DONE")] if jc else []
    else:
        active_labour = [l for l in jc.labour_items if l.status != "REJECTED"] if jc else []

    if active_labour:
        labour_header = "LABOUR & SERVICES" if invoice.status == "FINALIZED" else "ESTIMATED LABOUR & SERVICES"
        story.append(Paragraph(f"<b>{labour_header}</b>", bold_style))
        labour_data = [
            [
                Paragraph("<b>#</b>", bold_style),
                Paragraph("<b>Description</b>", bold_style),
                Paragraph("<b>SAC</b>", normal_style),
                Paragraph("<b>Qty</b>", right_bold),
                Paragraph("<b>Rate</b>", right_bold),
                Paragraph("<b>Amount</b>", right_bold)
            ]
        ]
        for idx, l in enumerate(active_labour, start=1):
            desc = l.description
            if invoice.status == "DRAFT" and l.status == "RECOMMENDED":
                desc += " <i>[Recommended]</i>"

            sac = getattr(l, "sac_code", None) or "998729"

            labour_data.append([
                Paragraph(str(idx), normal_style),
                Paragraph(desc, normal_style),
                Paragraph(sac, normal_style),
                Paragraph(f"{l.quantity:g}", right_style),
                Paragraph(format_inr(l.unit_price), right_style),
                Paragraph(format_inr(l.total), right_style)
            ])
        labour_label = "Labour Total" if invoice.status == "FINALIZED" else "Labour Estimate"
        labour_data.append([
            "", Paragraph(f"<b>{labour_label}</b>", bold_style), "", "", "", Paragraph(format_inr(invoice.labour_total), right_bold)
        ])
        
        labour_table = Table(labour_data, colWidths=[7 * mm, 68 * mm, 20 * mm, 22 * mm, 28 * mm, 35 * mm])
        labour_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#1A1D22")),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor("#E2E8F0")),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#1A1D22")),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(labour_table)
        story.append(Spacer(1, 10))

    # 5. Other Charges, Discount, Tax, and Totals
    summary_rows = [
        [Paragraph("Parts Total:" if invoice.status == "FINALIZED" else "Parts Estimate:", normal_style), Paragraph(format_inr(invoice.parts_total), right_style)],
        [Paragraph("Labour Total:" if invoice.status == "FINALIZED" else "Labour Estimate:", normal_style), Paragraph(format_inr(invoice.labour_total), right_style)],
    ]
    if invoice.other_charges_total > 0:
        summary_rows.append([Paragraph("Other Charges / Consumables:", normal_style), Paragraph(format_inr(invoice.other_charges_total), right_style)])
    if invoice.discount > 0:
        summary_rows.append([Paragraph("Discount:", normal_style), Paragraph(f"-{format_inr(invoice.discount)}", right_style)])
    
    # GST Breakdown
    taxable_val = invoice.taxable_amount or (invoice.grand_total - invoice.tax_total)
    if invoice.tax_total > 0:
        summary_rows.append([Paragraph("Taxable Value:", normal_style), Paragraph(format_inr(taxable_val), right_style)])
        if invoice.igst_amount and invoice.igst_amount > 0:
            summary_rows.append([Paragraph("IGST (Integrated Tax):", normal_style), Paragraph(format_inr(invoice.igst_amount), right_style)])
        else:
            cgst = invoice.cgst_amount or (invoice.tax_total // 2)
            sgst = invoice.sgst_amount or (invoice.tax_total // 2)
            summary_rows.append([Paragraph("CGST (Central Tax):", normal_style), Paragraph(format_inr(cgst), right_style)])
            summary_rows.append([Paragraph("SGST (State Tax):", normal_style), Paragraph(format_inr(sgst), right_style)])
    
    total_label = "<b>GRAND TOTAL:</b>" if invoice.status == "FINALIZED" else "<b>ESTIMATED TOTAL:</b>"
    summary_rows.append([
        Paragraph(total_label, bold_style),
        Paragraph(f"<b>{format_inr(invoice.grand_total)}</b>", right_bold)
    ])

    # Payment settlement line
    amount_paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in invoice.payments)) if invoice.payments else 0
    balance = max(0, invoice.grand_total - amount_paid)
    if invoice.status == "FINALIZED":
        summary_rows.append([Paragraph("Amount Paid:", normal_style), Paragraph(format_inr(amount_paid), right_style)])
        summary_rows.append([Paragraph("<b>Balance Due:</b>", bold_style), Paragraph(f"<b>{format_inr(balance)}</b>", right_bold)])
    elif amount_paid > 0:
        summary_rows.append([Paragraph("Advance Received:", normal_style), Paragraph(format_inr(amount_paid), right_style)])
        summary_rows.append([Paragraph("<b>Estimated Balance:</b>", bold_style), Paragraph(f"<b>{format_inr(balance)}</b>", right_bold)])

    sum_table = Table(summary_rows, colWidths=[125 * mm, 55 * mm])
    sum_table.setStyle(TableStyle([
        ('LINEABOVE', (0, -3), (-1, -3), 1, colors.HexColor("#1A1D22")),
        ('LINEBELOW', (0, -3), (-1, -3), 1, colors.HexColor("#1A1D22")),
        ('PADDING', (0, 0), (-1, -1), 2.5),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 14))

    # 6. Payment info & Terms
    terms = business_profile.get("terms", "1. All disputes subject to local jurisdiction.\n2. Goods once sold will not be taken back.")
    footer = business_profile.get("footer", "Thank you for choosing Pushpa Raj Automotive Services!")
    
    bottom_data = [
        [
            Paragraph(f"<b>UPI ID:</b> {w_upi}<br/><b>Terms:</b><br/>{terms.replace(chr(10), '<br/>')}", normal_style),
            Paragraph("<br/><br/><br/><b>Authorized Signatory</b>", right_style)
        ]
    ]
    bottom_table = Table(bottom_data, colWidths=[110 * mm, 70 * mm])
    story.append(bottom_table)
    story.append(Spacer(1, 10))
    story.append(Paragraph(footer, subtitle_style))

    # Build PDF with watermark canvas
    def make_canvas(*args, **kwargs):
        return WatermarkCanvas(*args, is_void=is_void, **kwargs)

    doc.build(story, canvasmaker=make_canvas)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    # Save to documents/invoices/{year}/
    if save_to_disk and invoice.invoice_number:
        year = str(invoice.finalized_at.year if invoice.finalized_at else datetime.utcnow().year)
        dest_dir = settings.invoices_dir / year
        dest_dir.mkdir(parents=True, exist_ok=True)
        file_path = dest_dir / f"{invoice.invoice_number}.pdf"
        with open(file_path, "wb") as f:
            f.write(pdf_bytes)
        invoice.pdf_file_path = str(file_path)

    return pdf_bytes


def generate_job_card_detailed_pdf(
    job_card: JobCard,
    business_profile: Dict[str, Any]
) -> bytes:
    """Generates a comprehensive Dealership Work Order & Estimate PDF."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("DTitle", fontName=FONT_BOLD, fontSize=16, leading=19, textColor=PRIMARY_COLOR)
    subtitle_style = ParagraphStyle("DSub", fontName=FONT_REGULAR, fontSize=8.5, leading=11, textColor=TEXT_MUTED)
    doc_header_style = ParagraphStyle("DDocHeader", fontName=FONT_BOLD, fontSize=13, leading=16, alignment=2, textColor=SECONDARY_COLOR)
    doc_meta_style = ParagraphStyle("DDocMeta", fontName=FONT_REGULAR, fontSize=8.5, leading=12, alignment=2, textColor=PRIMARY_COLOR)
    
    sec_title = ParagraphStyle("SecTitle", fontName=FONT_BOLD, fontSize=9.5, leading=12, textColor=SECONDARY_COLOR)
    card_label = ParagraphStyle("CardLabel", fontName=FONT_BOLD, fontSize=7.5, leading=10, textColor=TEXT_MUTED)
    card_value = ParagraphStyle("CardVal", fontName=FONT_REGULAR, fontSize=8.5, leading=11, textColor=PRIMARY_COLOR)
    card_value_bold = ParagraphStyle("CardValB", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=PRIMARY_COLOR)

    th_style = ParagraphStyle("TH", fontName=FONT_BOLD, fontSize=8, leading=10, textColor=colors.HexColor("#334155"))
    td_style = ParagraphStyle("TD", fontName=FONT_REGULAR, fontSize=8, leading=11, textColor=PRIMARY_COLOR)
    td_bold = ParagraphStyle("TDBold", fontName=FONT_BOLD, fontSize=8, leading=11, textColor=PRIMARY_COLOR)
    td_right = ParagraphStyle("TDR", fontName=FONT_REGULAR, fontSize=8, leading=11, alignment=2, textColor=PRIMARY_COLOR)
    td_right_bold = ParagraphStyle("TDRB", fontName=FONT_BOLD, fontSize=8, leading=11, alignment=2, textColor=PRIMARY_COLOR)
    
    terms_style = ParagraphStyle("Terms", fontName=FONT_REGULAR, fontSize=6.5, leading=9, textColor=TEXT_MUTED)

    story = []

    # 1. Header Banner
    w_name = business_profile.get("name", "PUSHPA RAJ AUTOMOTIVE SERVICES")
    w_address = business_profile.get("address", "Main Road, Industrial Area")
    w_phone = business_profile.get("phone", "+91 98765 43210")
    w_email = business_profile.get("email", "")
    w_gstin = business_profile.get("gstin", "")

    header_left = [
        Paragraph(w_name.upper(), title_style),
        Paragraph("Authorized Multi-Brand Auto Care & Diagnostic Center", ParagraphStyle("Tag", fontName=FONT_BOLD, fontSize=7.5, leading=10, textColor=SECONDARY_COLOR)),
        Paragraph(f"{w_address}", subtitle_style),
        Paragraph(f"Phone: {w_phone}" + (f" &bull; Email: {w_email}" if w_email else "") + (f" &bull; GSTIN: <b>{w_gstin}</b>" if w_gstin else ""), subtitle_style)
    ]

    jc_no = job_card.job_card_number
    date_str = format_date(job_card.date)
    time_in_str = format_time(job_card.time_in)
    status_str = (job_card.status or "RECEIVED").replace("_", " ")

    header_right = [
        Paragraph("WORK ORDER & ESTIMATE", doc_header_style),
        Paragraph(f"Job Card: <b>#{jc_no}</b>", doc_meta_style),
        Paragraph(f"Date: <b>{date_str}</b>  Time: <b>{time_in_str}</b>", doc_meta_style),
        Paragraph(f"Status: <b>{status_str}</b>", doc_meta_style),
    ]
    if job_card.promised_at:
        header_right.append(Paragraph(f"Promised Delivery: <b>{format_date(job_card.promised_at)} {format_time(job_card.promised_at)}</b>", doc_meta_style))

    header_table = Table([[header_left, header_right]], colWidths=[105 * mm, 77 * mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=SECONDARY_COLOR, spaceBefore=2, spaceAfter=8))

    # 2. Customer & Vehicle Grid
    cust = job_card.customer
    veh = job_card.vehicle

    reg_plate = veh.registration_number if veh else "N/A"
    veh_title = f"{veh.make or ''} {veh.model or ''} {veh.variant or ''}".strip() if veh else "Vehicle Record"
    fuel_odo = f"{job_card.odometer:,} km  &bull;  Fuel: {job_card.fuel_level or 'N/A'}"
    tech_name = job_card.assigned_user.full_name if (getattr(job_card, 'assigned_user', None)) else "Unassigned"

    # Customer Card content
    cust_data = [
        [Paragraph("CUSTOMER INFORMATION", sec_title), ""],
        [Paragraph("Name:", card_label), Paragraph(f"<b>{cust.name if cust else 'Walk-in Customer'}</b>", card_value)],
        [Paragraph("Mobile:", card_label), Paragraph(f"<b>{cust.phone if cust else '-'}</b>" + (f" / {cust.alt_phone}" if (cust and getattr(cust, 'alt_phone', None)) else ""), card_value)],
        [Paragraph("Email / Addr:", card_label), Paragraph(f"{cust.address or (cust.email if cust else '-')}", card_value)],
    ]
    if cust and getattr(cust, 'gstin', None):
        cust_data.append([Paragraph("GSTIN:", card_label), Paragraph(f"<b>{cust.gstin}</b>", card_value)])

    # Vehicle Card content
    veh_data = [
        [Paragraph("VEHICLE SPECIFICATIONS", sec_title), ""],
        [Paragraph("Reg No:", card_label), Paragraph(f"<b>[ {reg_plate} ]</b>", card_value_bold)],
        [Paragraph("Model:", card_label), Paragraph(f"<b>{veh_title}</b> ({veh.fuel_type if veh else 'Petrol/Diesel'}, {veh.year if veh else ''})", card_value)],
        [Paragraph("Odo & Fuel:", card_label), Paragraph(fuel_odo, card_value)],
        [Paragraph("Advisor/Tech:", card_label), Paragraph(f"<b>{tech_name}</b>", card_value)],
    ]

    t_cust = Table(cust_data, colWidths=[24 * mm, 66 * mm])
    t_cust.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
        ('PADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (1,0), 4),
        ('LINEBELOW', (0,0), (-1,0), 0.75, BORDER_DARK),
    ]))

    t_veh = Table(veh_data, colWidths=[24 * mm, 66 * mm])
    t_veh.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('BACKGROUND', (0,0), (-1,-1), ACCENT_BG),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
        ('PADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (1,0), 4),
        ('LINEBELOW', (0,0), (-1,0), 0.75, BORDER_DARK),
    ]))

    info_grid = Table([[t_cust, t_veh]], colWidths=[91 * mm, 91 * mm])
    info_grid.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(info_grid)

    # 3. Reported Complaints & Intake Notes
    story.append(Paragraph("REPORTED COMPLAINTS & CUSTOMER OBSERVATIONS", sec_title))
    comp_rows = [[Paragraph("#", th_style), Paragraph("Reported Issue / Work Requested", th_style), Paragraph("Mechanic Action & Diagnosis", th_style)]]
    for idx, c in enumerate(job_card.complaints or [], start=1):
        comp_rows.append([
            Paragraph(f"<b>{idx}</b>", td_style),
            Paragraph(c.description, td_style),
            Paragraph("Pending inspection / Under evaluation", ParagraphStyle("PNotes", fontName=FONT_REGULAR, fontSize=7.5, textColor=TEXT_MUTED))
        ])
    if not job_card.complaints:
        comp_rows.append(["1", Paragraph("General periodic maintenance, fluid levels, and overall vehicle health inspection", td_style), "-"])

    t_comp = Table(comp_rows, colWidths=[10 * mm, 95 * mm, 77 * mm])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 7))

    # 4. Multi-Point Inspection Summary
    if job_card.inspections:
        story.append(Paragraph("INTAKE MULTI-POINT INSPECTION CHECKLIST", sec_title))
        insp_rows = [[Paragraph("Category", th_style), Paragraph("Intake Status", th_style), Paragraph("Observations / Inspection Notes", th_style)]]
        for insp in job_card.inspections:
            is_attn = (insp.status == "NEEDS_ATTENTION")
            st_color = STATUS_AMBER if is_attn else STATUS_GREEN
            insp_rows.append([
                Paragraph(f"<b>{insp.category}</b>", td_style),
                Paragraph(f"<b>{insp.status}</b>", ParagraphStyle("ISt", fontName=FONT_BOLD, fontSize=7.5, textColor=st_color)),
                Paragraph(insp.notes or "Inspected OK &bull; Meets standard specifications", td_style)
            ])
        t_insp = Table(insp_rows, colWidths=[40 * mm, 38 * mm, 104 * mm])
        t_insp.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
            ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('PADDING', (0,0), (-1,-1), 2.8),
        ]))
        story.append(t_insp)
        story.append(Spacer(1, 7))

    # 5. Services & Labour Breakdown
    has_labour = bool(job_card.labour_items)
    if has_labour:
        story.append(Paragraph("LABOUR OPERATIONS & SERVICE SCHEDULE", sec_title))
        lab_rows = [[
            Paragraph("#", th_style),
            Paragraph("Service / Labour Operation", th_style),
            Paragraph("SAC", th_style),
            Paragraph("Status", th_style),
            Paragraph("Qty", th_style),
            Paragraph("Rate", ParagraphStyle("THR", fontName=FONT_BOLD, fontSize=8, alignment=2, textColor=colors.HexColor("#334155"))),
            Paragraph("Total", ParagraphStyle("THRT", fontName=FONT_BOLD, fontSize=8, alignment=2, textColor=colors.HexColor("#334155"))),
        ]]
        for idx, l in enumerate(job_card.labour_items, start=1):
            is_appr = l.status in ("APPROVED", "DONE")
            is_rej = (l.status == "REJECTED")
            st_col = STATUS_GREEN if is_appr else (colors.HexColor("#EF4444") if is_rej else TEXT_MUTED)
            lab_rows.append([
                Paragraph(str(idx), td_style),
                Paragraph(l.description, td_bold if is_appr else td_style),
                Paragraph(getattr(l, "sac_code", "998729") or "998729", td_style),
                Paragraph(f"<b>{l.status}</b>", ParagraphStyle("LSt", fontName=FONT_BOLD, fontSize=7.5, textColor=st_col)),
                Paragraph(str(l.quantity), td_style),
                Paragraph(format_inr(l.unit_price), td_right),
                Paragraph(format_inr(l.total) if not is_rej else "(Rejected)", td_right_bold if is_appr else td_right),
            ])
        t_lab = Table(lab_rows, colWidths=[8 * mm, 72 * mm, 18 * mm, 24 * mm, 14 * mm, 22 * mm, 24 * mm])
        t_lab.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
            ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('PADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(t_lab)
        story.append(Spacer(1, 7))

    # 6. Parts & Materials Breakdown
    has_parts = bool(job_card.parts_items)
    if has_parts:
        story.append(Paragraph("SPARE PARTS & CONSUMABLES REQUIRED", sec_title))
        part_rows = [[
            Paragraph("#", th_style),
            Paragraph("Part Name & Specification", th_style),
            Paragraph("Part No / HSN", th_style),
            Paragraph("Qty", th_style),
            Paragraph("Unit", th_style),
            Paragraph("Unit Price", ParagraphStyle("THP", fontName=FONT_BOLD, fontSize=8, alignment=2, textColor=colors.HexColor("#334155"))),
            Paragraph("Line Total", ParagraphStyle("THPT", fontName=FONT_BOLD, fontSize=8, alignment=2, textColor=colors.HexColor("#334155"))),
        ]]
        for idx, p in enumerate(job_card.parts_items, start=1):
            is_appr = p.status in ("APPROVED", "USED")
            is_rej = (p.status == "REJECTED")
            p_no = p.part_number or getattr(p, "hsn_code", "8708") or "-"
            part_rows.append([
                Paragraph(str(idx), td_style),
                Paragraph(p.description, td_bold if is_appr else td_style),
                Paragraph(p_no, td_style),
                Paragraph(str(p.quantity), td_style),
                Paragraph(p.unit or "pcs", td_style),
                Paragraph(format_inr(p.unit_price), td_right),
                Paragraph(format_inr(p.total) if not is_rej else "(Rejected)", td_right_bold if is_appr else td_right),
            ])
        t_part = Table(part_rows, colWidths=[8 * mm, 72 * mm, 26 * mm, 14 * mm, 14 * mm, 22 * mm, 26 * mm])
        t_part.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
            ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
            ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
            ('PADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(t_part)
        story.append(Spacer(1, 8))

    # 7. Financial Estimate Summary & Terms
    lab_tot = sum(l.total for l in (job_card.labour_items or []) if l.status != "REJECTED")
    parts_tot = sum(p.total for p in (job_card.parts_items or []) if p.status != "REJECTED")
    other_tot = job_card.invoice.other_charges_total if (hasattr(job_card, 'invoice') and job_card.invoice) else 0
    discount_tot = job_card.invoice.discount if (hasattr(job_card, 'invoice') and job_card.invoice) else 0
    grand_tot = max(0, (lab_tot + parts_tot + other_tot) - discount_tot)

    terms_text = (
        "<b>TERMS & CONDITIONS OF WORK:</b><br/>"
        "1. I hereby authorize the diagnosis and repair operations listed above along with required parts.<br/>"
        "2. The workshop is authorized to test-drive the vehicle on roads for inspection at owner's risk.<br/>"
        "3. Workshop is not responsible for loss of cash or valuables left in the vehicle.<br/>"
        "4. Estimates are subject to revision if unforeseen defects are discovered during disassembly.<br/>"
        "5. Vehicles must be collected within 48 hours of service completion notice."
    )

    summary_rows = [
        [Paragraph("ESTIMATED TOTALS", ParagraphStyle("SEst", fontName=FONT_BOLD, fontSize=8.5, textColor=SECONDARY_COLOR)), ""],
        [Paragraph("Labour & Services:", card_label), Paragraph(format_inr(lab_tot), td_right)],
        [Paragraph("Parts & Materials:", card_label), Paragraph(format_inr(parts_tot), td_right)],
    ]
    if other_tot > 0:
        summary_rows.append([Paragraph("Consumables / Other:", card_label), Paragraph(format_inr(other_tot), td_right)])
    if discount_tot > 0:
        summary_rows.append([Paragraph("Discount:", card_label), Paragraph(f"-{format_inr(discount_tot)}", td_right)])
    summary_rows.append([Paragraph("<b>ESTIMATED TOTAL:</b>", ParagraphStyle("ESTT", fontName=FONT_BOLD, fontSize=9, textColor=PRIMARY_COLOR)), Paragraph(f"<b>{format_inr(grand_tot)}</b>", ParagraphStyle("ESTV", fontName=FONT_BOLD, fontSize=10, alignment=2, textColor=SECONDARY_COLOR))])

    t_summary = Table(summary_rows, colWidths=[37 * mm, 37 * mm])
    t_summary.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 0.75, SECONDARY_COLOR),
        ('LINEBELOW', (0,0), (-1,0), 0.5, BORDER_DARK),
        ('LINEABOVE', (0,-1), (-1,-1), 0.5, BORDER_DARK),
        ('PADDING', (0,0), (-1,-1), 2.5),
    ]))

    bottom_block = Table([[Paragraph(terms_text, terms_style), t_summary]], colWidths=[108 * mm, 74 * mm])
    bottom_block.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(bottom_block)
    story.append(Spacer(1, 8))

    # 8. Dual Signatures
    sig_data = [
        [
            Paragraph("<b>CUSTOMER AUTHORIZATION</b><br/><br/>I agree to the estimate and terms stated above.<br/><br/><br/>________________________________________<br/>Customer Signature & Date", ParagraphStyle("SigC", fontName=FONT_REGULAR, fontSize=8, leading=11)),
            Paragraph("<b>WORKSHOP AUTHORIZED SIGNATORY</b><br/><br/>Vehicle received in recorded condition.<br/><br/><br/>________________________________________<br/>Service Advisor / Floor Manager", ParagraphStyle("SigW", fontName=FONT_REGULAR, fontSize=8, leading=11, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=[91 * mm, 91 * mm])
    sig_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FAFAFA")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(KeepTogether(sig_table))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_job_card_technician_pdf(
    job_card: JobCard,
    business_profile: Dict[str, Any]
) -> bytes:
    """Generates a shopfloor clipboard sheet optimized for bay technicians."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TTitle", fontName=FONT_BOLD, fontSize=15, leading=18, textColor=PRIMARY_COLOR)
    sec_title = ParagraphStyle("TSecTitle", fontName=FONT_BOLD, fontSize=10, leading=13, textColor=SECONDARY_COLOR)
    plate_style = ParagraphStyle("TPlate", fontName=FONT_BOLD, fontSize=16, leading=18, alignment=1, textColor=colors.HexColor("#0F172A"))
    tech_badge = ParagraphStyle("TBadge", fontName=FONT_BOLD, fontSize=10, leading=12, alignment=1, textColor=SECONDARY_COLOR)

    label_style = ParagraphStyle("TLabel", fontName=FONT_BOLD, fontSize=8, leading=10, textColor=TEXT_MUTED)
    val_style = ParagraphStyle("TVal", fontName=FONT_REGULAR, fontSize=9, leading=11, textColor=PRIMARY_COLOR)
    th_style = ParagraphStyle("TTH", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=colors.HexColor("#1E293B"))
    td_style = ParagraphStyle("TTD", fontName=FONT_REGULAR, fontSize=8.5, leading=11, textColor=PRIMARY_COLOR)
    check_box = ParagraphStyle("TCheck", fontName=FONT_BOLD, fontSize=10, leading=11, alignment=1, textColor=colors.HexColor("#475569"))

    story = []

    w_name = business_profile.get("name", "PUSHPA RAJ AUTOMOTIVE SERVICES")

    # 1. High-Visibility Bay Header
    veh = job_card.vehicle
    cust = job_card.customer
    reg_plate = veh.registration_number if veh else "N/A"
    tech_name = job_card.assigned_user.full_name if (getattr(job_card, 'assigned_user', None)) else "Unassigned"

    t_plate = Table([[Paragraph(f"<b>[ {reg_plate} ]</b>", plate_style)]], colWidths=[65 * mm])
    t_plate.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FEF08A")), # High-visibility yellow
        ('BOX', (0,0), (-1,-1), 1.5, colors.HexColor("#854D0E")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))

    t_tech = Table([
        [Paragraph("BAY TECHNICIAN", ParagraphStyle("TLab", fontName=FONT_BOLD, fontSize=7.5, alignment=1, textColor=TEXT_MUTED))],
        [Paragraph(f"<b>{tech_name.upper()}</b>", tech_badge)]
    ], colWidths=[45 * mm])
    t_tech.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#EFF6FF")),
        ('BOX', (0,0), (-1,-1), 1, SECONDARY_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))

    top_banner = Table([
        [
            [
                Paragraph(w_name.upper(), title_style),
                Paragraph("WORKSHOP FLOOR & BAY TECHNICIAN JOB SHEET", ParagraphStyle("TSub", fontName=FONT_BOLD, fontSize=9, leading=11, textColor=SECONDARY_COLOR)),
                Paragraph(f"Job Card: <b>#{job_card.job_card_number}</b> &bull; Date: <b>{format_date(job_card.date)}</b> {format_time(job_card.time_in)}", val_style)
            ],
            t_plate,
            t_tech
        ]
    ], colWidths=[72 * mm, 65 * mm, 45 * mm])
    top_banner.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(top_banner)
    story.append(HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceBefore=2, spaceAfter=8))

    # 2. Vehicle & Intake Quick Specs Bar
    veh_model = f"{veh.make or ''} {veh.model or ''} {veh.variant or ''}".strip() if veh else "Vehicle"
    specs_data = [
        [
            Paragraph("Vehicle Model:", label_style), Paragraph(f"<b>{veh_model}</b>", val_style),
            Paragraph("Odometer:", label_style), Paragraph(f"<b>{job_card.odometer:,} km</b>", val_style),
            Paragraph("Fuel Level:", label_style), Paragraph(f"<b>{job_card.fuel_level or 'N/A'}</b>", val_style),
            Paragraph("Customer:", label_style), Paragraph(f"<b>{cust.name if cust else '-'}</b> ({cust.phone if cust else ''})", val_style),
        ]
    ]
    specs_table = Table(specs_data, colWidths=[20 * mm, 38 * mm, 16 * mm, 24 * mm, 16 * mm, 20 * mm, 16 * mm, 32 * mm])
    specs_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_DARK),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(specs_table)
    story.append(Spacer(1, 8))

    # 3. Complaints & Rectification Checklist (Mechanic action lines)
    story.append(Paragraph("1. CUSTOMER REPORTED COMPLAINTS & RECTIFICATION CHECKLIST", sec_title))
    comp_rows = [[
        Paragraph("Done", th_style),
        Paragraph("#", th_style),
        Paragraph("Reported Problem / Work Description", th_style),
        Paragraph("Technician Root Cause & Action Taken", th_style)
    ]]
    for idx, c in enumerate(job_card.complaints or [], start=1):
        comp_rows.append([
            Paragraph("[  ]", check_box),
            Paragraph(f"<b>{idx}</b>", td_style),
            Paragraph(c.description, td_style),
            Paragraph("<br/><br/>____________________________________________________", ParagraphStyle("RL", fontName=FONT_REGULAR, fontSize=7, textColor=TEXT_MUTED))
        ])
    if not job_card.complaints:
        comp_rows.append([
            Paragraph("[  ]", check_box), "1",
            Paragraph("General periodic service, oil change, and 30-point checkup", td_style),
            Paragraph("<br/><br/>____________________________________________________", ParagraphStyle("RL", fontName=FONT_REGULAR, fontSize=7, textColor=TEXT_MUTED))
        ])

    t_comp = Table(comp_rows, colWidths=[12 * mm, 8 * mm, 80 * mm, 82 * mm])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 0.75, BORDER_DARK),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 4),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 8))

    # 4. Multi-Point Safety & Technical Inspection Grid
    story.append(Paragraph("2. MULTI-POINT TECHNICAL INSPECTION & FLUID LEVELS", sec_title))
    default_checks = [
        ("Engine & Drive Belts", "Check belt tension, oil leakage & abnormal noise"),
        ("Brake System & Pads", "Check front/rear pads, discs & brake fluid DOT4"),
        ("Battery & Terminals", "Check terminal corrosion, specific gravity & 12V voltage"),
        ("Tyres & Wheel Pressure", "Check tyre tread depth (mm), wear pattern & PSI"),
        ("Suspension & Steering", "Check bush play, shock absorbers & tie rods"),
        ("Electricals & Lights", "Check headlights, tail/brake lights, indicators & horn"),
        ("Fluids & Coolant", "Top-up coolant, windshield washer & power steering oil"),
        ("AC & Air Filter", "Inspect blower flow, cabin filter & AC condenser")
    ]
    
    # Merge existing inspections if recorded
    insp_map = {i.category: i for i in (job_card.inspections or [])}
    insp_grid_data = [[
        Paragraph("Check", th_style), Paragraph("Inspection Item", th_style), Paragraph("Standard Test Procedure", th_style),
        Paragraph("Check", th_style), Paragraph("Inspection Item", th_style), Paragraph("Standard Test Procedure", th_style)
    ]]

    for i in range(0, len(default_checks), 2):
        item1, desc1 = default_checks[i]
        st1 = insp_map.get(item1)
        c1_box = "[ OK ]" if (st1 and st1.status == "OK") else ("[ ATTN ]" if (st1 and st1.status == "NEEDS_ATTENTION") else "[   ]")
        
        row = [
            Paragraph(c1_box, check_box),
            Paragraph(f"<b>{item1}</b>", td_style),
            Paragraph(desc1, ParagraphStyle("P1", fontName=FONT_REGULAR, fontSize=7, textColor=TEXT_MUTED))
        ]

        if i + 1 < len(default_checks):
            item2, desc2 = default_checks[i+1]
            st2 = insp_map.get(item2)
            c2_box = "[ OK ]" if (st2 and st2.status == "OK") else ("[ ATTN ]" if (st2 and st2.status == "NEEDS_ATTENTION") else "[   ]")
            row.extend([
                Paragraph(c2_box, check_box),
                Paragraph(f"<b>{item2}</b>", td_style),
                Paragraph(desc2, ParagraphStyle("P2", fontName=FONT_REGULAR, fontSize=7, textColor=TEXT_MUTED))
            ])
        else:
            row.extend(["", "", ""])
        insp_grid_data.append(row)

    t_insp = Table(insp_grid_data, colWidths=[14 * mm, 36 * mm, 41 * mm, 14 * mm, 36 * mm, 41 * mm])
    t_insp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 0.75, BORDER_DARK),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_insp)
    story.append(Spacer(1, 8))

    # 5. Parts Requisition & Stores Issuance
    story.append(Paragraph("3. PARTS REQUISITION & STORE ISSUANCE", sec_title))
    parts_rows = [[
        Paragraph("Issued", th_style),
        Paragraph("#", th_style),
        Paragraph("Part Description", th_style),
        Paragraph("Part Number", th_style),
        Paragraph("Qty", th_style),
        Paragraph("Unit", th_style),
        Paragraph("Old Part Replaced?", th_style)
    ]]
    for idx, p in enumerate(job_card.parts_items or [], start=1):
        is_used = (p.status == "USED")
        parts_rows.append([
            Paragraph("[ X ]" if is_used else "[  ]", check_box),
            Paragraph(str(idx), td_style),
            Paragraph(f"<b>{p.description}</b>", td_style),
            Paragraph(p.part_number or "-", td_style),
            Paragraph(str(p.quantity), td_style),
            Paragraph(p.unit or "pcs", td_style),
            Paragraph("[  ] Yes  [  ] No", ParagraphStyle("CR", fontName=FONT_REGULAR, fontSize=7.5, textColor=TEXT_MUTED))
        ])
    if not job_card.parts_items:
        parts_rows.append([
            Paragraph("[  ]", check_box), "1",
            Paragraph("Parts requisition as required during service", td_style),
            "-", "-", "-", "[  ] Yes  [  ] No"
        ])
    t_parts = Table(parts_rows, colWidths=[14 * mm, 8 * mm, 68 * mm, 32 * mm, 14 * mm, 16 * mm, 30 * mm])
    t_parts.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#F1F5F9")),
        ('BOX', (0,0), (-1,-1), 0.75, BORDER_DARK),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('PADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(t_parts)
    story.append(Spacer(1, 8))

    # 6. Mechanic Notes & Final Quality Inspection Sign-off
    qc_data = [
        [
            Paragraph(
                "<b>BAY TECHNICIAN NOTES & OBSERVATIONS:</b><br/><br/>"
                "&bull; Battery Voltage (Resting): ________ V  |  Alternator Charging: ________ V<br/>"
                "&bull; Front Tyre Pressure: ________ PSI  |  Rear Tyre Pressure: ________ PSI<br/>"
                "&bull; Additional findings / Recommended work for next service:<br/>"
                "__________________________________________________________________________________",
                ParagraphStyle("BN", fontName=FONT_REGULAR, fontSize=8, leading=12, textColor=PRIMARY_COLOR)
            )
        ],
        [
            Table([
                [
                    Paragraph("<b>ROAD TEST COMPLETED:</b> [  ] YES   [  ] NO<br/>Tested by: ________________________", ParagraphStyle("Q1", fontName=FONT_REGULAR, fontSize=8, leading=11)),
                    Paragraph("<b>FINAL QC INSPECTION:</b> [  ] PASS   [  ] REWORK<br/>Inspected by: ________________________", ParagraphStyle("Q2", fontName=FONT_REGULAR, fontSize=8, leading=11)),
                    Paragraph("<b>TECHNICIAN SIGN-OFF:</b><br/>Sign: _________________ Time Out: ____", ParagraphStyle("Q3", fontName=FONT_REGULAR, fontSize=8, leading=11, alignment=2))
                ]
            ], colWidths=[60 * mm, 60 * mm, 60 * mm])
        ]
    ]
    t_qc = Table(qc_data, colWidths=[182 * mm])
    t_qc.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#475569")),
        ('LINEBELOW', (0,0), (-1,0), 0.5, BORDER_DARK),
        ('PADDING', (0,0), (-1,-1), 4.5),
    ]))
    story.append(KeepTogether(t_qc))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_job_card_pdf(
    job_card: JobCard,
    business_profile: Dict[str, Any],
    template: str = "detailed"
) -> bytes:
    """Dispatches to the requested Job Card template ('detailed' work order or 'technician' bay sheet)."""
    if template and template.lower() in ("technician", "bay", "baysheet", "tech"):
        return generate_job_card_technician_pdf(job_card, business_profile)
    return generate_job_card_detailed_pdf(job_card, business_profile)

