"""
Enhanced error handling middleware for production-ready backend
"""
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import traceback
import time
import logging

logger = logging.getLogger(__name__)

class EnhancedErrorMiddleware(BaseHTTPMiddleware):
    """
    Catches all unhandled exceptions and returns user-friendly error responses
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        try:
            response = await call_next(request)
            
            # Log slow requests
            process_time = time.time() - start_time
            if process_time > 3.0:  # Requests taking more than 3 seconds
                logger.warning(
                    f"SLOW REQUEST: {request.method} {request.url.path} "
                    f"took {process_time:.2f}s"
                )
            
            return response
            
        except Exception as exc:
            # Log the full traceback
            logger.error(
                f"UNHANDLED EXCEPTION: {request.method} {request.url.path}\n"
                f"{traceback.format_exc()}"
            )
            
            # Return user-friendly error
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "message": "An internal server error occurred",
                    "detail": str(exc) if request.app.state.get("debug", False) else None,
                    "path": str(request.url.path),
                    "method": request.method
                }
            )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs all incoming requests with timing and status
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Log request
        logger.info(f"→ {request.method} {request.url.path}")
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            process_time = (time.time() - start_time) * 1000  # Convert to ms
            
            # Color code based on status
            if response.status_code < 400:
                level = logging.INFO
                symbol = "✓"
            elif response.status_code < 500:
                level = logging.WARNING
                symbol = "⚠"
            else:
                level = logging.ERROR
                symbol = "✗"
            
            logger.log(
                level,
                f"{symbol} {request.method} {request.url.path} "
                f"→ {response.status_code} [{process_time:.1f}ms]"
            )
            
            # Add custom header with processing time
            response.headers["X-Process-Time"] = f"{process_time:.1f}ms"
            
            return response
            
        except Exception as exc:
            process_time = (time.time() - start_time) * 1000
            logger.error(
                f"✗ {request.method} {request.url.path} "
                f"→ ERROR [{process_time:.1f}ms]: {str(exc)}"
            )
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to all responses
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Only add HSTS in production
        if request.app.state.get("environment") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response
