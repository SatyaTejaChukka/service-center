from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import JobCard, Invoice

def generate_job_card_number(db: Session, year: int = None) -> str:
    """Generates sequential JC-YYYY-NNNNN gap-tolerant number for given year."""
    if year is None:
        year = datetime.utcnow().year
    
    prefix = f"JC-{year}-"
    # Find latest number with this prefix
    last_jc = db.query(JobCard.job_card_number).filter(
        JobCard.job_card_number.like(f"{prefix}%")
    ).order_by(JobCard.job_card_number.desc()).first()

    if last_jc and last_jc[0]:
        try:
            last_seq = int(last_jc[0].split("-")[-1])
            next_seq = last_seq + 1
        except (ValueError, IndexError):
            next_seq = 1
    else:
        next_seq = 1

    return f"{prefix}{next_seq:05d}"

def generate_invoice_number(db: Session, year: int = None) -> str:
    """Generates sequential INV-YYYY-NNNNN assigned at finalization; never reused."""
    if year is None:
        year = datetime.utcnow().year

    prefix = f"INV-{year}-"
    last_inv = db.query(Invoice.invoice_number).filter(
        Invoice.invoice_number.like(f"{prefix}%")
    ).order_by(Invoice.invoice_number.desc()).first()

    if last_inv and last_inv[0]:
        try:
            last_seq = int(last_inv[0].split("-")[-1])
            next_seq = last_seq + 1
        except (ValueError, IndexError):
            next_seq = 1
    else:
        next_seq = 1

    return f"{prefix}{next_seq:05d}"
