import uuid
from typing import Dict, Any, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import all_models as models
from app.db.repository import NodeRepository

class TelemetryProcessor:
    """
    Core pipeline service for processing incoming raw telemetry.
    Handles storage, validation, and triggers alerts (future).
    """
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NodeRepository(db)

    async def process_readings(self, node_id: str, readings: List[Dict[str, Any]]):
        """
        Ingest a batch of normalized readings.
        """
        if not readings:
            return

        # Fetch Node to validate ownership/config (optional cache here)
        node = await self.repo.get(node_id)
        if not node:
            print(f"Node {node_id} not found during processing.")
            return

        for raw in readings:
            # 1. Normalize
            # Assuming raw has 'timestamp' and fields
            ts_str = raw.get("timestamp")
            if not ts_str:
                continue
                
            # Parse timestamp (ThingSpeak ISO format)
            try:
                # "2023-10-27T10:00:00Z" -> datetime
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            except ValueError:
                ts = datetime.utcnow()

            # 2. Store to DB (NodeReading)
            # Check for duplicates? For now, we rely on timestamp/ID uniqueness or just append
            # To avoid massive duplicates during polling, we should check max timestamp in DB first.
            # Skipped for MVP performance, assuming polling interval > data rate
            
            reading_entry = models.NodeReading(
                id=str(uuid.uuid4()),
                node_id=node_id,
                timestamp=ts,
                data=raw # Store full raw payload as JSON
            )
            self.db.add(reading_entry)
            
            # 3. Update Node Status/Last Contact
            # node.last_seen = ts ... (if we added that field)
            
        await self.db.commit()
        
        # 4. Trigger Alerts
        from app.services.alert_engine import AlertEngine
        alert_engine = AlertEngine(self.db)
        
        # Check alerts for the last reading in the batch (most recent state)
        if readings:
            await alert_engine.check_rules(node_id, readings[-1])
