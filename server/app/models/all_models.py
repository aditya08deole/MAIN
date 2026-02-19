from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, DateTime, Boolean, Date
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from datetime import datetime
import uuid

# ─── TENANCY & HIERARCHY MODELS ───

class Distributor(Base):
    __tablename__ = "distributors"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    region: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(String, nullable=True) # auth.users ID

    communities = relationship("Community", back_populates="distributor")
    customers = relationship("Customer", back_populates="distributor")
    devices = relationship("Node", back_populates="distributor")

class Plan(Base):
    __tablename__ = "plans"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    max_devices: Mapped[int] = mapped_column(Integer, default=5)
    retention_days: Mapped[int] = mapped_column(Integer, default=30)
    ai_queries_limit: Mapped[int] = mapped_column(Integer, default=50)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customers = relationship("Customer", back_populates="plan")

class Community(Base):
    __tablename__ = "communities"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    region: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default={}, name="metadata")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_by: Mapped[str] = mapped_column(String, nullable=True)
    
    # Tenancy
    distributor_id: Mapped[str] = mapped_column(ForeignKey("distributors.id"), nullable=True, index=True)
    
    # Relationships
    distributor = relationship("Distributor", back_populates="communities")
    customers = relationship("Customer", back_populates="community")
    nodes = relationship("Node", back_populates="community")

class Customer(Base):
    __tablename__ = "customers"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    supabase_user_id: Mapped[str] = mapped_column(String, unique=True, nullable=True)
    contact_number: Mapped[str] = mapped_column(String, nullable=True)
    joining_date: Mapped[Date] = mapped_column(Date, default=datetime.utcnow().date())
    status: Mapped[str] = mapped_column(String, default="active")
    metadata_json: Mapped[dict] = mapped_column(JSON, default={}, name="metadata")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"), nullable=True, index=True)
    distributor_id: Mapped[str] = mapped_column(ForeignKey("distributors.id"), nullable=True, index=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"), nullable=True, index=True)
    
    # Relationships
    community = relationship("Community", back_populates="customers")
    distributor = relationship("Distributor", back_populates="customers")
    plan = relationship("Plan", back_populates="customers")
    devices = relationship("Node", back_populates="customer")

# ─── USER MODEL (MATCHES FRONTEND EXPECTATIONS) ───

class User(Base):
    __tablename__ = "users_profiles"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)  # Supabase UUID
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="customer")  # superadmin, distributor, customer
    plan: Mapped[str] = mapped_column(String, default="base")       # base, plus, pro
    created_by: Mapped[str] = mapped_column(String, nullable=True)
    distributor_id: Mapped[str] = mapped_column(String, nullable=True)
    community_id: Mapped[str] = mapped_column(String, nullable=True)  # Used for scoped dashboard queries
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")

# ─── NODE / DEVICE MODEL ───

class Node(Base):
    __tablename__ = "nodes"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    label: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)  # OHT, Sump, Borewell, etc.
    analytics_type: Mapped[str] = mapped_column(String)  # EvaraTank, EvaraDeep, EvaraFlow

    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lng: Mapped[float] = mapped_column(Float, nullable=True)
    location_name: Mapped[str] = mapped_column(String, nullable=True)
    capacity: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="provisioning")
    last_seen: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Tenancy
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"), nullable=True, index=True)
    distributor_id: Mapped[str] = mapped_column(ForeignKey("distributors.id"), nullable=True, index=True)
    
    customer = relationship("Customer", back_populates="devices")
    community = relationship("Community", back_populates="nodes")
    distributor = relationship("Distributor", back_populates="devices")
    
    # Specialized Configs
    config_tank = relationship("DeviceConfigTank", back_populates="device", uselist=False)
    config_deep = relationship("DeviceConfigDeep", back_populates="device", uselist=False)
    config_flow = relationship("DeviceConfigFlow", back_populates="device", uselist=False)
    thingspeak_mapping = relationship("DeviceThingSpeakMapping", back_populates="device", uselist=False)

# ─── SPECIALIZED CONFIG MODELS ───

class DeviceConfigTank(Base):
    __tablename__ = "device_config_tank"
    device_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)
    capacity: Mapped[int] = mapped_column(Integer, nullable=True)
    max_depth: Mapped[float] = mapped_column(Float, nullable=True)
    temp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    device = relationship("Node", back_populates="config_tank")

class DeviceConfigDeep(Base):
    __tablename__ = "device_config_deep"
    device_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)
    static_depth: Mapped[float] = mapped_column(Float, nullable=True)
    dynamic_depth: Mapped[float] = mapped_column(Float, nullable=True)
    recharge_threshold: Mapped[float] = mapped_column(Float, nullable=True)
    device = relationship("Node", back_populates="config_deep")

class DeviceConfigFlow(Base):
    __tablename__ = "device_config_flow"
    device_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)
    max_flow_rate: Mapped[float] = mapped_column(Float, nullable=True)
    pipe_diameter: Mapped[float] = mapped_column(Float, nullable=True)
    abnormal_threshold: Mapped[float] = mapped_column(Float, nullable=True)
    device = relationship("Node", back_populates="config_flow")

class DeviceThingSpeakMapping(Base):
    __tablename__ = "device_thingspeak_mapping"
    device_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)
    channel_id: Mapped[str] = mapped_column(String, nullable=False)
    read_api_key: Mapped[str] = mapped_column(String, nullable=True)
    write_api_key: Mapped[str] = mapped_column(String, nullable=True)
    field_mapping: Mapped[dict] = mapped_column(JSON, default={})
    last_sync_time: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    device = relationship("Node", back_populates="thingspeak_mapping")

# ─── UTILITY MODELS ───

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"))
    action: Mapped[str] = mapped_column(String, name="action_type")
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[str] = mapped_column(String, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, nullable=True, name="metadata")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="audit_logs")

# ─── NODE ASSIGNMENTS MODEL ───

class NodeAssignment(Base):
    __tablename__ = "node_assignments"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=False)
    assigned_by: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ─── PIPELINES MODEL ───

class Pipeline(Base):
    __tablename__ = "pipelines"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, default="#3b82f6")
    positions: Mapped[dict] = mapped_column(JSON, nullable=False) # Array of [lat, lng] pairs
    created_by: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ─── ALERT MODELS (P19/P20) ───

class AlertRule(Base):
    __tablename__ = "alert_rules"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(String, nullable=False)  # field1, water_level, etc.
    operator: Mapped[str] = mapped_column(String, nullable=False)  # >, <, ==
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String, default="warning")  # critical, warning, info
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=15)  # De-dupe window
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AlertHistory(Base):
    __tablename__ = "alert_history"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False, index=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("alert_rules.id"), nullable=True)
    
    # P19: Rich alert context
    severity: Mapped[str] = mapped_column(String, default="warning")  # critical, warning, info
    category: Mapped[str] = mapped_column(String, nullable=True)  # threshold_exceeded, offline, maintenance_due
    title: Mapped[str] = mapped_column(String, nullable=True)
    message: Mapped[str] = mapped_column(String, nullable=True)
    value_at_time: Mapped[float] = mapped_column(Float, nullable=True)
    
    # Lifecycle
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    acknowledged_by: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=True)
    acknowledged_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    resolve_comment: Mapped[str] = mapped_column(String, nullable=True)

# ─── NODE READINGS (Telemetry Storage) ───

class NodeReading(Base):
    __tablename__ = "node_readings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False, index=True)
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    data: Mapped[dict] = mapped_column(JSON, default={})  # Optional full payload
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ─── NODE ANALYTICS MODEL ───

class NodeAnalytics(Base):
    __tablename__ = "node_analytics"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False)
    period_type: Mapped[str] = mapped_column(String, nullable=False) # hourly, daily, weekly, monthly
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    consumption_liters: Mapped[float] = mapped_column(Float, nullable=True)
    avg_level_percent: Mapped[float] = mapped_column(Float, nullable=True)
    peak_flow: Mapped[float] = mapped_column(Float, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ─── DEVICE STATE CACHE (P13) ───

class DeviceState(Base):
    __tablename__ = "device_states"
    
    device_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)
    current_value: Mapped[float] = mapped_column(Float, nullable=True)
    current_status: Mapped[str] = mapped_column(String, nullable=True)
    health_score: Mapped[float] = mapped_column(Float, default=1.0)  # 0.0–1.0
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0–1.0
    anomaly_score: Mapped[float] = mapped_column(Float, nullable=True)
    last_reading_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    readings_24h: Mapped[int] = mapped_column(Integer, default=0)
    avg_value_24h: Mapped[float] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# ─── DEVICE HEALTH HISTORY (P18) ───

class DeviceHealthHistory(Base):
    __tablename__ = "device_health_history"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False, index=True)
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    health_score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    readings_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ─── DEVICE GROUP MODELS (P37) ───

class DeviceGroup(Base):
    __tablename__ = "device_groups"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class DeviceGroupMembership(Base):
    __tablename__ = "device_group_memberships"
    
    group_id: Mapped[str] = mapped_column(ForeignKey("device_groups.id"), primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), primary_key=True)

# ─── MAINTENANCE WINDOWS (P38) ───

class MaintenanceWindow(Base):
    __tablename__ = "maintenance_windows"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False, index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# ─── WEBHOOK SUBSCRIPTIONS (P42) ───

class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    url: Mapped[str] = mapped_column(String, nullable=False)
    events: Mapped[dict] = mapped_column(JSON, default=[])  # ["alert.triggered", "device.offline"]
    secret: Mapped[str] = mapped_column(String, nullable=True)  # HMAC signing secret
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
