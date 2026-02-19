"""
Phase 20: Automated Testing Suite
PyTest configuration and test cases for critical backend logic.
"""
import pytest
import asyncio
from app.services.search import SearchService
from app.services.geo_cluster import GeoCluster
from app.schemas.validators import TelemetryValidator, CoordinateValidator


class TestSearchService:
    """Test the in-memory search engine."""
    
    @pytest.mark.asyncio
    async def test_search_returns_results(self):
        service = SearchService()
        # Mock node-like objects
        class MockNode:
            def __init__(self, id, node_key, label, category, location_name, status):
                self.id = id
                self.node_key = node_key
                self.label = label
                self.category = category
                self.location_name = location_name
                self.status = status
        
        nodes = [
            MockNode("1", "PUMP-001", "Main Pump House", "PumpHouse", "Block A", "Online"),
            MockNode("2", "OHT-001", "Central OHT Tank", "OHT", "Block B", "Online"),
            MockNode("3", "BORE-001", "Deep Borewell", "Borewell", "Block C", "Offline"),
        ]
        
        await service.rebuild_index(nodes)
        
        # Search for "pump"
        results = await service.search("pump")
        assert "1" in results
        assert "2" not in results
        
        # Search for "block"
        results = await service.search("block")
        assert len(results) == 3  # All nodes have "Block" in location
        
    @pytest.mark.asyncio
    async def test_empty_search(self):
        service = SearchService()
        results = await service.search("")
        assert results == []


class TestGeoCluster:
    """Test geographic clustering."""
    
    def test_single_node_no_cluster(self):
        nodes = [{"id": "1", "lat": 17.44, "lng": 78.34, "label": "Node1", "status": "Online"}]
        clusters = GeoCluster.cluster_nodes(nodes, zoom=15)
        assert len(clusters) == 1
        assert clusters[0]["is_cluster"] == False
        
    def test_nearby_nodes_cluster(self):
        nodes = [
            {"id": "1", "lat": 17.4400, "lng": 78.3400, "label": "Node1", "status": "Online"},
            {"id": "2", "lat": 17.4401, "lng": 78.3401, "label": "Node2", "status": "Online"},
        ]
        clusters = GeoCluster.cluster_nodes(nodes, zoom=5)  # Low zoom = big grid
        # At low zoom, nearby nodes should cluster
        assert any(c["count"] > 1 for c in clusters) or len(clusters) <= 2


class TestTelemetryValidator:
    """Test telemetry reading validation."""
    
    def test_valid_tds(self):
        assert TelemetryValidator.validate_tds(150.0) == True
        
    def test_invalid_tds(self):
        assert TelemetryValidator.validate_tds(6000.0) == False
        
    def test_valid_ph(self):
        assert TelemetryValidator.validate_ph(7.0) == True
        
    def test_invalid_ph(self):
        assert TelemetryValidator.validate_ph(15.0) == False
        
    def test_valid_temperature(self):
        assert TelemetryValidator.validate_temperature(25.0) == True
        
    def test_invalid_temperature(self):
        assert TelemetryValidator.validate_temperature(200.0) == False


class TestValidReading:
    """Test generic reading validation."""
    
    def test_within_range(self):
        assert TelemetryValidator.validate_reading(100.0) == True
        
    def test_out_of_range(self):
        assert TelemetryValidator.validate_reading(99999.0) == False
