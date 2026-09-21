import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pushpa Raj Automotive Services Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "pushpa-raj-auto-offline-secret-key-2026-secure-token"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 # 24 hours session
    
    # Base application data directory
    # Defaults to local ./data or %LOCALAPPDATA%/PushpaRajAutomotive
    BASE_DATA_DIR: str = os.getenv(
        "PR_DATA_DIR",
        str(Path.home() / "AppData" / "Local" / "PushpaRajAutomotive" if os.name == "nt" else Path.home() / ".pushpa_raj_auto")
    )
    
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost"
    ]

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
