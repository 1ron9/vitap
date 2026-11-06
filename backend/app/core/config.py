import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "MediCare API"
    VERSION: str = "1.0.0"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./test.db")
    # Compose dùng các trường này; DATABASE_URL vẫn dùng cho Supabase/local thủ công.
    POSTGRES_HOST: str | None = None
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "vitap"
    POSTGRES_USER: str = "vitap"
    POSTGRES_PASSWORD: str = ""
    SECRET_KEY: str = os.getenv("SECRET_KEY", "temporary_development_secret_key_123456789")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    USE_MOCK_AI: bool = os.getenv("USE_MOCK_AI", "True").lower() == "true"
    GEMINI_TIMEOUT_SECONDS: float = 1.5

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
