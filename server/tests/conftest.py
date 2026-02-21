"""
Testing utilities and fixtures for backend tests
Provides test database setup and common test patterns
"""
import pytest
import asyncio
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from database import Base
from config import get_settings

# ============================================================================
# TEST DATABASE SETUP
# ============================================================================

# Use in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def test_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Create test database session.
    Fresh database for each test function.
    """
    # Create test engine
    engine = create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()
    
    # Drop tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest.fixture
def test_settings():
    """Override settings for testing."""
    settings = get_settings()
    settings.ENVIRONMENT = "testing"
    return settings


# ============================================================================
# TEST DATA FIXTURES
# ============================================================================

@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "id": "test-user-123",
        "email": "test@example.com",
        "display_name": "Test User",
        "role": "customer"
    }


@pytest.fixture
def sample_device_data():
    """Sample device data for testing."""
    return {
        "node_key": "TEST-NODE-001",
        "label": "Test Device",
        "category": "Tank",
        "status": "active",
        "lat": 13.0827,
        "lng": 80.2707,
        "location_name": "Chennai",
        "thingspeak_channel_id": "123456",
        "thingspeak_read_key": "test-read-key",
        "user_id": "test-user-123"
    }


@pytest.fixture
async def create_test_user(test_db: AsyncSession, sample_user_data):
    """Create test user in database."""
    from models import User
    
    user = User(**sample_user_data)
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
async def create_test_device(test_db: AsyncSession, sample_device_data):
    """Create test device in database."""
    from models import Device
    
    device = Device(**sample_device_data)
    test_db.add(device)
    await test_db.commit()
    await test_db.refresh(device)
    return device


# ============================================================================
# API TEST HELPERS
# ============================================================================

class MockRequest:
    """Mock FastAPI request for testing."""
    
    def __init__(self, method: str = "GET", path: str = "/"):
        self.method = method
        self.url = type('obj', (object,), {'path': path})()
        self.state = type('obj', (object,), {})()


def create_mock_user_payload(user_id: str = "test-user-123", email: str = "test@example.com"):
    """Create mock JWT payload for testing."""
    return {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "user_metadata": {"role": "customer"}
    }


# ============================================================================
# PERFORMANCE TEST UTILITIES
# ============================================================================

class PerformanceTimer:
    """Context manager for timing operations."""
    
    def __init__(self, name: str, threshold_ms: float = 1000):
        self.name = name
        self.threshold_ms = threshold_ms
        self.start_time = None
        self.duration_ms = None
    
    def __enter__(self):
        import time
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        import time
        self.duration_ms = (time.time() - self.start_time) * 1000
        
        if self.duration_ms > self.threshold_ms:
            print(f"⚠️  {self.name} took {self.duration_ms:.2f}ms (threshold: {self.threshold_ms}ms)")
        else:
            print(f"✓ {self.name} completed in {self.duration_ms:.2f}ms")


# ============================================================================
# ASSERTION HELPERS
# ============================================================================

def assert_response_structure(response: dict, required_fields: list):
    """Assert response contains required fields."""
    for field in required_fields:
        assert field in response, f"Missing required field: {field}"


def assert_valid_datetime(datetime_str: str):
    """Assert string is valid ISO datetime."""
    from datetime import datetime
    try:
        datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
    except ValueError:
        pytest.fail(f"Invalid datetime format: {datetime_str}")


def assert_valid_uuid(uuid_str: str):
    """Assert string is valid UUID."""
    import uuid
    try:
        uuid.UUID(uuid_str)
    except ValueError:
        pytest.fail(f"Invalid UUID format: {uuid_str}")
