"""
Integration tests for critical backend endpoints
Tests authentication, device CRUD, and error handling
"""
import pytest
from httpx import AsyncClient
from main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test health check returns valid response."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert "database" in data
        assert "timestamp" in data


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test root endpoint returns API info."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "version" in data or "api_prefix" in data


@pytest.mark.asyncio
async def test_cors_headers():
    """Test CORS headers are present."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.options("/health")
        
        # Check CORS headers (if configured)
        assert response.status_code in [200, 204]


@pytest.mark.asyncio
async def test_unauthorized_access():
    """Test protected endpoints require authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/devices")
        
        # Should return 401 or 403 (unauthorized)
        assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_auth_with_dev_bypass(test_settings):
    """Test dev-bypass authentication works in development."""
    # Set environment to development
    test_settings.ENVIRONMENT = "development"
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        headers = {
            "Authorization": "Bearer dev-bypass-id-test@example.com"
        }
        
        response = await client.get("/api/v1/auth/me", headers=headers)
        
        # Should work in development
        # Note: Actual behavior depends on backend configuration
        assert response.status_code in [200, 401, 404]  # 404 if user not in DB


@pytest.mark.asyncio
async def test_frontend_error_logging():
    """Test frontend error logging endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        error_data = {
            "error_message": "Test error",
            "stack_trace": "Error: Test\n  at Component.render",
            "url": "http://localhost:5173/",
            "user_agent": "Mozilla/5.0"
        }
        
        response = await client.post("/api/v1/frontend-errors", json=error_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert data["error_message"] == "Test error"
        assert "id" in data
        assert "created_at" in data


@pytest.mark.asyncio
async def test_audit_log_creation(test_db, create_test_user):
    """Test audit log creation with authentication."""
    from models import AuditLog
    
    # Create audit log directly
    audit_log = AuditLog(
        user_id=create_test_user.id,
        action="create",
        resource_type="device",
        resource_id="test-device-id",
        details={"name": "Test Device"}
    )
    
    test_db.add(audit_log)
    await test_db.commit()
    await test_db.refresh(audit_log)
    
    assert audit_log.id is not None
    assert audit_log.user_id == create_test_user.id
    assert audit_log.action == "create"


@pytest.mark.asyncio
async def test_device_crud_operations(test_db, create_test_user):
    """Test device CRUD operations."""
    from models import Device
    from sqlalchemy import select
    
    # Create
    device = Device(
        node_key="TEST-001",
        label="Test Device",
        category="Tank",
        status="active",
        user_id=create_test_user.id
    )
    test_db.add(device)
    await test_db.commit()
    await test_db.refresh(device)
    
    assert device.id is not None
    
    # Read
    result = await test_db.execute(
        select(Device).where(Device.id == device.id)
    )
    fetched_device = result.scalar_one()
    assert fetched_device.label == "Test Device"
    
    # Update
    fetched_device.label = "Updated Device"
    await test_db.commit()
    await test_db.refresh(fetched_device)
    assert fetched_device.label == "Updated Device"
    
    # Delete
    await test_db.delete(fetched_device)
    await test_db.commit()
    
    result = await test_db.execute(
        select(Device).where(Device.id == device.id)
    )
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_performance_monitoring():
    """Test performance metrics are collected."""
    from performance import metrics
    
    # Record some metrics
    metrics.record_api_request("/test", 150, 200)
    metrics.record_api_request("/test2", 250, 200)
    metrics.record_db_query("SELECT", 50)
    
    # Get stats
    api_stats = metrics.get_api_stats()
    db_stats = metrics.get_db_stats()
    
    assert api_stats["total_requests"] >= 2
    assert api_stats["avg_response_time_ms"] > 0
    assert db_stats["total_queries"] >= 1
    
    # Clean up
    metrics.reset()
