from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, DateTime, Boolean, Date
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from datetime import datetime

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

# ─── USER MODEL (LEGACY/ADMIN PROFILE) ───

class User(Base):
    __tablename__ = "users_profiles"
    
    id: Mapped[str] = mapped_column(String, primary_key=True) # Supabase UUID
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="customer") # superadmin, distributor, customer
    
    # Relationships
    audit_logs = relationship("AuditLog", back_populates="user")

# ─── NODE / DEVICE MODEL ───

class Node(Base):
    __tablename__ = "nodes"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_key: Mapped[str] = mapped_column(String, unique=True, index=True, name="hardware_id")
    label: Mapped[str] = mapped_column(String, name="device_label")
    category: Mapped[str] = mapped_column(String, name="device_type") # tank, deep, flow, custom
    analytics_type: Mapped[str] = mapped_column(String) # EvaraTank, EvaraDeep, EvaraFlow
    
    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lng: Mapped[float] = mapped_column(Float, nullable=True, name="long")
    status: Mapped[str] = mapped_column(String, default="provisioning")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
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
