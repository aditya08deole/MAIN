from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "EvaraTech Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development" # development, staging, production
    
    # CORS
    @property
    def cors_origins(self) -> list[str]:
        # Default origins
        defaults = ["http://localhost:8080", "http://localhost:5173", "https://evara-dashboard.onrender.com"]
        # Allow comma separated string from env
        env_origins = self.BACKEND_CORS_ORIGINS
        if isinstance(env_origins, str):
            return defaults + [x.strip() for x in env_origins.split(",") if x.strip()]
        return defaults + (env_origins or [])

    BACKEND_CORS_ORIGINS: list[str] | str = []

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./test.db"
    
    # Supabase (Auth + Metadata)
    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None # Service Role Key for backend admin actions
    SUPABASE_JWT_SECRET: str | None = None # For verifying frontend tokens locally
    
    # ThingSpeak (Telemetry)
    THINGSPEAK_API_KEY: str | None = None
    THINGSPEAK_CHANNEL_ID: str | None = None
    
    # Security
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_HERE_CHANGE_IN_PROD"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 hours

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache
def get_settings():
    s = Settings()
    print(f"SETTINGS: ENVIRONMENT={s.ENVIRONMENT}")
    return s
