"""
Phase 16: Telemetry Ingestion Engine
High-throughput endpoint optimized for sensor data ingestion.
Uses batch inserts and minimal validation for speed.
"""
from typing import Any, List, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.response import StandardResponse
from app.schemas.validators import TelemetryValidator
from app.core.cache import memory_cache
from app.services.websockets import manager
from datetime import datetime
import json

router = APIRouter()

class IngestPayload:
    """Lightweight payload for sensor readings (no Pydantic overhead)."""
    pass

@router.post("/readings")
async def ingest_readings(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    High-performance telemetry ingestion endpoint.
    Accepts: { "node_key": "...", "readings": [{"field": "tds", "value": 120.5}, ...] }
    Optimized for throughput over correctness (async commit).
    """
    from app.models.all_models import NodeReading
    from app.db.repository import NodeRepository
    
    node_key = payload.get("node_key")
    readings = payload.get("readings", [])
    
    if not node_key or not readings:
        raise HTTPException(status_code=400, detail="Missing node_key or readings")
    
    # Validate readings
    validator = TelemetryValidator()
    valid_readings = []
    for r in readings:
        value = r.get("value")
        field = r.get("field", "unknown")
        
        if value is not None and validator.validate_reading(float(value)):
            valid_readings.append({
                "field": field,
                "value": float(value),
                "timestamp": r.get("timestamp", datetime.utcnow().isoformat())
            })
    
    if not valid_readings:
        return StandardResponse(status="error", message="No valid readings in payload")
    
    # Batch insert (fire-and-forget for speed)
    try:
        repo = NodeRepository(db)
        node = await repo.get_by_key(node_key)
        
        if not node:
            raise HTTPException(status_code=404, detail=f"Node {node_key} not found")
        
        # Create reading objects
        for reading in valid_readings:
            db_reading = NodeReading(
                node_id=node.id,
                field_name=reading["field"],
                value=reading["value"],
                timestamp=datetime.fromisoformat(reading["timestamp"]) if isinstance(reading["timestamp"], str) else reading["timestamp"]
            )
            db.add(db_reading)
        
        await db.commit()
        
        # Invalidate cache & broadcast
        await memory_cache.invalidate(f"nodes:")
        await manager.broadcast(json.dumps({
            "event": "TELEMETRY_UPDATE",
            "node_id": node.id,
            "readings_count": len(valid_readings)
        }))
        
        return StandardResponse(
            data={"ingested": len(valid_readings), "node_id": node.id},
            meta={"timestamp": datetime.utcnow().isoformat()}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
