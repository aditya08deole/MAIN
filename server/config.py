"""
Configuration management using Pydantic Settings.
Simple and clean - all environment variables in one place.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from functools import lru_cache
from typing import Any


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",  # Ignore extra fields from old complex backend
        case_sensitive=True
    )

    # Application
    ENVIRONMENT: str = "production"
    PROJECT_NAME: str = "EvaraTech Backend"
    API_V1_STR: str = "/api/v1"
    
    # Database (Supabase PostgreSQL)
    DATABASE_URL: str
    
    # Supabase Authentication
    SUPABASE_URL: str
    # No default — missing JWT secret must fail loudly, not silently accept an insecure placeholder
    SUPABASE_JWT_SECRET: str
    # Accept both SUPABASE_ANON_KEY and SUPABASE_KEY (backwards compatibility)
    SUPABASE_ANON_KEY: str = Field(default="", validation_alias="SUPABASE_KEY")
    SUPABASE_SERVICE_KEY: str = Field(default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY")

    @field_validator("SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", mode="after")
    @classmethod
    def warn_empty_supabase_keys(cls, v: str, info: Any) -> str:
        """Warn (not raise) when Supabase keys are empty to avoid blocking startup in CI."""
        import logging as _log
        if not v:
            _log.getLogger(__name__).warning(
                "[Config] %s is empty — Supabase Auth features will not work",
                getattr(info, 'field_name', 'SUPABASE_KEY'),
            )
        return v

    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:8080,https://evara-dashboard.onrender.com",
        validation_alias="BACKEND_CORS_ORIGINS"
    )

    # Redis (optional) for durable job queue
    REDIS_URL: str = ""

    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("SUPABASE_JWT_SECRET", mode="before")
    @classmethod
    def strip_jwt_quotes(cls, v: Any) -> Any:
        """Strip accidental surrounding quotes from the JWT secret in .env."""
        if isinstance(v, str):
            return v.strip("'\"")
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT.lower() in ["development", "dev", "local"]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
