"""
Database models - simplified and clean.
Only essential tables: users and devices.
"""
from sqlalchemy import Column, String, Float, DateTime, JSON
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
    """IoT Device/Node with ThingSpeak integration."""
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    node_key = Column(String, unique=True, nullable=False, index=True)
    label = Column(String, nullable=False)
    category = Column(String)  # Tank, Borewell, Flow, etc.
    status = Column(String, default="active")  # active, inactive, maintenance
    
    # Location
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    location_name = Column(String, nullable=True)
    
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
