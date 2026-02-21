"""
Structured logging utilities for backend
Pattern: Production-grade logging with levels, formatting, and context
"""
import logging
import sys
from datetime import datetime
from typing import Any, Optional
import json

# ============================================================================
# LOGGER CONFIGURATION
# ============================================================================

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """
    Create structured logger with proper formatting.
    
    Args:
        name: Logger name (usually __name__)
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Convert string level to logging constant
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(numeric_level)
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    # Create console handler with structured formatting
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)
    
    # Structured JSON formatter for production
    formatter = StructuredFormatter()
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    return logger


class StructuredFormatter(logging.Formatter):
    """
    Format logs as structured JSON for easier parsing and analysis.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add custom fields from extra parameter
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)
        
        return json.dumps(log_data)


# ============================================================================
# LOGGER DECORATORS
# ============================================================================

def log_execution_time(logger: logging.Logger):
    """
    Decorator to log function execution time.
    
    Usage:
    ```python
    @log_execution_time(logger)
    async def slow_operation():
        ...
    ```
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            import time
            start = time.time()
            
            try:
                result = await func(*args, **kwargs)
                duration = round((time.time() - start) * 1000, 2)
                logger.info(
                    f"{func.__name__} completed in {duration}ms",
                    extra={'extra_fields': {'duration_ms': duration, 'function': func.__name__}}
                )
                return result
            except Exception as e:
                duration = round((time.time() - start) * 1000, 2)
                logger.error(
                    f"{func.__name__} failed after {duration}ms: {str(e)}",
                    extra={'extra_fields': {'duration_ms': duration, 'function': func.__name__, 'error': str(e)}}
                )
                raise
        
        return wrapper
    return decorator


# ============================================================================
# REQUEST CONTEXT LOGGER
# ============================================================================

class RequestLogger:
    """
    Context-aware logger for HTTP requests.
    Attaches request metadata to all log entries.
    """
    
    def __init__(self, logger: logging.Logger, request_id: str, method: str, path: str):
        self.logger = logger
        self.context = {
            "request_id": request_id,
            "method": method,
            "path": path
        }
    
    def _log(self, level: int, message: str, **kwargs):
        """Internal log method with context."""
        extra_fields = {**self.context, **kwargs}
        self.logger.log(level, message, extra={'extra_fields': extra_fields})
    
    def debug(self, message: str, **kwargs):
        self._log(logging.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        self._log(logging.INFO, message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        self._log(logging.WARNING, message, **kwargs)
    
    def error(self, message: str, **kwargs):
        self._log(logging.ERROR, message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        self._log(logging.CRITICAL, message, **kwargs)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def log_dict(logger: logging.Logger, level: str, message: str, data: dict):
    """
    Log a message with structured data.
    
    Usage:
    ```python
    log_dict(logger, 'INFO', 'User created', {'user_id': '123', 'email': 'user@example.com'})
    ```
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logger.log(numeric_level, message, extra={'extra_fields': data})


def sanitize_log_data(data: dict) -> dict:
    """
    Remove sensitive fields from log data.
    
    Args:
        data: Dictionary that may contain sensitive information
    
    Returns:
        Sanitized dictionary safe for logging
    """
    sensitive_keys = {'password', 'token', 'secret', 'api_key', 'jwt_secret', 'supabase_key'}
    
    sanitized = {}
    for key, value in data.items():
        if any(sensitive in key.lower() for sensitive in sensitive_keys):
            sanitized[key] = '***REDACTED***'
        elif isinstance(value, dict):
            sanitized[key] = sanitize_log_data(value)
        else:
            sanitized[key] = value
    
    return sanitized
