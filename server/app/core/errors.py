"""
Production-grade error handling with structured logging and custom exceptions.
Implements centralized exception middleware with detailed error tracking.
"""
from fastapi import Request, status, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.schemas.response import StandardResponse
from app.core.logging import setup_logging
from typing import Optional, Dict
import traceback
import uuid

logger = setup_logging()


# ═══════════════════════════════════════════════════════════════════════════
# CUSTOM EXCEPTION CLASSES
# ═══════════════════════════════════════════════════════════════════════════

class ApplicationError(Exception):
    """
    Base exception for all application errors.
    Provides structured error information.
    """
    
    def __init__(
        self,
        message: str,
        error_code: str = "APP_ERROR",
        status_code: int = 500,
        details: Optional[Dict] = None
    ):
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class DatabaseError(ApplicationError):
    """Raised when database operations fail."""
    
    def __init__(self, message: str, details: Optional[Dict] = None):
        super().__init__(
            message=message,
            error_code="DB_ERROR",
            status_code=503,
            details=details
        )


class ExternalServiceError(ApplicationError):
    """Raised when external service (ThingSpeak, Supabase) calls fail."""
    
    def __init__(self, service: str, message: str, details: Optional[Dict] = None):
        details = details or {}
        details["service"] = service
        super().__init__(
            message=f"{service} error: {message}",
            error_code="EXTERNAL_SERVICE_ERROR",
            status_code=502,
            details=details
        )


class ValidationError(ApplicationError):
    """Raised when business logic validation fails."""
    
    def __init__(self, message: str, field: Optional[str] = None):
        details = {"field": field} if field else {}
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            details=details
        )


class AuthenticationError(ApplicationError):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(
            message=message,
            error_code="AUTH_ERROR",
            status_code=401
        )


class AuthorizationError(ApplicationError):
    """Raised when user lacks required permissions."""
    
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(
            message=message,
            error_code="AUTHZ_ERROR",
            status_code=403
        )


class NotFoundError(ApplicationError):
    """Raised when requested resource not found."""
    
    def __init__(self, resource_type: str, resource_id: str):
        super().__init__(
            message=f"{resource_type} with ID '{resource_id}' not found",
            error_code="NOT_FOUND",
            status_code=404,
            details={"resource_type": resource_type, "resource_id": resource_id}
        )


class RateLimitError(ApplicationError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message="Rate limit exceeded",
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            details={"retry_after_seconds": retry_after}
        )


# ═══════════════════════════════════════════════════════════════════════════
# ERROR TRACKING & LOGGING
# ═══════════════════════════════════════════════════════════════════════════

class ErrorTracker:
    """
    Centralized error tracking with correlation IDs.
    Provides structured error logging for debugging and monitoring.
    """
    
    @staticmethod
    def log_error(
        request: Request,
        exception: Exception,
        correlation_id: Optional[str] = None
    ) -> str:
        """
        Log error with structured context.
        Returns correlation ID for client reference.
        """
        correlation_id = correlation_id or str(uuid.uuid4())
        
        error_context = {
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
            "error_type": type(exception).__name__,
            "error_message": str(exception)
        }
        
        # Add custom error details if available
        if isinstance(exception, ApplicationError):
            error_context["error_code"] = exception.error_code
            error_context["details"] = exception.details
        
        # Log with traceback for unexpected errors
        if not isinstance(exception, (ApplicationError, StarletteHTTPException)):
            error_context["traceback"] = traceback.format_exc()
            logger.exception("Unexpected error occurred", extra=error_context)
        else:
            logger.error(f"Application error: {str(exception)}", extra=error_context)
        
        return correlation_id


# ═══════════════════════════════════════════════════════════════════════════
# EXCEPTION HANDLERS
# ═══════════════════════════════════════════════════════════════════════════

async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle HTTPException from FastAPI/Starlette."""
    correlation_id = ErrorTracker.log_error(request, exc)
    
    return JSONResponse(
        status_code=exc.status_code,
        content=StandardResponse(
            status="error",
            message=str(exc.detail),
            meta={
                "code": exc.status_code,
                "correlation_id": correlation_id
            }
        ).dict()
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle validation errors from Pydantic."""
    correlation_id = ErrorTracker.log_error(request, exc)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=StandardResponse(
            status="error",
            message="Validation Error",
            meta={
                "errors": exc.errors(),
                "correlation_id": correlation_id
            }
        ).dict()
    )


async def application_error_handler(request: Request, exc: ApplicationError) -> JSONResponse:
    """Handle custom application errors."""
    correlation_id = ErrorTracker.log_error(request, exc)
    
    return JSONResponse(
        status_code=exc.status_code,
        content=StandardResponse(
            status="error",
            message=exc.message,
            meta={
                "error_code": exc.error_code,
                "details": exc.details,
                "correlation_id": correlation_id
            }
        ).dict()
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions with full error tracking."""
    correlation_id = ErrorTracker.log_error(request, exc)
    
    # In production, don't expose internal error details
    from app.core.config import get_settings
    settings = get_settings()
    
    error_message = "Internal Server Error"
    error_meta = {
        "correlation_id": correlation_id
    }
    
    # Include error details in development mode
    if settings.ENVIRONMENT == "development":
        error_meta["error"] = str(exc)
        error_meta["type"] = type(exc).__name___
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=StandardResponse(
            status="error",
            message=error_message,
            meta=error_meta
        ).dict()
    )


# ═══════════════════════════════════════════════════════════════════════════
# ERROR RESPONSE HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def create_error_response(
    message: str,
    status_code: int = 400,
    error_code: Optional[str] = None,
    details: Optional[Dict] = None
) -> JSONResponse:
    """
    Helper to create standardized error responses.
    """
    meta = {}
    if error_code:
        meta["error_code"] = error_code
    if details:
        meta["details"] = details
    
    return JSONResponse(
        status_code=status_code,
        content=StandardResponse(
            status="error",
            message=message,
            meta=meta
        ).dict()
    )

