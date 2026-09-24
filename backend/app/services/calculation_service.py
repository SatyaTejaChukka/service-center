from decimal import Decimal, ROUND_HALF_UP
from typing import Sequence, Optional
from pydantic import BaseModel

class LineItemCalc(BaseModel):
    quantity: float
    unit_price: int  # in paise
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
    is_draft: bool = False
) -> InvoiceCalculationResult:
    """
    Authoritative single-source-of-truth calculation engine.
    - Finalized / Billable: Only APPROVED or USED parts and APPROVED or DONE labour lines contribute.
    - Estimated: All active non-REJECTED items contribute to estimated totals.
    - When is_draft=True and no lines are approved yet (estimate phase), draft invoice totals reflect the active estimate.
    """
    if discount_paise < 0:
        raise ValueError("Discount cannot be negative")
    if tax_paise < 0:
        raise ValueError("Tax cannot be negative")

    # 1. Approved Parts & Labour totals
    approved_parts_total = 0
    estimated_parts_total = 0
    for p in parts:
        line_tot = calculate_line_total(p.quantity, p.unit_price)
        if p.status in ("APPROVED", "USED"):
            approved_parts_total += line_tot
        if p.status != "REJECTED":
            estimated_parts_total += line_tot

    approved_labour_total = 0
    estimated_labour_total = 0
    for l in labour:
        line_tot = calculate_line_total(l.quantity, l.unit_price)
        if l.status in ("APPROVED", "DONE"):
            approved_labour_total += line_tot
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

    # 5. Grand totals
    approved_grand_total = max(0, approved_subtotal - effective_discount + tax_paise + round_off_paise)
    estimated_grand_total = max(0, estimated_subtotal - estimated_discount + tax_paise + round_off_paise)

    # 6. For draft invoices in quotation/inspection phase where nothing has been approved yet,
    # draft totals display the estimate so advisors and customers never see ₹0.00
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

    # 7. Payments net of reversals
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
        tax_total=tax_paise,
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
