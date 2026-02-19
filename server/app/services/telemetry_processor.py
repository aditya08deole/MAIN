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
        P14: Also upserts DeviceState with latest values + health scores.
        """
        if not readings:
            return

        # Fetch Node to validate ownership/config
        node = await self.repo.get(node_id)
        if not node:
            print(f"Node {node_id} not found during processing.")
            return

        all_readings_flat: dict = {}  # Collects latest value per field for AlertEngine

        for raw in readings:
            ts_str = raw.get("timestamp")
            try:
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00")) if ts_str else datetime.utcnow()
            except ValueError:
                ts = datetime.utcnow()

            # Store one row per field (field_name + value are NOT NULL in schema)
            for key, val in raw.items():
                if key == "timestamp" or val is None:
                    continue
                try:
                    float_val = float(val)
                except (ValueError, TypeError):
                    continue

                reading_entry = models.NodeReading(
                    id=str(uuid.uuid4()),
                    node_id=node_id,
                    field_name=str(key),
                    value=float_val,
                    timestamp=ts,
                    data=raw,
                )
                self.db.add(reading_entry)
                all_readings_flat[key] = float_val

        await self.db.commit()

        # Evaluate alert rules against this batch of readings
        if all_readings_flat:
            try:
                from app.services.alert_engine import AlertEngine
                ae = AlertEngine(self.db)
                await ae.check_rules(node_id, all_readings_flat)
            except Exception as ae_err:
                print(f"AlertEngine error for {node_id}: {ae_err}")
        
        # P14: Upsert DeviceState with latest values
        try:
            latest = readings[-1] if readings else {}
            # Extract first numeric value from reading for current_value
            current_val = None
            for key in ["water_level", "tds", "temperature", "field1", "field2"]:
                if key in latest and latest[key] is not None:
                    try:
                        current_val = float(latest[key])
                    except (ValueError, TypeError):
                        pass
                    break
            
            existing_state = await self.db.get(models.DeviceState, node_id)
            if existing_state:
                existing_state.current_value = current_val
                existing_state.current_status = node.status
                existing_state.last_reading_at = datetime.utcnow()
                existing_state.readings_24h = (existing_state.readings_24h or 0) + len(readings)
            else:
                new_state = models.DeviceState(
                    device_id=node_id,
                    current_value=current_val,
                    current_status=node.status,
                    last_reading_at=datetime.utcnow(),
                    readings_24h=len(readings),
                )
                self.db.add(new_state)
            
            await self.db.commit()
            
            # P15: Update health scores
            from app.services.health_calculator import HealthCalculator
            calc = HealthCalculator(self.db)
            scores = await calc.compute(node_id, latest)
            
            state = await self.db.get(models.DeviceState, node_id)
            if state:
                state.health_score = scores["health_score"]
                state.confidence_score = scores["confidence_score"]
                state.readings_24h = scores["readings_24h"]
                await self.db.commit()
                
        except Exception as e:
            print(f"DeviceState upsert error for {node_id}: {e}")
        
        # P40: Anomaly Detection
        try:
            await self._update_anomaly_score(node_id, readings)
        except Exception as e:
            print(f"Anomaly detection error for {node_id}: {e}")

    async def _update_anomaly_score(self, node_id: str, readings: list):
        """
        P40: Simple Z-score anomaly detection.
        Compares latest reading to recent average. Score > 3.0 = anomaly.
        """
        if not readings:
            return

        from sqlalchemy import func
        from datetime import timedelta

        # Get last 24h stats for field1 using proper field_name/value columns
        cutoff = datetime.utcnow() - timedelta(hours=24)
        stats_result = await self.db.execute(
            select(
                func.avg(models.NodeReading.value),
                func.stddev(models.NodeReading.value),
            ).where(
                models.NodeReading.node_id == node_id,
                models.NodeReading.field_name == "field1",
                models.NodeReading.timestamp >= cutoff,
            )
        )
        row = stats_result.first()

        if not row or row[0] is None or row[1] is None or row[1] == 0:
            return

        avg_val, std_val = float(row[0]), float(row[1])

        # Z-score of latest reading
        latest = readings[-1]
        current_val = latest.get("field1") or latest.get("water_level")
        if current_val is None:
            return

        try:
            z_score = abs(float(current_val) - avg_val) / std_val
        except (ValueError, ZeroDivisionError):
            return

        state = await self.db.get(models.DeviceState, node_id)
        if state:
            state.anomaly_score = round(z_score, 3)
            await self.db.commit()
        
        # Alert if anomaly score is very high
        if z_score > 3.0:
            from app.services.alert_engine import AlertEngine
            ae = AlertEngine(self.db)
            # Check maintenance window before creating alert
            if not await ae._in_maintenance_window(node_id):
                alert = models.AlertHistory(
                    id=str(uuid.uuid4()),
                    node_id=node_id,
                    severity="warning",
                    category="anomaly",
                    title=f"[WARNING] Node {node_id} — Anomalous reading detected",
                    message=f"Z-score {z_score:.2f} exceeds threshold 3.0. Value {current_val} vs 24h avg {avg_val:.2f} ± {std_val:.2f}.",
                    value_at_time=float(current_val),
                )
                self.db.add(alert)
                await self.db.commit()

