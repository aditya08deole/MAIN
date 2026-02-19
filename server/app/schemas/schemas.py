from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, date

# ─── TOKEN SCHEMAS ───
class Token(BaseModel):
    access_token: str
    token_type: str

# ─── DISTRIBUTOR SCHEMAS ───
class DistributorBase(BaseModel):
    name: str
    region: str
    status: str = "active"

class DistributorCreate(DistributorBase):
    pass

class DistributorResponse(DistributorBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# ─── PLAN SCHEMAS ───
class PlanResponse(BaseModel):
    id: str
    name: str
    max_devices: int
    retention_days: int
    ai_queries_limit: int
    
    class Config:
        from_attributes = True

# ─── COMMUNITY SCHEMAS ───
class CommunityBase(BaseModel):
    name: str
    region: str
    city: Optional[str] = None
    status: str = "active"

class CommunityCreate(CommunityBase):
    distributor_id: Optional[str] = None

class CommunityResponse(CommunityBase):
    id: str
    distributor_id: Optional[str] = None
    slug: Optional[str] = None
    created_at: datetime
    node_count: Optional[int] = 0
    
    class Config:
        from_attributes = True

# ─── CUSTOMER SCHEMAS ───
class CustomerBase(BaseModel):
    full_name: str
    email: EmailStr
    contact_number: Optional[str] = None
    community_id: Optional[str] = None
    distributor_id: Optional[str] = None
    plan_id: Optional[str] = None
    status: str = "active"

class CustomerCreate(CustomerBase):
    pass

class CustomerOnboard(CustomerBase):
    password: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: str
    supabase_user_id: Optional[str] = None
    joining_date: date
    created_at: datetime
    
    class Config:
        from_attributes = True

class NodeSummary(BaseModel):
    id: str
    node_key: str = Field(..., alias="hardware_id")
    label: str = Field(..., alias="device_label")
    category: str = Field(..., alias="device_type")
    analytics_type: str
    status: str
    
    class Config:
        from_attributes = True

class CustomerDetail(CustomerResponse):
    devices: List["NodeSummary"] = []

# ─── NODE / DEVICE SCHEMAS ───
class NodeBase(BaseModel):
    node_key: str = Field(..., alias="hardware_id")
    label: str = Field(..., alias="device_label")
    category: str = Field(..., alias="device_type")
    analytics_type: str # EvaraTank, EvaraDeep, EvaraFlow
    status: str = "provisioning"
    lat: Optional[float] = None
    lng: Optional[float] = Field(None, alias="long")

class NodeCreate(NodeBase):
    customer_id: Optional[str] = None
    community_id: Optional[str] = None
    distributor_id: Optional[str] = None
    # Specialized Configs (Optional during creation)
    config_tank: Optional[Dict[str, Any]] = None
    config_deep: Optional[Dict[str, Any]] = None
    config_flow: Optional[Dict[str, Any]] = None
    
    # Telemetry Mapping
    thingspeak_mapping: Optional[Dict[str, Any]] = None

class NodeSummary(BaseModel):
    id: str
    node_key: str = Field(..., alias="hardware_id")
    label: str = Field(..., alias="device_label")
    category: str = Field(..., alias="device_type")
    analytics_type: str
    status: str
    
    class Config:
        from_attributes = True

class NodeResponse(NodeBase):
    id: str
    created_at: datetime
    customer_id: Optional[str] = None
    community_id: Optional[str] = None
    distributor_id: Optional[str] = None
    
    # Specialized Configs
    config_tank: Optional[Dict[str, Any]] = None
    config_deep: Optional[Dict[str, Any]] = None
    config_flow: Optional[Dict[str, Any]] = None
    
    # Telemetry Mapping
    thingspeak_mapping: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
        populate_by_name = True

class NodeAnalyticsResponse(BaseModel):
    """Response model for node analytics endpoint."""
    node_id: str
    days_to_empty: Optional[float] = None
    rolling_avg_flow: Optional[float] = None
    
    class Config:
        from_attributes = True

# ─── SYSTEM CONFIG SCHEMAS ───
class SystemConfigUpdate(BaseModel):
    rate: int
    firmware: str

class SystemConfigResponse(BaseModel):
    key: str
    data_rate: int
    firmware_version: str
    updated_at: datetime
    
    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: str
    action_type: str
    performed_by: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    metadata_json: Dict[str, Any] = Field(..., alias="metadata")
    timestamp: datetime
    
    class Config:
        from_attributes = True
        populate_by_name = True

# ─── LEGACY USER SCHEMAS (For compatibility) ───
class UserBase(BaseModel):
    email: EmailStr
    display_name: str | None = None
    role: str = "customer"

class UserResponse(UserBase):
    id: str
    
    class Config:
        from_attributes = True
