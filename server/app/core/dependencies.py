"""
Centralized dependency injection for FastAPI endpoints.
Provides standardized service instantiation and user resolution.
"""
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from app.db.session import get_db
from app.core.security_supabase import get_current_user_token
from app.models import all_models as models
from app.db.repository import UserRepository
from app.core.config import get_settings


class UserResolutionService:
    """
    Standardized user resolution that maintains backward compatibility.
    Resolves user from token payload and database with fallback for development.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.settings = get_settings()
    
    async def resolve_user(self, user_payload: Dict[str, Any]) -> models.User:
        """
        Resolve user from JWT payload with database lookup.
        Returns User model instance with timeout handling.
        """
        user_id = user_payload.get("sub")
        
        try:
            async with asyncio.timeout(3):
                current_user = await self.user_repo.get(user_id)
                
                if not current_user:
                    # Development fallback
                    if self.settings.ENVIRONMENT == "development":
                        return self._create_mock_user(user_id, user_payload)
                    
                    raise HTTPException(
                        status_code=401,
                        detail=f"User {user_id} not synchronized. Please sync via /api/v1/auth/sync-user"
                    )
                
                return current_user
                
        except asyncio.TimeoutError:
            # Timeout fallback
            if self.settings.ENVIRONMENT == "development":
                return self._create_mock_user(user_id, user_payload)
            
            raise HTTPException(
                status_code=503,
                detail="Database timeout during user resolution"
            )
    
    def _create_mock_user(self, user_id: str, user_payload: Dict[str, Any]) -> models.User:
        """Create mock user for development environment."""
        app_metadata = user_payload.get("app_metadata", {})
        user_metadata = user_payload.get("user_metadata", {})
        role = app_metadata.get("role") or user_metadata.get("role") or "customer"
        
        # Extract email from payload
        email = user_payload.get("email", "dev@evaratech.com")
        
        # Determine if superadmin based on dev-bypass token or email
        if "admin" in email or role == "superadmin":
            role = "superadmin"
        
        return models.User(
            id=user_id,
            email=email,
            role=role,
            community_id="comm_myhome",
            distributor_id="dist_mock_123" if role == "distributor" else None
        )


# ─── DEPENDENCY FUNCTIONS ───

async def get_user_resolution_service(
    db: AsyncSession = Depends(get_db)
) -> UserResolutionService:
    """Dependency that provides UserResolutionService."""
    return UserResolutionService(db)


async def get_current_user(
    user_payload: Dict[str, Any] = Depends(get_current_user_token),
    user_service: UserResolutionService = Depends(get_user_resolution_service)
) -> models.User:
    """
    Standardized dependency for resolving current user from JWT.
    Use this across all endpoints that require user context.
    
    Backward compatible with existing endpoint patterns.
    """
    return await user_service.resolve_user(user_payload)


def require_superadmin(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    """
    Dependency that requires superadmin role.
    Raises 403 if user is not superadmin.
    """
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=403,
            detail="Insufficient privileges. Superadmin role required."
        )
    return current_user


def require_role(*allowed_roles: str):
    """
    Dependency factory for role-based access control.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(
            user: models.User = Depends(require_role("admin", "superadmin"))
        ):
            ...
    """
    async def _require_role(
        current_user: models.User = Depends(get_current_user)
    ) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient privileges. Required role: {' or '.join(allowed_roles)}"
            )
        return current_user
    
    return _require_role


# ─── SERVICE DEPENDENCIES ───

class ServiceRegistry:
    """
    Registry for service dependencies.
    Provides lazy initialization and consistent service instantiation.
    """
    
    @staticmethod
    async def get_telemetry_service():
        """Get TelemetryService instance."""
        from app.services.telemetry_service import TelemetryService
        return TelemetryService()
    
    @staticmethod
    async def get_telemetry_processor(db: AsyncSession = Depends(get_db)):
        """Get TelemetryProcessor instance."""
        from app.services.telemetry_processor import TelemetryProcessor
        return TelemetryProcessor(db)
    
    @staticmethod
    async def get_alert_engine(db: AsyncSession = Depends(get_db)):
        """Get AlertEngine instance."""
        from app.services.alert_engine import AlertEngine
        return AlertEngine(db)
    
    @staticmethod
    async def get_health_calculator():
        """Get HealthCalculator instance."""
        from app.services.health_calculator import HealthCalculator
        return HealthCalculator()
    
    @staticmethod
    async def get_notification_service():
        """Get NotificationService instance."""
        from app.services.notification import NotificationService
        return NotificationService()
    
    @staticmethod
    async def get_audit_service(db: AsyncSession = Depends(get_db)):
        """Get AuditService instance."""
        from app.services.audit_service import AuditService
        return AuditService(db)


# Convenience exports for common dependencies
get_telemetry_service = Depends(ServiceRegistry.get_telemetry_service)
get_telemetry_processor = Depends(ServiceRegistry.get_telemetry_processor)
get_alert_engine = Depends(ServiceRegistry.get_alert_engine)
get_health_calculator = Depends(ServiceRegistry.get_health_calculator)
get_notification_service = Depends(ServiceRegistry.get_notification_service)
get_audit_service = Depends(ServiceRegistry.get_audit_service)
