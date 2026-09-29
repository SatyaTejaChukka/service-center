from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence, Optional
from pydantic import BaseModel

class LineItemCalc(BaseModel):
    quantity: float
    unit_price: int  # in paise
    cost_price: int = 0  # in paise (purchase cost / technician payout)
    gst_rate: int = 0  # percentage, e.g. 18
    hsn_or_sac: Optional[str] = None
    status: str      # RECOMMENDED, APPROVED, REJECTED, USED, DONE

class OtherChargeCalc(BaseModel):
    amount: int      # in paise

class PaymentCalc(BaseModel):
    amount: int      # in paise
    is_reversal: bool = False

class InvoiceCalculationResult(BaseModel):
    # Authoritative billable totals (APPROVED/USED lines only)
    parts_total: int         # paise
    labour_total: int        # paise
    other_charges_total: int # paise
    subtotal: int            # paise
    discount: int            # paise
    tax_total: int           # paise
    taxable_amount: int      # paise
    cgst_amount: int         # paise
    sgst_amount: int         # paise
    igst_amount: int         # paise
    total_cost: int          # paise
    gross_profit: int        # paise
    profit_margin_percent: float
    round_off: int           # paise
    grand_total: int         # paise
    amount_paid: int         # paise
    balance_due: int         # paise
    payment_status: str      # UNPAID, PARTIALLY_PAID, PAID

    # Authoritative estimate totals (all active non-REJECTED lines)
    estimated_parts_total: int   # paise
    estimated_labour_total: int  # paise
    estimated_subtotal: int      # paise
    estimated_grand_total: int   # paise

def calculate_line_total(quantity: float, unit_price_paise: int) -> int:
    """
    Computes quantity * unit_price rounded half-up to nearest paisa.
    Used for fractional quantities (e.g. 3.5 litres).
    """
    if quantity < 0 or unit_price_paise < 0:
        raise ValueError("Quantity and price must be non-negative")
    
    qty_dec = Decimal(str(quantity))
    price_dec = Decimal(str(unit_price_paise))
    total_dec = (qty_dec * price_dec).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(total_dec)

def calculate_invoice_totals(
    parts: Sequence[LineItemCalc],
    labour: Sequence[LineItemCalc],
    other_charges: Sequence[OtherChargeCalc],
    discount_paise: int = 0,
    tax_paise: int = 0,
    round_off_paise: int = 0,
    payments: Optional[Sequence[PaymentCalc]] = None,
    is_draft: bool = False,
    is_interstate: bool = False
) -> InvoiceCalculationResult:
    """
    Authoritative single-source-of-truth calculation engine.
    - Finalized / Billable: Only APPROVED or USED parts and APPROVED or DONE labour lines contribute.
    - Estimated: All active non-REJECTED items contribute to estimated totals.
    - When is_draft=True and no lines are approved yet (estimate phase), draft invoice totals reflect the active estimate.
    - GST: Computes intra-state (CGST + SGST) or inter-state (IGST).
    - Profitability: Computes parts cost, labour cost, total cost, gross profit, and margin %.
    """
    if discount_paise < 0:
        raise ValueError("Discount cannot be negative")
    if tax_paise < 0:
        raise ValueError("Tax cannot be negative")

    # 1. Approved Parts & Labour totals
    approved_parts_total = 0
    estimated_parts_total = 0
    parts_cost_total = 0
    calculated_parts_tax = 0

    for p in parts:
        line_tot = calculate_line_total(p.quantity, p.unit_price)
        line_cost = calculate_line_total(p.quantity, p.cost_price)

        if p.status in ("APPROVED", "USED"):
            approved_parts_total += line_tot
            parts_cost_total += line_cost
            if p.gst_rate > 0:
                calculated_parts_tax += int(Decimal(str(line_tot * p.gst_rate)) / Decimal("100"))

        if p.status != "REJECTED":
            estimated_parts_total += line_tot

    approved_labour_total = 0
    estimated_labour_total = 0
    labour_cost_total = 0
    calculated_labour_tax = 0

    for l in labour:
        line_tot = calculate_line_total(l.quantity, l.unit_price)
        line_cost = calculate_line_total(l.quantity, l.cost_price)

        if l.status in ("APPROVED", "DONE"):
            approved_labour_total += line_tot
            labour_cost_total += line_cost
            if l.gst_rate > 0:
                calculated_labour_tax += int(Decimal(str(line_tot * l.gst_rate)) / Decimal("100"))

        if l.status != "REJECTED":
            estimated_labour_total += line_tot

    # 2. Other charges
    other_charges_total = 0
    for o in other_charges:
        if o.amount < 0:
            raise ValueError("Other charge amount cannot be negative")
        other_charges_total += o.amount

    # 3. Subtotals
    approved_subtotal = approved_parts_total + approved_labour_total + other_charges_total
    estimated_subtotal = estimated_parts_total + estimated_labour_total + other_charges_total

    # 4. Discounts
    effective_discount = min(discount_paise, approved_subtotal)
    estimated_discount = min(discount_paise, estimated_subtotal)

    # 5. Taxable Amount & Taxes
    taxable_amount = max(0, approved_subtotal - effective_discount)

    # If tax_paise is explicitly passed, use it; otherwise use calculated line taxes
    effective_tax = tax_paise if tax_paise > 0 else (calculated_parts_tax + calculated_labour_tax)

    if is_interstate:
        igst_amount = effective_tax
        cgst_amount = 0
        sgst_amount = 0
    else:
        cgst_amount = effective_tax // 2
        sgst_amount = effective_tax - cgst_amount
        igst_amount = 0

    # 6. Costs & Gross Margin
    total_cost = parts_cost_total + labour_cost_total
    gross_profit = taxable_amount - total_cost
    margin_percent = round((float(gross_profit) / float(taxable_amount) * 100), 2) if taxable_amount > 0 else 0.0

    # 7. Grand totals
    approved_grand_total = max(0, taxable_amount + effective_tax + round_off_paise)
    estimated_grand_total = max(0, estimated_subtotal - estimated_discount + effective_tax + round_off_paise)

    # For draft invoices in quotation/inspection phase where nothing has been approved yet:
    if is_draft and approved_grand_total == 0 and estimated_grand_total > 0:
        parts_total = estimated_parts_total
        labour_total = estimated_labour_total
        subtotal = estimated_subtotal
        disp_discount = estimated_discount
        grand_total = estimated_grand_total
    else:
        parts_total = approved_parts_total
        labour_total = approved_labour_total
        subtotal = approved_subtotal
        disp_discount = effective_discount
        grand_total = approved_grand_total

    # 8. Payments net of reversals
    amount_paid = 0
    if payments:
        for pay in payments:
            if pay.is_reversal:
                amount_paid -= pay.amount
            else:
                amount_paid += pay.amount

    amount_paid = max(0, amount_paid)
    balance_due = max(0, grand_total - amount_paid)

    if amount_paid == 0:
        payment_status = "UNPAID"
    elif amount_paid < grand_total:
        payment_status = "PARTIALLY_PAID"
    else:
        payment_status = "PAID"

    return InvoiceCalculationResult(
        parts_total=parts_total,
        labour_total=labour_total,
        other_charges_total=other_charges_total,
        subtotal=subtotal,
        discount=disp_discount,
        tax_total=effective_tax,
        taxable_amount=taxable_amount,
        cgst_amount=cgst_amount,
        sgst_amount=sgst_amount,
        igst_amount=igst_amount,
        total_cost=total_cost,
        gross_profit=gross_profit,
        profit_margin_percent=margin_percent,
        round_off=round_off_paise,
        grand_total=grand_total,
        amount_paid=amount_paid,
        balance_due=balance_due,
        payment_status=payment_status,
        estimated_parts_total=estimated_parts_total,
        estimated_labour_total=estimated_labour_total,
        estimated_subtotal=estimated_subtotal,
        estimated_grand_total=estimated_grand_total
    )
