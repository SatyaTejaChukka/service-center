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
    payments: Optional[Sequence[PaymentCalc]] = None
) -> InvoiceCalculationResult:
    """
    Authoritative single-source-of-truth calculation engine (The Golden Rule).
    Only APPROVED or USED parts and APPROVED or DONE labour lines contribute to totals.
    REJECTED or RECOMMENDED lines are strictly excluded from totals.
    """
    if discount_paise < 0:
        raise ValueError("Discount cannot be negative")
    if tax_paise < 0:
        raise ValueError("Tax cannot be negative")

    # Parts total
    parts_total = 0
    for p in parts:
        if p.status in ("APPROVED", "USED"):
            parts_total += calculate_line_total(p.quantity, p.unit_price)

    # Labour total
    labour_total = 0
    for l in labour:
        if l.status in ("APPROVED", "DONE"):
            labour_total += calculate_line_total(l.quantity, l.unit_price)

    # Other charges
    other_charges_total = 0
    for o in other_charges:
        if o.amount < 0:
            raise ValueError("Other charge amount cannot be negative")
        other_charges_total += o.amount

    subtotal = parts_total + labour_total + other_charges_total

    # Discount cannot exceed subtotal
    effective_discount = min(discount_paise, subtotal)

    # Grand total
    grand_total = max(0, subtotal - effective_discount + tax_paise + round_off_paise)

    # Payments net of reversals
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
        discount=effective_discount,
        tax_total=tax_paise,
        round_off=round_off_paise,
        grand_total=grand_total,
        amount_paid=amount_paid,
        balance_due=balance_due,
        payment_status=payment_status
    )
