from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.models import Base

# SQLite engine with thread check disabled for single-host FastAPI concurrency
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True
)

# Enable WAL mode, synchronous=NORMAL, and foreign key enforcement on SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initializes the database schema and verifies integrity."""
    Base.metadata.create_all(bind=engine)
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
