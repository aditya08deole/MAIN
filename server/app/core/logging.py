import logging
import sys
from app.core.config import get_settings

settings = get_settings()

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("/health") == -1

def setup_logging():
    """
    Configure structured logging for the application.
    """
    logger = logging.getLogger("evara_backend")
    logger.setLevel(settings.LOG_LEVEL)
    
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # Filter health checks from console noise
    logging.getLogger("uvicorn.access").addFilter(EndpointFilter())
    
    logger.addHandler(console_handler)
    return logger

logger = setup_logging()
