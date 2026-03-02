import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, JSON, Boolean, Integer, ForeignKey, UUID
from sqlalchemy.orm import relationship
from database import Base


class Zone(Base):
    """Enterprise-grade geographic zones for organizing communities."""
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False, index=True)
    state = Column(String, nullable=True)
    country = Column(String, default="India")
    zone_code = Column(String, nullable=True, index=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    geo_boundary = Column(JSON, nullable=True)  # GeoJSON polygon
    distributor_id = Column(UUID(as_uuid=False), ForeignKey("distributors.id", ondelete="CASCADE"), nullable=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    regional_admin_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    communities = relationship("Community", back_populates="zone")
    distributor = relationship("Distributor", back_populates="zones")

class Plan(Base):
    """SaaS Subscription Plans for Distributors."""
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    max_devices = Column(Integer, default=5)
    retention_days = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    distributors = relationship("Distributor", back_populates="plan")

class Distributor(Base):
    """Top-level tenancy abstraction (B2B/Resellers)."""
    __tablename__ = "distributors"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    region = Column(String, nullable=True)
    status = Column(String, default="active") # active, inactive, suspended
    plan_id = Column(UUID(as_uuid=False), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    tenant_metadata = Column('metadata', JSON, default={})
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    plan = relationship("Plan", back_populates="distributors")
    zones = relationship("Zone", back_populates="distributor")
    customers = relationship("Customer", back_populates="distributor")

class Community(Base):
    """Enterprise communities within zones where devices are deployed."""
    __tablename__ = "communities"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    zone_id = Column(UUID(as_uuid=False), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    address = Column(String, nullable=True)
    pincode = Column(String, nullable=True, index=True)
    contact_person = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    operational_status = Column(String, default="active", index=True)
    contact_info = Column(JSON, nullable=True) # Actual column in DB
    meta_data = Column('metadata', JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    zone = relationship("Zone", back_populates="communities")
    users = relationship("Customer", back_populates="community")
    devices = relationship("Device", back_populates="community")

class Customer(Base):
    """Authoritative tenant/customer profile (Identical to profiles table)."""
    __tablename__ = "customers"
 
    id = Column(UUID(as_uuid=False), primary_key=True)  # Supabase UUID
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    phone_number = Column(String, nullable=True, index=True)
    role = Column(String, default="customer", index=True)
    community_id = Column(UUID(as_uuid=False), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True, index=True)
    distributor_id = Column(UUID(as_uuid=False), ForeignKey("distributors.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String, default="active", index=True)
    meta_data = Column('metadata', JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
 
    # Relationships
    community = relationship("Community", back_populates="users")
    distributor = relationship("Distributor", back_populates="customers")
    devices = relationship("Device", back_populates="owner", foreign_keys="Device.user_id", lazy="selectin")


class Device(Base):
    """Refined IoT Device model focusing on core functionality."""
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_key = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=False)
    name = Column(String, nullable=True, index=True)
    asset_type = Column(String, nullable=True)
    status = Column(String, default="active")

    # Geographic Coordinates (Normalized)
    latitude = Column(Float, nullable=True, index=True)
    longitude = Column(Float, nullable=True, index=True)

    # Technical/IoT Fields
    device_type = Column(String, nullable=True)
    last_seen = Column(DateTime, nullable=True, index=True)
    is_active = Column(Boolean, default=True)

    # Telemetry Configuration (Normalized into JSON)
    device_telemetry_config = Column(JSON, default={})
    last_fetched_at = Column(DateTime, nullable=True)

    # Hierarchy & Ownership
    community_id = Column(UUID(as_uuid=False), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    community = relationship("Community", back_populates="devices")
    owner = relationship("Customer", back_populates="devices", foreign_keys=[user_id])
    telemetry_snapshot = relationship("DeviceTelemetrySnapshot", back_populates="device", uselist=False, cascade="all, delete-orphan")
    
    # Normalized Configs (1:1)
    config_tank = relationship("DeviceConfigTank", back_populates="device", uselist=False, cascade="all, delete-orphan")
    config_flow = relationship("DeviceConfigFlow", back_populates="device", uselist=False, cascade="all, delete-orphan")
    config_deep = relationship("DeviceConfigDeep", back_populates="device", uselist=False, cascade="all, delete-orphan")

class DeviceConfigTank(Base):
    """Normalized configuration for Tank-type devices."""
    __tablename__ = "device_config_tank"

    device_id = Column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    tank_shape = Column(String) # cylinder, rectangular
    dimension_unit = Column(String, default="m")
    radius = Column(Float)
    height = Column(Float)
    length = Column(Float)
    breadth = Column(Float)
    
    # Isolated Credentials
    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="config_tank")

class DeviceConfigFlow(Base):
    """Normalized configuration for Flow-type devices."""
    __tablename__ = "device_config_flow"

    device_id = Column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    max_flow_rate = Column(Float)
    pipe_diameter = Column(Float)
    abnormal_threshold = Column(Float)
    
    # Isolated Credentials
    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="config_flow")

class DeviceConfigDeep(Base):
    """Normalized configuration for Deep Well devices."""
    __tablename__ = "device_config_deep"

    device_id = Column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), primary_key=True)
    static_depth = Column(Float)
    dynamic_depth = Column(Float)
    recharge_threshold = Column(Float)
    
    # Isolated Credentials
    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="config_deep")


# ============================================================================
# TELEMETRY SNAPSHOT
# ============================================================================

class DeviceTelemetrySnapshot(Base):
    """Core Telemetry Snapshot table. The single source of truth for Realtime UI broadcast."""
    __tablename__ = "telemetry_snapshots"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), index=True, unique=True)
    payload = Column(JSON, nullable=False) # Raw ThingSpeak feed
    mapped_values = Column(JSON) # Legacy JSON storage
    thingspeak_entry_id = Column(Integer, nullable=True)
    last_timestamp = Column(DateTime, nullable=False, index=True)
    
    # Strongly Typed Columns (Phase 1)
    level_percentage = Column(Float, nullable=True, index=True)
    depth_value = Column(Float, nullable=True)
    temperature_value = Column(Float, nullable=True)
    flow_rate = Column(Float, nullable=True, index=True)
    total_liters = Column(Integer, nullable=True) # Using Integer for simplicity in SQLAlchemy mapping

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    device = relationship("Device", back_populates="telemetry_snapshot")


# ============================================================================
# AUDIT LOG
# ============================================================================

class AuditLog(Base):
    """Audit log for tracking user actions."""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    distributor_id = Column(UUID(as_uuid=False), ForeignKey("distributors.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("Customer", foreign_keys=[user_id])


# ============================================================================
# FRONTEND ERROR
# ============================================================================

class FrontendError(Base):
    """Frontend error logs for monitoring and debugging."""
    __tablename__ = "frontend_errors"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    error_message = Column(String, nullable=False)
    stack_trace = Column(String, nullable=True)
    url = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    user_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# ============================================================================
# PIPELINE
# ============================================================================

class Pipeline(Base):
    """Water distribution pipelines for map visualization."""
    __tablename__ = "pipelines"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    pipeline_type = Column(String, nullable=False)

    from_device_id = Column(String, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    to_device_id = Column(String, ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)

    coordinates = Column(JSON, nullable=False)

    diameter = Column(String, nullable=True)
    material = Column(String, nullable=True)
    installation_type = Column(String, nullable=True)

    color = Column(String, default='#00b4d8')

    status = Column(String, default='Active')
    is_active = Column(Boolean, default=True)

    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)


# ============================================================================
# DEVICE SHARE
# ============================================================================

class DeviceShare(Base):
    """Refined model for tracking device sharing/access permissions."""
    __tablename__ = "device_shares"

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(UUID(as_uuid=False), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    access_level = Column(String, default="viewer")  # viewer, admin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
