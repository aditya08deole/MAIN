"""
Phase 14: Custom Pydantic v2 Validators
Strict data validation layer to prevent bad data from entering the system.
"""
from pydantic import field_validator, model_validator
import re

class CoordinateValidator:
    """Mixin for models with lat/lng fields."""
    
    @field_validator('lat', mode='before', check_fields=False)
    @classmethod
    def validate_latitude(cls, v):
        if v is not None and (v < -90 or v > 90):
            raise ValueError(f'Latitude must be between -90 and 90, got {v}')
        return v
    
    @field_validator('lng', mode='before', check_fields=False)
    @classmethod
    def validate_longitude(cls, v):
        if v is not None and (v < -180 or v > 180):
            raise ValueError(f'Longitude must be between -180 and 180, got {v}')
        return v

class EmailValidator:
    """Mixin for models with email fields."""
    
    @field_validator('email', mode='before', check_fields=False)
    @classmethod
    def validate_email_format(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', v):
            raise ValueError(f'Invalid email format: {v}')
        return v.lower().strip() if v else v

class NodeKeyValidator:
    """Mixin for node key validation."""
    
    @field_validator('node_key', mode='before', check_fields=False)
    @classmethod
    def validate_node_key(cls, v):
        if v and not re.match(r'^[A-Za-z0-9_-]+$', v):
            raise ValueError('Node key must only contain alphanumeric characters, hyphens, and underscores')
        if v and len(v) < 3:
            raise ValueError('Node key must be at least 3 characters')
        return v

class TelemetryValidator:
    """Validates incoming telemetry readings."""
    
    @staticmethod
    def validate_reading(value: float, min_val: float = -1000, max_val: float = 10000) -> bool:
        """Check if a sensor reading is within physically plausible range."""
        return min_val <= value <= max_val
    
    @staticmethod
    def validate_tds(value: float) -> bool:
        """TDS (Total Dissolved Solids) typically 0-5000 ppm."""
        return 0 <= value <= 5000

    @staticmethod
    def validate_ph(value: float) -> bool:
        """pH scale is 0-14."""
        return 0 <= value <= 14
    
    @staticmethod
    def validate_temperature(value: float) -> bool:
        """Water temperature typically -10 to 100°C."""
        return -10 <= value <= 100
