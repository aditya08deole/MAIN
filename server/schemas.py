from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID


class UserResponse(BaseModel):
    """User profile response."""
    id: str
    email: str
    display_name: Optional[str] = None
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True  # Pydantic v2 (was orm_mode in v1)


class ZoneResponse(BaseModel):
    """Zone response."""
    id: str
    name: str
    state: Optional[str] = None
    country: Optional[str] = None
    zone_code: Optional[str] = None
    description: Optional[str] = None
    distributor_id: Optional[str] = None
    is_active: Optional[bool] = True
    created_at: datetime
    updated_at: datetime
    
    @field_validator('id', 'distributor_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class ZoneCreate(BaseModel):
    """Create a new zone."""
    name: str
    state: Optional[str] = None
    country: Optional[str] = "India"
    zone_code: Optional[str] = None
    description: Optional[str] = None
    distributor_id: Optional[str] = None

class PlanResponse(BaseModel):
    """Subscription plan response."""
    id: str
    name: str
    max_devices: int
    retention_days: int

    class Config:
        from_attributes = True

class DistributorResponse(BaseModel):
    """Distributor (Tenant) response."""
    id: str
    name: str
    region: Optional[str] = None
    status: str
    plan_id: Optional[str] = None
    plan: Optional[PlanResponse] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class DistributorCreate(BaseModel):
    """Create a new distributor."""
    name: str
    region: Optional[str] = None
    plan_id: Optional[str] = None
    status: Optional[str] = "active"

class CommunityCreate(BaseModel):
    """Create new community with enterprise fields."""
    name: str
    zone_id: str  # References Zone.id
    address: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    operational_status: Optional[str] = "active"  # active, inactive, maintenance, planned
    notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = {}


class CommunityResponse(BaseModel):
    """Community response with enterprise fields."""
    id: str
    name: str
    zone_id: str
    address: Optional[str] = None
    pincode: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    operational_status: Optional[str] = None
    notes: Optional[str] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    @field_validator('id', 'zone_id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v
    
    class Config:
        from_attributes = True


class CustomerCreate(BaseModel):
    """Create new customer (user with enterprise fields)."""
    email: EmailStr
    display_name: str
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    password: str  # Will be used for Supabase Auth
    community_id: str  # References Community.id
    role: Optional[str] = "customer"  # customer, operator, viewer
    status: Optional[str] = "active"  # active, suspended, inactive, pending
    meta_data: Optional[Dict[str, Any]] = {}


# ============================================================================
# DEVICE SCHEMAS
# ============================================================================

class DeviceCreate(BaseModel):
    """Create new device with core fields."""
    node_key: str
    label: str
    name: Optional[str] = None
    asset_type: Optional[str] = None
    status: Optional[str] = "active"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device_type: Optional[str] = None
    community_id: Optional[str] = None
    user_id: str
    
    # ThingSpeak Integration
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = {}


class DeviceUpdate(BaseModel):
    """Update device core fields."""
    label: Optional[str] = None
    name: Optional[str] = None
    asset_type: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device_type: Optional[str] = None
    is_active: Optional[bool] = None
    
    # ThingSpeak Integration
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None
    field_mapping: Optional[Dict[str, str]] = None


class DeviceConfigTankResponse(BaseModel):
    tank_shape: Optional[str] = None
    dimension_unit: str = "m"
    radius: Optional[float] = None
    height: Optional[float] = None
    length: Optional[float] = None
    breadth: Optional[float] = None
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None

    class Config:
        from_attributes = True

class DeviceConfigFlowResponse(BaseModel):
    max_flow_rate: Optional[float] = None
    pipe_diameter: Optional[float] = None
    abnormal_threshold: Optional[float] = None
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None

    class Config:
        from_attributes = True

class DeviceConfigDeepResponse(BaseModel):
    static_depth: Optional[float] = None
    dynamic_depth: Optional[float] = None
    recharge_threshold: Optional[float] = None
    thingspeak_channel_id: Optional[str] = None
    thingspeak_read_key: Optional[str] = None

    class Config:
        from_attributes = True

class DeviceResponse(BaseModel):
    """Refined device response."""
    id: str
    node_key: str
    label: str
    name: Optional[str] = None
    asset_type: Optional[str] = None
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    device_type: Optional[str] = None
    is_active: bool
    
    # Normalized Configs
    config_tank: Optional[DeviceConfigTankResponse] = None
    config_flow: Optional[DeviceConfigFlowResponse] = None
    config_deep: Optional[DeviceConfigDeepResponse] = None

    community_id: Optional[str] = None
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
    status: Optional[str] = "active"
    
    class Config:
        from_attributes = True


# ============================================================================
# TELEMETRY SCHEMAS
# ============================================================================

class TelemetryResponse(BaseModel):
    """Telemetry data response from ThingSpeak."""
    timestamp: str
    data: Dict[str, Any]
    
    # Strongly Typed Phase 1
    level_percentage: Optional[float] = None
    depth_value: Optional[float] = None
    temperature_value: Optional[float] = None
    flow_rate: Optional[float] = None
    total_liters: Optional[int] = None


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
    user_id: Optional[str] = None  # nullable — superadmin actions may not have a customers row
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
    is_active: bool
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

# ============================================================================
# STATS SCHEMAS
# ============================================================================

class RegionStatsResponse(BaseModel):
    """Statistical summary for a zone."""
    zone_id: str
    region_name: str
    state: Optional[str] = None
    community_count: int
    customer_count: int
    device_count: int
    online_devices: int
    offline_devices: int

class DashboardSummaryResponse(BaseModel):
    """Consolidated dashboard summary metrics."""
    total_devices: int = 0
    deployed_active: int = 0
    deployed_inactive: int = 0
    health_working: int = 0
    health_not_working: int = 0
    product_tank: int = 0
    product_flow: int = 0
    product_deep: int = 0
    alerts_active: int = 0
    alerts_critical: int = 0
    alerts_warning: int = 0
    tanks_full: int = 0
    tanks_not_full: int = 0
    # Legacy aliases kept for backward compatibility
    online_devices: int = 0
    tanks_low: int = 0
    system_health: int = 100
    timestamp: datetime = None

    def model_post_init(self, __context: Any) -> None:
        if self.timestamp is None:
            from datetime import timezone
            self.timestamp = datetime.now(timezone.utc)




# ============================================================================
# DEVICE SHARE SCHEMAS
# ============================================================================

class DeviceShareCreate(BaseModel):
    """Create a new device share."""
    device_id: str
    user_id: str
    access_level: Optional[str] = "viewer"

class DeviceShareResponse(BaseModel):
    """Device share response."""
    id: str
    device_id: str
    user_id: str
    access_level: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
