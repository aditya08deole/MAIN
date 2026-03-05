"""
Smoke tests for root and health endpoints.
Uses TestClient (synchronous) since these endpoints have no DB dependency.
"""
import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_root_returns_api_info(client):
    """Root endpoint returns API metadata."""
    resp = client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "EvaraTech Backend API"
    assert "version" in body
    assert "docs" in body
    assert "api_prefix" in body


def test_health_returns_expected_fields(client):
    """Health endpoint returns status, database, timestamp, and services."""
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body
    assert "database" in body
    assert "timestamp" in body
    assert "services" in body
    # Status must be one of the documented values
    assert body["status"] in ("ok", "degraded", "critical")


def test_config_check_endpoint(client):
    """Config-check endpoint lists booleans for each expected env var."""
    resp = client.get("/config-check")
    assert resp.status_code == 200
    body = resp.json()
    assert "database_url_set" in body
    assert "supabase_url_set" in body
    assert "environment" in body
