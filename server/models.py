"""
Database models - simplified and clean.
Only essential tables: users and devices.
"""
from sqlalchemy import Column, String, Float, DateTime, JSON, Boolean
from database import Base
from datetime import datetime
import uuid


class User(Base):
    """User profile synchronized from Supabase Auth."""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)  # Supabase UUID
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    role = Column(String, default="customer")  # customer, distributor, superadmin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Device(Base):
    """IoT Device/Node with ThingSpeak integration and map display."""
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_key = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=False)
    
    # Map Display Fields
    name = Column(String, nullable=True)  # Display name (e.g., "Pump House 1", "Borewell P5")
    asset_type = Column(String, nullable=True)  # pump, sump, tank, bore, govt, pipeline, sensor
    asset_category = Column(String, nullable=True)  # Subcategory (e.g., "Primary Hub", "IIIT Bore")
    
    # Legacy category field (kept for backwards compatibility)
    category = Column(String)  # Tank, Borewell, Flow, etc.
    
    # Status (supports both legacy and map status values)
    # Legacy: active, inactive, maintenance
    # Map: Working, Not Working, Normal, Running, Critical
    status = Column(String, default="active")
    
    # Geographic Coordinates
    latitude = Column(Float, nullable=True, index=True)  # New standardized field
    longitude = Column(Float, nullable=True, index=True)  # New standardized field
    lat = Column(Float, nullable=True)  # Legacy field (kept for backwards compatibility)
    lng = Column(Float, nullable=True)  # Legacy field (kept for backwards compatibility)
    location_name = Column(String, nullable=True)
    
    # Technical Specifications
    capacity = Column(String, nullable=True)  # e.g., "4.98L L", "5 HP"
    specifications = Column(String, nullable=True)  # Additional specs
    
    # Active Status
    is_active = Column(String, default='true')  # String 'true'/'false' for compatibility
    
    # ThingSpeak Integration
    thingspeak_channel_id = Column(String, nullable=True)
    thingspeak_read_key = Column(String, nullable=True)
    field_mapping = Column(JSON, default={})  # {"field1": "water_level", "field2": "temperature"}
    
    # Ownership
    user_id = Column(String, nullable=False, index=True)  # Owner (references User.id)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)


class AuditLog(Base):
    """Audit log for tracking user actions."""
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)  # References User.id
    action = Column(String, nullable=False)  # create, update, delete, login, etc.
    resource_type = Column(String, nullable=False)  # device, user, pipeline, etc.
    resource_id = Column(String, nullable=True)  # ID of affected resource
    details = Column(JSON, nullable=True)  # Additional context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class FrontendError(Base):
    """Frontend error logs for monitoring and debugging."""
    __tablename__ = "frontend_errors"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    error_message = Column(String, nullable=False)
    stack_trace = Column(String, nullable=True)
    url = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    user_id = Column(String, nullable=True, index=True)  # Optional: if available
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Pipeline(Base):
    """Water distribution pipelines for map visualization."""
    __tablename__ = "pipelines"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    pipeline_type = Column(String, nullable=False)  # 'water_supply', 'borewell_water'
    
    # Device relationships (optional)
    from_device_id = Column(String, nullable=True)
    to_device_id = Column(String, nullable=True)
    
    # Geographic data: array of [lng, lat] pairs for polyline
    coordinates = Column(JSON, nullable=False)
    
    # Pipeline specifications
    diameter = Column(String, nullable=True)
    material = Column(String, nullable=True)
    installation_type = Column(String, nullable=True)
    
    # Visual properties
    color = Column(String, default='#00b4d8')
    
    # Status tracking
    status = Column(String, default='Active')
    is_active = Column(Boolean, default=True)  # Boolean type to match database schema
    
    # Metadata
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, nullable=True)

