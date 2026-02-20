"""
Pydantic schemas for request/response validation.
Clean and simple data models.
"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, Dict, Any


# ============================================================================
# USER SCHEMAS
# ============================================================================

class UserResponse(BaseModel):
    """User profile response."""
    id: str
    email: str
    display_name: Optional[str] = None
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True  # Pydantic v2 (was orm_mode in v1)


# ============================================================================
# DEVICE SCHEMAS
# ============================================================================

class DeviceCreate(BaseModel):
    """Create new device."""
    node_key: str
    label: str
    category: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = {}


class DeviceUpdate(BaseModel):
    """Update device (all fields optional)."""
    label: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None


class DeviceResponse(BaseModel):
    """Device response."""
    id: str
    node_key: str
    label: str
    category: str
    status: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    thingspeak_channel_id: Optional[str] = None
    user_id: str
    created_at: datetime
    updated_at: datetime
    last_seen: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# TELEMETRY SCHEMAS
# ============================================================================

class TelemetryResponse(BaseModel):
    """Telemetry data response from ThingSpeak."""
    timestamp: str
    data: Dict[str, Any]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    database: str
    timestamp: datetime
    services: Optional[Dict[str, str]] = None
