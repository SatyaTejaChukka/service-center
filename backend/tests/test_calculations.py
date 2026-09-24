import pytest
from app.services.calculation_service import (
    calculate_invoice_totals, calculate_line_total,
    LineItemCalc, OtherChargeCalc, PaymentCalc
)

def test_appendix_b_creta_scenario():
    """
    Exact verification of PRD Appendix B: Example Invoice Calculation.
    """
    parts = [
        LineItemCalc(quantity=1.0, unit_price=250000, status="APPROVED"),  # Engine Oil ₹2,500
        LineItemCalc(quantity=1.0, unit_price=50000, status="APPROVED"),   # Oil Filter ₹500
        LineItemCalc(quantity=1.0, unit_price=280000, status="APPROVED"),  # Brake Pad ₹2,800
        LineItemCalc(quantity=1.0, unit_price=80000, status="REJECTED"),   # Air Filter ₹800 (REJECTED)
    ]
    labour = [
        LineItemCalc(quantity=1.0, unit_price=100000, status="APPROVED"),  # General Service ₹1,000
        LineItemCalc(quantity=1.0, unit_price=50000, status="APPROVED"),   # Brake Service ₹500
    ]
    other_charges = [
        OtherChargeCalc(amount=20000)  # Consumables ₹200
    ]
    discount_paise = 10000  # ₹100

    res = calculate_invoice_totals(
        parts=parts,
        labour=labour,
        other_charges=other_charges,
        discount_paise=discount_paise
    )

    assert res.parts_total == 580000, f"Expected parts_total 580000 paise (₹5,800), got {res.parts_total}"
    assert res.labour_total == 150000, f"Expected labour_total 150000 paise (₹1,500), got {res.labour_total}"
    assert res.other_charges_total == 20000, f"Expected other_charges_total 20000 paise (₹200), got {res.other_charges_total}"
    assert res.subtotal == 750000, f"Expected subtotal 750000 paise (₹7,500), got {res.subtotal}"
    assert res.discount == 10000, f"Expected discount 10000 paise (₹100), got {res.discount}"
    assert res.grand_total == 740000, f"Expected grand_total 740000 paise (₹7,400), got {res.grand_total}"
    assert res.payment_status == "UNPAID"

def test_appendix_b_later_rejection():
    """
    Appendix B: Customer later also rejects the Brake Pad before finalisation.
    """
    parts = [
        LineItemCalc(quantity=1.0, unit_price=250000, status="APPROVED"),  # Engine Oil ₹2,500
        LineItemCalc(quantity=1.0, unit_price=50000, status="APPROVED"),   # Oil Filter ₹500
        LineItemCalc(quantity=1.0, unit_price=280000, status="REJECTED"),  # Brake Pad ₹2,800 (REJECTED)
        LineItemCalc(quantity=1.0, unit_price=80000, status="REJECTED"),   # Air Filter ₹800 (REJECTED)
    ]
    labour = [
        LineItemCalc(quantity=1.0, unit_price=100000, status="APPROVED"),  # General Service ₹1,000
        LineItemCalc(quantity=1.0, unit_price=50000, status="APPROVED"),   # Brake Service ₹500
    ]
    other_charges = [
        OtherChargeCalc(amount=20000)  # Consumables ₹200
    ]
    discount_paise = 10000  # ₹100

    res = calculate_invoice_totals(
        parts=parts,
        labour=labour,
        other_charges=other_charges,
        discount_paise=discount_paise
    )

    assert res.parts_total == 300000, f"Expected parts_total 300000 paise (₹3,000), got {res.parts_total}"
    assert res.labour_total == 150000, f"Expected labour_total 150000 paise (₹1,500), got {res.labour_total}"
    assert res.other_charges_total == 20000
    assert res.subtotal == 470000, f"Expected subtotal 470000 paise (₹4,700), got {res.subtotal}"
    assert res.grand_total == 460000, f"Expected grand_total 460000 paise (₹4,600), got {res.grand_total}"

def test_fractional_quantity_fluid():
    """
    FR-PRT-004: Fractional quantities for fluids (e.g. 3.5 litres).
    """
    # 3.5 litres of synthetic engine oil at ₹650.00/litre
    tot = calculate_line_total(quantity=3.5, unit_price_paise=65000)
    assert tot == 227500, f"Expected 227500 paise (₹2,275.00), got {tot}"

def test_payments_and_status_transitions():
    """
    FR-PAY-003, FR-PAY-004: Partial payments, full settlement, reversals.
    """
    parts = [LineItemCalc(quantity=1.0, unit_price=100000, status="APPROVED")]
    labour = []
    other_charges = []

    # Grand total: ₹1,000.00 (100000 paise)
    res_unpaid = calculate_invoice_totals(parts, labour, other_charges, discount_paise=0)
    assert res_unpaid.grand_total == 100000
    assert res_unpaid.balance_due == 100000
    assert res_unpaid.payment_status == "UNPAID"

    # Partial payment of ₹400
    pays = [PaymentCalc(amount=40000)]
    res_partial = calculate_invoice_totals(parts, labour, other_charges, payments=pays)
    assert res_partial.amount_paid == 40000
    assert res_partial.balance_due == 60000
    assert res_partial.payment_status == "PARTIALLY_PAID"

    # Full payment (+₹600)
    pays.append(PaymentCalc(amount=60000))
    res_paid = calculate_invoice_totals(parts, labour, other_charges, payments=pays)
    assert res_paid.amount_paid == 100000
    assert res_paid.balance_due == 0
    assert res_paid.payment_status == "PAID"

    # Reversal of ₹600
    pays.append(PaymentCalc(amount=60000, is_reversal=True))
    res_reversed = calculate_invoice_totals(parts, labour, other_charges, payments=pays)
    assert res_reversed.amount_paid == 40000
    assert res_reversed.balance_due == 60000
    assert res_reversed.payment_status == "PARTIALLY_PAID"

def test_draft_invoice_estimate_totals():
    """
    Verifies that in draft quotation phase, recommended items populate estimate totals
    and are not shown as ₹0, while rejected items are strictly excluded.
    """
    parts = [
        LineItemCalc(quantity=1.0, unit_price=70000, status="RECOMMENDED"),  # Wiper blade ₹700
        LineItemCalc(quantity=1.0, unit_price=120000, status="REJECTED"),   # Horn upgrade ₹1,200 (REJECTED)
    ]
    labour = [
        LineItemCalc(quantity=1.0, unit_price=80000, status="RECOMMENDED"),  # Wheel balancing ₹800
        LineItemCalc(quantity=1.0, unit_price=75000, status="RECOMMENDED"),  # Car wash ₹750
    ]
    other_charges = []

    # In draft mode with no approvals yet:
    res = calculate_invoice_totals(parts, labour, other_charges, is_draft=True)
    assert res.estimated_parts_total == 70000
    assert res.estimated_labour_total == 155000
    assert res.estimated_grand_total == 225000
    assert res.grand_total == 225000
    assert res.parts_total == 70000
    assert res.labour_total == 155000

    # In finalized mode (without customer approval):
    res_final = calculate_invoice_totals(parts, labour, other_charges, is_draft=False)
    assert res_final.grand_total == 0
    assert res_final.estimated_grand_total == 225000

