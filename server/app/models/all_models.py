from sqlalchemy import Column, String, Integer, Float, ForeignKey, JSON, DateTime, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base
from datetime import datetime

# ─── TENANCY & HIERARCHY MODELS ───

class Organization(Base):
    __tablename__ = "organizations"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    # Subscription / Plan details
    plan_tier: Mapped[str] = mapped_column(String, default="free") 
    
    regions = relationship("Region", back_populates="organization")

class Region(Base):
    __tablename__ = "regions"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    
    organization = relationship("Organization", back_populates="regions")
    communities = relationship("Community", back_populates="region")

class Community(Base):
    __tablename__ = "communities"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    
    # Tenancy
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"))
    
    # Relationships
    organization = relationship("Organization")
    users = relationship("User", back_populates="community")
    nodes = relationship("Node", back_populates="community")
    region = relationship("Region", back_populates="communities")

# ─── USER MODEL ───

class User(Base):
    __tablename__ = "users_profiles"
    
    id: Mapped[str] = mapped_column(String, primary_key=True) # Supabase UUID
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="customer") # superadmin, distributor, customer
    plan: Mapped[str] = mapped_column(String, default="base")
    
    # Hierarchy
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"), nullable=True)
    
    organization = relationship("Organization")
    community = relationship("Community", back_populates="users")
    
    # Relationships
    assignments = relationship("NodeAssignment", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


# ─── NODE MODEL (Polymorphic Base) ───

class Node(Base):
    __tablename__ = "nodes"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_key: Mapped[str] = mapped_column(String, unique=True, index=True)
    label: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String) # OHT, Sump, Borewell, etc.
    analytics_type: Mapped[str] = mapped_column(String) # EvaraTank, EvaraDeep, EvaraFlow
    
    location_name: Mapped[str] = mapped_column(String, nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lng: Mapped[float] = mapped_column(Float, nullable=True)
    capacity: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="Offline")
    
    # Device Registry Metadata
    firmware_version: Mapped[str] = mapped_column(String, nullable=True)
    calibration_factor: Mapped[float] = mapped_column(Float, default=1.0)
    last_maintenance_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    # Device Shadow (Twin)
    shadow_state: Mapped[dict] = mapped_column(JSON, default={}, nullable=True)

    # ThingSpeak config
    thingspeak_channel_id: Mapped[str] = mapped_column(String, nullable=True)
    thingspeak_read_api_key: Mapped[str] = mapped_column(String, nullable=True)
    
    # Tenancy
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), nullable=True)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"), nullable=True)
    
    organization = relationship("Organization")
    community = relationship("Community", back_populates="nodes")
    
    # Relationships
    assignments = relationship("NodeAssignment", back_populates="node")
    readings = relationship("NodeReading", back_populates="node")
    alert_rules = relationship("AlertRule", back_populates="node")
    alert_history = relationship("AlertHistory", back_populates="node")

    # OOP: Polymorphic Identity
    __mapper_args__ = {
        "polymorphic_identity": "node",
        "polymorphic_on": analytics_type,
    }

# ─── INHERITED NODE TYPES ───

class TankNode(Node):
    __mapper_args__ = {"polymorphic_identity": "EvaraTank"}

class DeepNode(Node):
    __mapper_args__ = {"polymorphic_identity": "EvaraDeep"}

class FlowNode(Node):
    __mapper_args__ = {"polymorphic_identity": "EvaraFlow"}


# ─── PIPELINE MODEL ───

class Pipeline(Base):
    __tablename__ = "pipelines"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String)
    positions: Mapped[list] = mapped_column(JSON) # Store [[lat, lng], ...]


# ─── ASSIGNMENTS & READINGS ───

class NodeAssignment(Base):
    __tablename__ = "node_assignments"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"))
    
    node = relationship("Node", back_populates="assignments")
    user = relationship("User", back_populates="assignments")

class NodeReading(Base):
    __tablename__ = "node_analytics"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    data: Mapped[dict] = mapped_column(JSON) 
    
    node = relationship("Node", back_populates="readings")

# ─── SYSTEM & UTILITY MODELS ───

class SystemConfig(Base):
    __tablename__ = "system_config"
    
    key: Mapped[str] = mapped_column(String, primary_key=True)
    data_rate: Mapped[int] = mapped_column(Integer, default=60)
    firmware_version: Mapped[str] = mapped_column(String, default="v2.1.0")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class ProvisioningToken(Base):
    __tablename__ = "provisioning_tokens"
    
    token: Mapped[str] = mapped_column(String, primary_key=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"))
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    
    creator = relationship("User")
    community = relationship("Community")

class AlertRule(Base):
    __tablename__ = "alert_rules"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"))
    metric: Mapped[str] = mapped_column(String)
    operator: Mapped[str] = mapped_column(String)
    threshold: Mapped[float] = mapped_column(Float)
    severity: Mapped[str] = mapped_column(String, default="warning")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    node = relationship("Node", back_populates="alert_rules")

class AlertHistory(Base):
    __tablename__ = "alert_history"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    node_id: Mapped[str] = mapped_column(String, ForeignKey("nodes.id"))
    rule_id: Mapped[str] = mapped_column(ForeignKey("alert_rules.id"))
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    value_at_time: Mapped[float] = mapped_column(Float)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True, index=True)
    
    node = relationship("Node", back_populates="alert_history")
    rule = relationship("AlertRule")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users_profiles.id"))
    action: Mapped[str] = mapped_column(String)
    resource_type: Mapped[str] = mapped_column(String)
    resource_id: Mapped[str] = mapped_column(String, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    
    user = relationship("User", back_populates="audit_logs")
