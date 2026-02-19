"""
Phase 24: Feature Flag System
Simple, database-free feature flag system for safe feature rollouts.
"""
from typing import Dict, Set
from app.core.config import get_settings

settings = get_settings()

class FeatureFlags:
    """
    In-memory feature flag system.
    Flags can be toggled without redeployment via env vars or admin API.
    """
    
    _flags: Dict[str, bool] = {
        # Core Features (always on)
        "dashboard_v2": True,
        "websocket_updates": True,
        "search_enabled": True,
        
        # Experimental Features
        "ai_anomaly_detection": False,
        "advanced_reports": False,
        "multi_language": False,
        
        # Rollout Features (enable gradually)
        "new_map_clustering": True,
        "telemetry_ingestion_v2": True,
        "structured_logging": settings.ENVIRONMENT == "production",
    }
    
    # Users who get experimental features (beta testers)
    _beta_users: Set[str] = {
        "ritik@evaratech.com",
        "yasha@evaratech.com",
        "aditya@evaratech.com"
    }
    
    @classmethod
    def is_enabled(cls, flag_name: str, user_email: str = None) -> bool:
        """Check if a feature flag is enabled."""
        # If flag is globally enabled
        if cls._flags.get(flag_name, False):
            return True
        
        # If user is a beta tester, enable experimental features
        if user_email and user_email in cls._beta_users:
            return True
            
        return False
    
    @classmethod
    def set_flag(cls, flag_name: str, enabled: bool):
        """Dynamically toggle a feature flag."""
        cls._flags[flag_name] = enabled
    
    @classmethod
    def get_all_flags(cls) -> Dict[str, bool]:
        """Return all feature flags and their states."""
        return cls._flags.copy()

feature_flags = FeatureFlags()
