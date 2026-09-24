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
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
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
    story.append(Paragraph("<b>TAX INVOICE / SERVICE BILL</b>", subtitle_style))
    story.append(Spacer(1, 10))

    # 2. Meta Grid (Invoice #, Date, Customer, Vehicle)
    jc = invoice.job_card
    cust = jc.customer if jc else None
    veh = jc.vehicle if jc else None

    meta_data = [
        [
            Paragraph(f"<b>Invoice No:</b> {invoice.invoice_number or 'DRAFT'}", normal_style),
            Paragraph(f"<b>Date:</b> {format_date(invoice.finalized_at or invoice.created_at)}", right_style)
        ],
        [
            Paragraph(f"<b>Job Card:</b> {jc.job_card_number if jc else ''}", normal_style),
            Paragraph(f"<b>Payment Status:</b> {invoice.payment_status}", right_bold)
        ],
        [
            Paragraph(f"<b>Customer:</b> {cust.name if cust else ''} &bull; {cust.phone if cust else ''}", normal_style),
            Paragraph(f"<b>Vehicle:</b> {veh.make if veh else ''} {veh.model if veh else ''}", right_style)
        ],
        [
            Paragraph(f"<b>Reg No:</b> {veh.registration_number if veh else ''}", normal_style),
            Paragraph(f"<b>Odometer:</b> {jc.odometer if jc else 0:,} km", right_style)
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

    # 3. Parts Table (Approved / Used only)
    approved_parts = [p for p in jc.parts_items if p.status in ("APPROVED", "USED")] if jc else []
    if approved_parts:
        story.append(Paragraph("<b>PARTS / MATERIALS</b>", bold_style))
        parts_data = [
            [Paragraph("<b>#</b>", bold_style), Paragraph("<b>Description</b>", bold_style), Paragraph("<b>Qty</b>", right_bold), Paragraph("<b>Rate</b>", right_bold), Paragraph("<b>Amount</b>", right_bold)]
        ]
        for idx, p in enumerate(approved_parts, start=1):
            parts_data.append([
                Paragraph(str(idx), normal_style),
                Paragraph(f"{p.description}{f' ({p.part_number})' if p.part_number else ''}", normal_style),
                Paragraph(f"{p.quantity:g} {p.unit}", right_style),
                Paragraph(format_inr(p.unit_price), right_style),
                Paragraph(format_inr(p.total), right_style)
            ])
        parts_data.append([
            "", Paragraph("<b>Parts Total</b>", bold_style), "", "", Paragraph(format_inr(invoice.parts_total), right_bold)
        ])
        
        parts_table = Table(parts_data, colWidths=[8 * mm, 82 * mm, 25 * mm, 30 * mm, 35 * mm])
        parts_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#1A1D22")),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor("#E2E8F0")),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#1A1D22")),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(parts_table)
        story.append(Spacer(1, 10))

    # 4. Labour Table (Approved / Done only)
    approved_labour = [l for l in jc.labour_items if l.status in ("APPROVED", "DONE")] if jc else []
    if approved_labour:
        story.append(Paragraph("<b>LABOUR & SERVICES</b>", bold_style))
        labour_data = [
            [Paragraph("<b>#</b>", bold_style), Paragraph("<b>Description</b>", bold_style), Paragraph("<b>Qty</b>", right_bold), Paragraph("<b>Rate</b>", right_bold), Paragraph("<b>Amount</b>", right_bold)]
        ]
        for idx, l in enumerate(approved_labour, start=1):
            labour_data.append([
                Paragraph(str(idx), normal_style),
                Paragraph(l.description, normal_style),
                Paragraph(f"{l.quantity:g}", right_style),
                Paragraph(format_inr(l.unit_price), right_style),
                Paragraph(format_inr(l.total), right_style)
            ])
        labour_data.append([
            "", Paragraph("<b>Labour Total</b>", bold_style), "", "", Paragraph(format_inr(invoice.labour_total), right_bold)
        ])
        
        labour_table = Table(labour_data, colWidths=[8 * mm, 82 * mm, 25 * mm, 30 * mm, 35 * mm])
        labour_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor("#1A1D22")),
            ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor("#E2E8F0")),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor("#1A1D22")),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ('PADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(labour_table)
        story.append(Spacer(1, 10))

    # 5. Other Charges, Discount, and Totals
    summary_rows = [
        [Paragraph("Parts Total:", normal_style), Paragraph(format_inr(invoice.parts_total), right_style)],
        [Paragraph("Labour Total:", normal_style), Paragraph(format_inr(invoice.labour_total), right_style)],
    ]
    if invoice.other_charges_total > 0:
        summary_rows.append([Paragraph("Other Charges / Consumables:", normal_style), Paragraph(format_inr(invoice.other_charges_total), right_style)])
    if invoice.discount > 0:
        summary_rows.append([Paragraph("Discount:", normal_style), Paragraph(f"-{format_inr(invoice.discount)}", right_style)])
    if invoice.tax_total > 0:
        summary_rows.append([Paragraph("GST / Tax:", normal_style), Paragraph(format_inr(invoice.tax_total), right_style)])
    
    summary_rows.append([
        Paragraph("<b>GRAND TOTAL:</b>", bold_style),
        Paragraph(f"<b>{format_inr(invoice.grand_total)}</b>", right_bold)
    ])

    # Payment settlement line
    amount_paid = max(0, sum(-p.amount if p.is_reversal else p.amount for p in invoice.payments)) if invoice.payments else 0
    balance = max(0, invoice.grand_total - amount_paid)
    summary_rows.append([Paragraph("Amount Paid:", normal_style), Paragraph(format_inr(amount_paid), right_style)])
    summary_rows.append([Paragraph("<b>Balance Due:</b>", bold_style), Paragraph(f"<b>{format_inr(balance)}</b>", right_bold)])

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

    return pdf_bytes


def generate_job_card_pdf(
    job_card: JobCard,
    business_profile: Dict[str, Any]
) -> bytes:
    """Generates an A4 Job Card Intake document for workshop and customer."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("JCTitle", fontName=FONT_BOLD, fontSize=16, leading=19, alignment=1)
    subtitle_style = ParagraphStyle("JCSub", fontName=FONT_REGULAR, fontSize=10, leading=13, alignment=1)
    bold_style = ParagraphStyle("JCBold", fontName=FONT_BOLD, fontSize=9, leading=12)
    normal_style = ParagraphStyle("JCNormal", fontName=FONT_REGULAR, fontSize=9, leading=12)
    right_style = ParagraphStyle("JCRight", fontName=FONT_REGULAR, fontSize=9, leading=12, alignment=2)

    story = []
    w_name = business_profile.get("name", "PUSHPA RAJ AUTOMOTIVE SERVICES")
    w_phone = business_profile.get("phone", "9876543210")
    
    story.append(Paragraph(w_name.upper(), title_style))
    story.append(Paragraph(f"Phone: {w_phone} &bull; <b>WORKSHOP JOB CARD</b>", subtitle_style))
    story.append(Spacer(1, 10))

    cust = job_card.customer
    veh = job_card.vehicle

    meta_data = [
        [
            Paragraph(f"<b>Job Card No:</b> {job_card.job_card_number}", bold_style),
            Paragraph(f"<b>Date:</b> {format_date(job_card.date)}", right_style)
        ],
        [
            Paragraph(f"<b>Status:</b> {job_card.status}", normal_style),
            Paragraph(f"<b>Time In:</b> {job_card.time_in.strftime('%I:%M %p') if job_card.time_in else ''}", right_style)
        ],
        [
            Paragraph(f"<b>Customer:</b> {cust.name if cust else ''} ({cust.phone if cust else ''})", normal_style),
            Paragraph(f"<b>Vehicle:</b> {veh.make if veh else ''} {veh.model if veh else ''}", right_style)
        ],
        [
            Paragraph(f"<b>Reg No:</b> {veh.registration_number if veh else ''}", normal_style),
            Paragraph(f"<b>Odometer:</b> {job_card.odometer:,} km &bull; <b>Fuel:</b> {job_card.fuel_level or 'N/A'}", right_style)
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

    # Complaints
    story.append(Paragraph("<b>CUSTOMER COMPLAINTS / REPORTED ISSUES</b>", bold_style))
    complaints_data = [[Paragraph("<b>#</b>", bold_style), Paragraph("<b>Complaint Details</b>", bold_style)]]
    for c in job_card.complaints:
        complaints_data.append([Paragraph(str(c.sequence), normal_style), Paragraph(c.description, normal_style)])
    if not job_card.complaints:
        complaints_data.append(["", Paragraph("None recorded", normal_style)])
    
    comp_table = Table(complaints_data, colWidths=[10 * mm, 170 * mm])
    comp_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor("#1A1D22")),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(comp_table)
    story.append(Spacer(1, 10))

    # Inspection
    story.append(Paragraph("<b>INSPECTION & DIAGNOSIS</b>", bold_style))
    insp_data = [[Paragraph("<b>Category</b>", bold_style), Paragraph("<b>Status</b>", bold_style), Paragraph("<b>Notes / Findings</b>", bold_style)]]
    for insp in job_card.inspections:
        status_color = colors.HexColor("#B24A34") if insp.status == "NEEDS_ATTENTION" else colors.HexColor("#3E7A52")
        insp_data.append([
            Paragraph(insp.category, normal_style),
            Paragraph(f"<b>{insp.status}</b>", ParagraphStyle("InspSt", fontName=FONT_BOLD, fontSize=8.5, textColor=status_color)),
            Paragraph(insp.notes or "-", normal_style)
        ])
    if not job_card.inspections:
        insp_data.append(["-", "None recorded", "-"])

    insp_table = Table(insp_data, colWidths=[40 * mm, 40 * mm, 100 * mm])
    insp_table.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,0), 1, colors.HexColor("#1A1D22")),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(insp_table)
    story.append(Spacer(1, 14))

    # Signature Block
    sig_data = [
        [
            Paragraph("Customer Signature & Date<br/><br/><br/>________________________", normal_style),
            Paragraph("Service Advisor / Technician<br/><br/><br/>________________________", right_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[90 * mm, 90 * mm])
    story.append(sig_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
