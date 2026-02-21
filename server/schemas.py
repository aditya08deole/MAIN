"""
Pydantic schemas for request/response validation.
Clean and simple data models.
"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, Dict, Any, List


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
    name: Optional[str] = None  # Display name for map
    asset_type: Optional[str] = None  # pump, sump, tank, bore, govt, pipeline, sensor
    asset_category: Optional[str] = None  # Subcategory
    capacity: Optional[str] = None  # e.g., "4.98L L", "5 HP"
    specifications: Optional[str] = None  # Technical specs
    status: Optional[str] = "active"  # Status of device
    is_active: Optional[str] = "true"  # String "true"/"false"
    latitude: Optional[float] = None  # Primary geo field
    longitude: Optional[float] = None  # Primary geo field
    lat: Optional[float] = None  # Legacy compatibility
    lng: Optional[float] = None  # Legacy compatibility
    location_name: Optional[str] = None
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = {}


class DeviceUpdate(BaseModel):
    """Update device (all fields optional)."""
    label: Optional[str] = None
    category: Optional[str] = None
    name: Optional[str] = None
    asset_type: Optional[str] = None
    asset_category: Optional[str] = None
    capacity: Optional[str] = None
    specifications: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
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
    name: Optional[str] = None
    asset_type: Optional[str] = None
    asset_category: Optional[str] = None
    capacity: Optional[str] = None
    specifications: Optional[str] = None
    status: str
    is_active: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
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


class DeviceMapResponse(BaseModel):
    """Optimized device response for map rendering (minimal fields)."""
    id: str
    name: Optional[str] = None
    asset_type: Optional[str] = None
    asset_category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[str] = None
    specifications: Optional[str] = None
    status: str
    
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


# ============================================================================
# AUDIT LOG SCHEMAS
# ============================================================================

class AuditLogCreate(BaseModel):
    """Create audit log entry."""
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class AuditLogResponse(BaseModel):
    """Audit log response."""
    id: str
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# FRONTEND ERROR SCHEMAS
# ============================================================================

class FrontendErrorCreate(BaseModel):
    """Create frontend error log entry."""
    error_message: str
    stack_trace: Optional[str] = None
    url: str
    user_agent: Optional[str] = None


class FrontendErrorResponse(BaseModel):
    """Frontend error response."""
    id: str
    error_message: str
    stack_trace: Optional[str] = None
    url: str
    user_agent: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# PIPELINE SCHEMAS
# ============================================================================

class PipelineCreate(BaseModel):
    """Create pipeline entry."""
    name: str
    pipeline_type: str  # 'water_supply', 'borewell_water'
    from_device_id: Optional[str] = None
    to_device_id: Optional[str] = None
    coordinates: List[List[float]]  # Array of [lng, lat] pairs
    diameter: Optional[str] = None
    material: Optional[str] = None
    installation_type: Optional[str] = None
    color: Optional[str] = '#00b4d8'
    status: Optional[str] = 'Active'
    description: Optional[str] = None


class PipelineUpdate(BaseModel):
    """Update pipeline entry."""
    name: Optional[str] = None
    pipeline_type: Optional[str] = None
    from_device_id: Optional[str] = None
    to_device_id: Optional[str] = None
    coordinates: Optional[List[List[float]]] = None
    diameter: Optional[str] = None
    material: Optional[str] = None
    installation_type: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[str] = None
    description: Optional[str] = None


class PipelineResponse(BaseModel):
    """Full pipeline response."""
    id: str
    name: str
    pipeline_type: str
    from_device_id: Optional[str] = None
    to_device_id: Optional[str] = None
    coordinates: List[List[float]]
    diameter: Optional[str] = None
    material: Optional[str] = None
    installation_type: Optional[str] = None
    color: str
    status: str
    is_active: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PipelineMapResponse(BaseModel):
    """Optimized pipeline response for map rendering (minimal fields)."""
    id: str
    name: str
    positions: List[List[float]]  # [[lat, lng], [lat, lng], ...] for React-Leaflet
    color: str
    
    class Config:
        from_attributes = True

