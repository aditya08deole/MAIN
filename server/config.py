"""
Configuration management using Pydantic Settings.
Simple and clean - all environment variables in one place.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache


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
    # Accept both SUPABASE_ANON_KEY and SUPABASE_KEY (backwards compatibility)
    SUPABASE_ANON_KEY: str = Field(validation_alias="SUPABASE_KEY")
    SUPABASE_JWT_SECRET: str
    
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


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
