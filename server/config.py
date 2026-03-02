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
    
    @classmethod
    @field_validator("SUPABASE_JWT_SECRET", mode="before")
    def strip_quotes(cls, v: Any) -> Any:
        if isinstance(v, str):
            return v.strip("'\"")
        return v
    
    # Application
    ENVIRONMENT: str = "production"
    PROJECT_NAME: str = "EvaraTech Backend"
    API_V1_STR: str = "/api/v1"
    
    # Database (Supabase PostgreSQL)
    DATABASE_URL: str
    
    # Supabase Authentication
    SUPABASE_URL: str
    SUPABASE_JWT_SECRET: str = "your-secret-here" # Default for startup, should be set in .env
    # Accept both SUPABASE_ANON_KEY and SUPABASE_KEY (backwards compatibility)
    SUPABASE_ANON_KEY: str = Field(default="", validation_alias="SUPABASE_KEY")
    SUPABASE_SERVICE_KEY: str = Field(default="", validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    
    # CORS
    CORS_ORIGINS: str = Field(
        default="http://localhost:5173,http://localhost:8080,https://evara-dashboard.onrender.com",
        validation_alias="BACKEND_CORS_ORIGINS"
    )
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
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
