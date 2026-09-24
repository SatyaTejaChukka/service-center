import time
import sqlite3
import pytest
from pathlib import Path
from app.services.search_service import global_search
from app.core.database import SessionLocal, engine
from app.models import Base, Customer, Vehicle, JobCard

def test_benchmark_indexed_search():
    """
    AC-16: Benchmarks search latency on indexed SQLite tables.
    Validates that query latency remains well below the 300ms PRD target.
    """
    db = SessionLocal()
    try:
        # Warm up connection pool & SQLite cache
        global_search(db, query="warmup", limit_per_category=1)

        # Measure search latency on active database
        start = time.perf_counter()
        results = global_search(db, query="AP31", limit_per_category=10)
        elapsed_ms = (time.perf_counter() - start) * 1000

        print(f"\nIndexed Search Latency: {elapsed_ms:.2f} ms")
        assert elapsed_ms < 300, f"Search latency {elapsed_ms:.2f}ms exceeded 300ms threshold!"
    finally:
        db.close()
