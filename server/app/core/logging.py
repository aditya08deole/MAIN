"""
Phase 18: Structured JSON Logging
Replaces plain text logs with structured JSON for better observability.
Integrates with log aggregation services (ELK, Datadog, etc.)
"""
import logging
import json
import sys
import time
from datetime import datetime
from app.core.config import get_settings

settings = get_settings()

class JSONFormatter(logging.Formatter):
    """Format log records as JSON for structured logging."""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "environment": settings.ENVIRONMENT
        }
        
        # Add exception info if present
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info)
            }
        
        # Add extra fields
        if hasattr(record, 'extra_data'):
            log_entry["data"] = record.extra_data
            
        return json.dumps(log_entry)

class EndpointFilter(logging.Filter):
    """Filter out noisy health check logs."""
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return "/health" not in msg and "/favicon" not in msg

def setup_structured_logging():
    """Configure JSON structured logging for the application."""
    logger = logging.getLogger("evara_backend")
    logger.setLevel(settings.LOG_LEVEL)
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # JSON Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    
    if settings.ENVIRONMENT == "production":
        console_handler.setFormatter(JSONFormatter())
    else:
        # Human-readable format for development
        console_handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
        ))
    
    # Filter health checks
    logging.getLogger("uvicorn.access").addFilter(EndpointFilter())
    
    logger.addHandler(console_handler)
    return logger

# Main setup function
def setup_logging():
    """Configure JSON structured logging for the application."""
    return setup_structured_logging()

logger = setup_structured_logging()
