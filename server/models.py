import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, JSON, Boolean, Integer, BigInteger, ForeignKey, Text, UUID
from sqlalchemy.orm import relationship
from database import Base

# NOTE: UUID(as_uuid=False) keeps UUIDs as plain strings — compatible with
# asyncpg + PgBouncer transaction mode. Do NOT change to as_uuid=True.


# ============================================================
# ZONES
# ============================================================
class Zone(Base):
    __tablename__ = "zones"

    id             = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name           = Column(String, unique=True, nullable=False, index=True)
    state          = Column(String, nullable=True)
    country        = Column(String, default="India")
    zone_code      = Column(String, nullable=True, index=True)
    description    = Column(String, nullable=True)
    is_active      = Column(Boolean, default=True, index=True)
    geo_boundary   = Column(JSON, nullable=True)
    distributor_id = Column(UUID(as_uuid=False), ForeignKey("distributors.id", ondelete="CASCADE"), nullable=True, index=True)
    deleted_at     = Column(DateTime, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    communities = relationship("Community", back_populates="zone")
    distributor = relationship("Distributor", back_populates="zones")


# ============================================================
# PLANS
# ============================================================
class Plan(Base):
    __tablename__ = "plans"

    id             = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name           = Column(String, unique=True, nullable=False)
    max_devices    = Column(Integer, default=5)
    retention_days = Column(Integer, default=30)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    distributors = relationship("Distributor", back_populates="plan")


# ============================================================
# DISTRIBUTOR
# ============================================================
class Distributor(Base):
    __tablename__ = "distributors"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    region     = Column(String, nullable=True)
    status     = Column(String, default="active")
    plan_id    = Column(UUID(as_uuid=False), ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plan      = relationship("Plan", back_populates="distributors")
    zones     = relationship("Zone", back_populates="distributor")
    customers = relationship("Customer", back_populates="distributor")


# ============================================================
# COMMUNITY
# ============================================================
class Community(Base):
    __tablename__ = "communities"

    id                 = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name               = Column(String, nullable=False)
    zone_id            = Column(UUID(as_uuid=False), ForeignKey("zones.id", ondelete="CASCADE"), nullable=False, index=True)
    address            = Column(String, nullable=True)
    pincode            = Column(String, nullable=True, index=True)
    contact_person     = Column(String, nullable=True)
    contact_email      = Column(String, nullable=True)
    contact_phone      = Column(String, nullable=True)
    operational_status = Column(String, default="active", index=True)
    contact_info       = Column(JSON, nullable=True)
    created_at         = Column(DateTime, default=datetime.utcnow)
    updated_at         = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    zone      = relationship("Zone",        back_populates="communities")
    customers = relationship("Customer",    back_populates="community")
    tanks     = relationship("EvaraTank",   back_populates="community")
    flows     = relationship("EvaraFlow",   back_populates="community")
    deeps     = relationship("EvaraDeep",   back_populates="community")


# ============================================================
# SUPERADMIN  (Supabase Auth linked profile)
# ============================================================
class SuperAdmin(Base):
    __tablename__ = "superadmin"

    id           = Column(UUID(as_uuid=False), primary_key=True)  # Supabase Auth UUID
    email        = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================
# CUSTOMER  (Supabase Auth linked profile)
# ============================================================
class Customer(Base):
    __tablename__ = "customers"

    id             = Column(UUID(as_uuid=False), primary_key=True)  # Supabase Auth UUID
    email          = Column(String, unique=True, nullable=False, index=True)
    display_name   = Column(String, nullable=True)
    full_name      = Column(String, nullable=True)
    phone_number   = Column(String, nullable=True, index=True)
    role           = Column(String, default="customer", index=True)
    community_id   = Column(UUID(as_uuid=False), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True, index=True)
    distributor_id = Column(UUID(as_uuid=False), ForeignKey("distributors.id", ondelete="SET NULL"), nullable=True, index=True)
    status         = Column(String, default="active", index=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    community   = relationship("Community",   back_populates="customers")
    distributor = relationship("Distributor", back_populates="customers")
    tanks       = relationship("EvaraTank",   back_populates="client", foreign_keys="EvaraTank.client_id")
    flows       = relationship("EvaraFlow",   back_populates="client", foreign_keys="EvaraFlow.client_id")
    deeps       = relationship("EvaraDeep",   back_populates="client", foreign_keys="EvaraDeep.client_id")


# ============================================================
# EVARATANK  — identity + config in one table
# ============================================================
class EvaraTank(Base):
    __tablename__ = "evaratank"

    id       = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_key = Column(String, unique=True, nullable=False, index=True)
    label    = Column(String, nullable=False)

    latitude  = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    community_id = Column(UUID(as_uuid=False), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id    = Column(UUID(as_uuid=False), ForeignKey("customers.id",   ondelete="SET NULL"), nullable=True, index=True)

    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key   = Column(String, nullable=True)
    thingspeak_write_key  = Column(String, nullable=True)

    water_level_field = Column(String, default="field1")
    temperature_field = Column(String, default="field2")

    tank_shape      = Column(String, default="rectangular")
    height_m        = Column(Float, nullable=True)
    length_m        = Column(Float, nullable=True)
    breadth_m       = Column(Float, nullable=True)
    radius_m        = Column(Float, nullable=True)
    capacity_liters = Column(Float, nullable=True)

    is_active       = Column(Boolean, default=True)
    webhook_secret  = Column(String,  nullable=True)
    last_seen       = Column(DateTime, nullable=True, index=True)
    last_fetched_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    community = relationship("Community", back_populates="tanks")
    client    = relationship("Customer",  back_populates="tanks", foreign_keys=[client_id])
    snapshot  = relationship("EvaraTankSnapshot", back_populates="device", uselist=False, cascade="all, delete-orphan")


# ============================================================
# EVARAFLOW  — identity + config in one table
# ============================================================
class EvaraFlow(Base):
    __tablename__ = "evaraflow"

    id       = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_key = Column(String, unique=True, nullable=False, index=True)
    label    = Column(String, nullable=False)

    latitude  = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    community_id = Column(UUID(as_uuid=False), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id    = Column(UUID(as_uuid=False), ForeignKey("customers.id",   ondelete="SET NULL"), nullable=True, index=True)

    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key   = Column(String, nullable=True)
    thingspeak_write_key  = Column(String, nullable=True)

    meter_reading_field = Column(String, default="field1")
    flow_rate_field     = Column(String, default="field2")

    pipe_diameter = Column(Float, nullable=True)
    max_flow_rate = Column(Float, nullable=True)

    is_active       = Column(Boolean, default=True)
    webhook_secret  = Column(String,  nullable=True)
    last_seen       = Column(DateTime, nullable=True, index=True)
    last_fetched_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    community = relationship("Community", back_populates="flows")
    client    = relationship("Customer",  back_populates="flows", foreign_keys=[client_id])
    snapshot  = relationship("EvaraFlowSnapshot", back_populates="device", uselist=False, cascade="all, delete-orphan")


# ============================================================
# EVARADEEP  — identity + config in one table
# ============================================================
class EvaraDeep(Base):
    __tablename__ = "evaradeep"

    id       = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_key = Column(String, unique=True, nullable=False, index=True)
    label    = Column(String, nullable=False)

    latitude  = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    community_id = Column(UUID(as_uuid=False), ForeignKey("communities.id", ondelete="SET NULL"), nullable=True, index=True)
    client_id    = Column(UUID(as_uuid=False), ForeignKey("customers.id",   ondelete="SET NULL"), nullable=True, index=True)

    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key   = Column(String, nullable=True)
    thingspeak_write_key  = Column(String, nullable=True)

    depth_field       = Column(String, default="field2")
    temperature_field = Column(String, default="field1")

    total_bore_depth    = Column(Float, nullable=True)
    static_water_level  = Column(Float, nullable=True)
    dynamic_water_level = Column(Float, nullable=True)
    recharge_threshold  = Column(Float, default=0)

    is_active       = Column(Boolean, default=True)
    webhook_secret  = Column(String,  nullable=True)
    last_seen       = Column(DateTime, nullable=True, index=True)
    last_fetched_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    community = relationship("Community", back_populates="deeps")
    client    = relationship("Customer",  back_populates="deeps", foreign_keys=[client_id])
    snapshot  = relationship("EvaraDeepSnapshot", back_populates="device", uselist=False, cascade="all, delete-orphan")


# ============================================================
# TELEMETRY SNAPSHOTS  (one row per device, always overwritten)
# ============================================================
class EvaraTankSnapshot(Base):
    __tablename__ = "evaratank_snapshots"

    device_id           = Column(UUID(as_uuid=False), ForeignKey("evaratank.id", ondelete="CASCADE"), primary_key=True)
    thingspeak_entry_id = Column(Integer,  nullable=True)
    last_timestamp      = Column(DateTime, nullable=False, index=True)
    raw_payload         = Column(JSON,     nullable=True)
    level_percentage    = Column(Float,    nullable=True)
    temperature_value   = Column(Float,    nullable=True)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("EvaraTank", back_populates="snapshot")


class EvaraFlowSnapshot(Base):
    __tablename__ = "evaraflow_snapshots"

    device_id           = Column(UUID(as_uuid=False), ForeignKey("evaraflow.id", ondelete="CASCADE"), primary_key=True)
    thingspeak_entry_id = Column(Integer,    nullable=True)
    last_timestamp      = Column(DateTime,   nullable=False, index=True)
    raw_payload         = Column(JSON,       nullable=True)
    flow_rate           = Column(Float,      nullable=True)
    total_liters        = Column(BigInteger, nullable=True)
    updated_at          = Column(DateTime,   default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("EvaraFlow", back_populates="snapshot")


class EvaraDeepSnapshot(Base):
    __tablename__ = "evaradeep_snapshots"

    device_id           = Column(UUID(as_uuid=False), ForeignKey("evaradeep.id", ondelete="CASCADE"), primary_key=True)
    thingspeak_entry_id = Column(Integer,  nullable=True)
    last_timestamp      = Column(DateTime, nullable=False, index=True)
    raw_payload         = Column(JSON,     nullable=True)
    depth_value         = Column(Float,    nullable=True)
    temperature_value   = Column(Float,    nullable=True)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("EvaraDeep", back_populates="snapshot")


# ============================================================
# TELEMETRY HISTORY  (append-only time-series)
# ============================================================
class TelemetryHistory(Base):
    __tablename__ = "telemetry_history"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id           = Column(UUID(as_uuid=False), nullable=False, index=True)  # no FK — polymorphic
    device_type         = Column(String, nullable=True)  # 'EvaraTank'|'EvaraFlow'|'EvaraDeep'
    thingspeak_entry_id = Column(Integer,  nullable=True, index=True)
    timestamp           = Column(DateTime, nullable=False, index=True)

    field1 = Column(Float, nullable=True)
    field2 = Column(Float, nullable=True)
    field3 = Column(Float, nullable=True)
    field4 = Column(Float, nullable=True)
    field5 = Column(Float, nullable=True)
    field6 = Column(Float, nullable=True)
    field7 = Column(Float, nullable=True)
    field8 = Column(Float, nullable=True)

    level_percentage  = Column(Float,      nullable=True)
    depth_value       = Column(Float,      nullable=True)
    temperature_value = Column(Float,      nullable=True)
    flow_rate         = Column(Float,      nullable=True)
    total_liters      = Column(BigInteger, nullable=True)

    ingested_at = Column(DateTime, default=datetime.utcnow)


# ============================================================
# ALERT EVENTS
# ============================================================
class AlertEvent(Base):
    __tablename__ = "alert_events"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id   = Column(UUID(as_uuid=False), nullable=False, index=True)  # no FK — polymorphic
    device_type = Column(String,  nullable=True)  # 'EvaraTank'|'EvaraFlow'|'EvaraDeep'
    alert_type  = Column(String,  nullable=False)
    field_name  = Column(String,  nullable=True)
    value       = Column(Float,   nullable=True)
    threshold   = Column(Float,   nullable=True)
    message     = Column(String,  nullable=True)
    resolved    = Column(Boolean, default=False)
    fired_at    = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)


# ============================================================
# AUDIT LOGS
# ============================================================
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id        = Column(UUID(as_uuid=False), nullable=True, index=True)  # nullable — superadmin too
    distributor_id = Column(UUID(as_uuid=False), ForeignKey("distributors.id", ondelete="SET NULL"), nullable=True, index=True)
    action         = Column(String, nullable=False)
    resource_type  = Column(String, nullable=False)
    resource_id    = Column(String, nullable=True)
    details        = Column(JSON,   nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, index=True)


# ============================================================
# BACKGROUND JOBS
# ============================================================
class Job(Base):
    __tablename__ = "jobs"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    type        = Column(String, nullable=False, index=True)
    payload     = Column(JSON, nullable=True)
    status      = Column(String, default="queued", index=True)
    result      = Column(JSON, nullable=True)
    error       = Column(Text, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, index=True)
    started_at  = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


