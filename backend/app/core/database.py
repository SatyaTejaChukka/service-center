from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.models import Base

# SQLite engine with thread check disabled and busy timeout for reliable local concurrency
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False, "timeout": 15},
    pool_pre_ping=True
)

# Enable WAL mode, synchronous=NORMAL, foreign keys, and busy timeout on SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.execute("PRAGMA busy_timeout=15000;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def run_schema_migrations():
    """Safely adds missing columns to existing SQLite tables if not present."""
    with engine.begin() as conn:
        def get_columns(table_name):
            res = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
            return [row[1] for row in res]

        # 1. customers table
        cust_cols = get_columns("customers")
        if "gstin" not in cust_cols:
            conn.execute(text("ALTER TABLE customers ADD COLUMN gstin VARCHAR(20);"))

        # 2. labour_items table
        lab_cols = get_columns("labour_items")
        if "cost_price" not in lab_cols:
            conn.execute(text("ALTER TABLE labour_items ADD COLUMN cost_price INTEGER DEFAULT 0 NOT NULL;"))
        if "sac_code" not in lab_cols:
            conn.execute(text("ALTER TABLE labour_items ADD COLUMN sac_code VARCHAR(20) DEFAULT '998729';"))
        if "gst_rate" not in lab_cols:
            conn.execute(text("ALTER TABLE labour_items ADD COLUMN gst_rate INTEGER DEFAULT 18 NOT NULL;"))

        # 3. parts_items table
        part_cols = get_columns("parts_items")
        if "cost_price" not in part_cols:
            conn.execute(text("ALTER TABLE parts_items ADD COLUMN cost_price INTEGER DEFAULT 0 NOT NULL;"))
        if "hsn_code" not in part_cols:
            conn.execute(text("ALTER TABLE parts_items ADD COLUMN hsn_code VARCHAR(20) DEFAULT '8708';"))
        if "gst_rate" not in part_cols:
            conn.execute(text("ALTER TABLE parts_items ADD COLUMN gst_rate INTEGER DEFAULT 18 NOT NULL;"))

        # 4. labour_catalog table
        lc_cols = get_columns("labour_catalog")
        if "cost_price" not in lc_cols:
            conn.execute(text("ALTER TABLE labour_catalog ADD COLUMN cost_price INTEGER DEFAULT 0 NOT NULL;"))
        if "sac_code" not in lc_cols:
            conn.execute(text("ALTER TABLE labour_catalog ADD COLUMN sac_code VARCHAR(20) DEFAULT '998729';"))
        if "gst_rate" not in lc_cols:
            conn.execute(text("ALTER TABLE labour_catalog ADD COLUMN gst_rate INTEGER DEFAULT 18 NOT NULL;"))

        # 5. parts_catalog table
        pc_cols = get_columns("parts_catalog")
        if "purchase_cost" not in pc_cols:
            conn.execute(text("ALTER TABLE parts_catalog ADD COLUMN purchase_cost INTEGER DEFAULT 0 NOT NULL;"))
        if "hsn_code" not in pc_cols:
            conn.execute(text("ALTER TABLE parts_catalog ADD COLUMN hsn_code VARCHAR(20) DEFAULT '8708';"))
        if "gst_rate" not in pc_cols:
            conn.execute(text("ALTER TABLE parts_catalog ADD COLUMN gst_rate INTEGER DEFAULT 18 NOT NULL;"))

        # 6. invoices table
        inv_cols = get_columns("invoices")
        if "taxable_amount" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN taxable_amount INTEGER DEFAULT 0 NOT NULL;"))
        if "cgst_amount" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN cgst_amount INTEGER DEFAULT 0 NOT NULL;"))
        if "sgst_amount" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN sgst_amount INTEGER DEFAULT 0 NOT NULL;"))
        if "igst_amount" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN igst_amount INTEGER DEFAULT 0 NOT NULL;"))
        if "total_cost" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN total_cost INTEGER DEFAULT 0 NOT NULL;"))
        if "gross_profit" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN gross_profit INTEGER DEFAULT 0 NOT NULL;"))
        if "line_items_snapshot" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN line_items_snapshot TEXT;"))
        if "pdf_file_path" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN pdf_file_path VARCHAR(255);"))
        if "is_locked" not in inv_cols:
            conn.execute(text("ALTER TABLE invoices ADD COLUMN is_locked BOOLEAN DEFAULT 0 NOT NULL;"))

def init_db():
    """Initializes the database schema and verifies integrity."""
    Base.metadata.create_all(bind=engine)
    run_schema_migrations()
    verify_db_integrity()

def verify_db_integrity() -> bool:
    """Runs PRAGMA integrity_check to detect corruption early."""
    with engine.connect() as conn:
        res = conn.execute(text("PRAGMA integrity_check;")).scalar()
        if res != "ok":
            raise RuntimeError(f"Database integrity check failed: {res}")
        return True

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
