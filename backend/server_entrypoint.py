import sys
import os
import argparse
import multiprocessing
import uvicorn

if __name__ == "__main__":
    # Freeze support is mandatory on Windows for PyInstaller multiprocessing
    multiprocessing.freeze_support()

    parser = argparse.ArgumentParser(description="Pushpa Raj Workshop Management Desktop Engine")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind backend server")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address to bind")
    parser.add_argument("--data-dir", type=str, default="", help="Custom data directory for SQLite & documents")
    args = parser.parse_args()

    if args.data_dir:
        os.environ["PR_DATA_DIR"] = args.data_dir

    # Import app after setting environment variables
    from app.main import app

    print(f"[Pushpa Raj Backend] Starting desktop engine on {args.host}:{args.port}...")
    try:
        uvicorn.run(
            app,
            host=args.host,
            port=args.port,
            log_level="info",
            access_log=False,
            loop="asyncio"
        )
    except (KeyboardInterrupt, SystemExit):
        print("[Pushpa Raj Backend] Clean shutdown signal received.")
