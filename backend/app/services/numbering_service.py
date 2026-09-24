import threading
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import JobCard, Invoice

# Process-level lock serialises all numbering operations across
# concurrent Uvicorn threads to prevent duplicate sequence numbers.
_numbering_lock = threading.Lock()

def generate_job_card_number(db: Session, year: int = None) -> str:
    """Generates sequential JC-YYYY-NNNNN gap-tolerant number for given year.
    
    Thread-safe: uses a process-level lock to prevent race conditions
    when multiple requests attempt to create job cards concurrently.
    """
    if year is None:
        year = datetime.utcnow().year

    prefix = f"JC-{year}-"

    with _numbering_lock:
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

        # Verify the candidate doesn't already exist (defensive collision guard)
        candidate = f"{prefix}{next_seq:05d}"
        while db.query(JobCard.id).filter(JobCard.job_card_number == candidate).first() is not None:
            next_seq += 1
            candidate = f"{prefix}{next_seq:05d}"

        return candidate

def generate_invoice_number(db: Session, year: int = None) -> str:
    """Generates sequential INV-YYYY-NNNNN assigned at finalization; never reused.
    
    Thread-safe: uses a process-level lock to prevent race conditions
    when multiple requests attempt to finalise invoices concurrently.
    """
    if year is None:
        year = datetime.utcnow().year

    prefix = f"INV-{year}-"

    with _numbering_lock:
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

        # Verify the candidate doesn't already exist (defensive collision guard)
        candidate = f"{prefix}{next_seq:05d}"
        while db.query(Invoice.id).filter(Invoice.invoice_number == candidate).first() is not None:
            next_seq += 1
            candidate = f"{prefix}{next_seq:05d}"

        return candidate
