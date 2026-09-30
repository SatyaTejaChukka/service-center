import os
import secrets
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_BASE_DATA_DIR = os.getenv(
    "PR_DATA_DIR",
    str(Path.home() / "AppData" / "Local" / "PushpaRajAutomotive" if os.name == "nt" else Path.home() / ".pushpa_raj_auto")
)

def _get_or_create_secret_key(base_dir: str) -> str:
    """Returns persistent high-entropy machine-unique secret key, creating it if needed."""
    env_secret = os.getenv("PR_SECRET_KEY")
    if env_secret and len(env_secret) >= 16:
        return env_secret
    try:
        key_file = Path(base_dir) / ".secret_key"
        if key_file.exists():
            val = key_file.read_text(encoding="utf-8").strip()
            if len(val) >= 32:
                return val
        key_file.parent.mkdir(parents=True, exist_ok=True)
        generated = secrets.token_urlsafe(48)
        key_file.write_text(generated, encoding="utf-8")
        return generated
    except Exception:
        return "pushpa-raj-auto-offline-fallback-secure-token-2026"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pushpa Raj Automotive Services Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = _get_or_create_secret_key(_DEFAULT_BASE_DATA_DIR)
    SHUTDOWN_TOKEN: str = os.getenv("PR_SHUTDOWN_TOKEN", "")
    ALGORITHM: str = "HS256"
    # Permanent offline desktop session: tokens remain valid for 50 years unless explicitly logged out
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 365 * 50
    
    # Base application data directory
    # Defaults to local ./data or %LOCALAPPDATA%/PushpaRajAutomotive
    BASE_DATA_DIR: str = _DEFAULT_BASE_DATA_DIR
    
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost",
        "null",
        "file://",
        "file://*"
    ]
    CORS_ORIGIN_REGEX: str = r"^(https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|file://.*|null)$"

    @property
    def data_dir(self) -> Path:
        p = Path(self.BASE_DATA_DIR) / "data"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def db_path(self) -> Path:
        return self.data_dir / "automotive.db"

    @property
    def database_url(self) -> str:
        # SQLite URL
        return f"sqlite:///{self.db_path.as_posix()}"

    @property
    def documents_dir(self) -> Path:
        p = Path(self.BASE_DATA_DIR) / "documents"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def invoices_dir(self) -> Path:
        p = self.documents_dir / "invoices"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def job_cards_dir(self) -> Path:
        p = self.documents_dir / "job_cards"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def vehicle_photos_dir(self) -> Path:
        p = self.documents_dir / "vehicle_photos"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def attachments_dir(self) -> Path:
        p = self.documents_dir / "attachments"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def backups_dir(self) -> Path:
        p = Path(self.BASE_DATA_DIR) / "backups"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def exports_dir(self) -> Path:
        p = Path(self.BASE_DATA_DIR) / "exports"
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def logs_dir(self) -> Path:
        p = Path(self.BASE_DATA_DIR) / "logs"
        p.mkdir(parents=True, exist_ok=True)
        return p

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
