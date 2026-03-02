import logging
import sys
from datetime import datetime
from typing import Any, Optional
import json

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """Simplified logger setup for EvaraTech."""
    logger = logging.getLogger(name)
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(numeric_level)
    
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger
