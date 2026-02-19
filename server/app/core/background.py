import asyncio
from datetime import datetime
from app.core.cache import memory_cache

# Global async queue for buffering writes
write_queue = asyncio.Queue()

async def process_write_queue():
    """
    Background task to process buffered writes to the database.
    This prevents the DB from being overwhelmed by high-frequency sensor data.
    """
    while True:
        # Get a "work item" out of the queue.
        item = await write_queue.get()
        
        try:
            # Emulate processing (e.g., bulk insert logic would go here)
            # await item.save()
            pass
        except Exception as e:
            print(f"Error processing write queue: {e}")
        finally:
            # Notify the queue that the "work item" has been processed.
            write_queue.task_done()

async def start_background_tasks():
    asyncio.create_task(process_write_queue())
    asyncio.create_task(poll_thingspeak_loop())
    asyncio.create_task(cleanup_loop())

async def cleanup_loop():
    """
    Periodic task to clean up old data (Retention Policy).
    Run every 24 hours.
    """
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import delete
    from app.models import all_models as models
    from datetime import datetime, timedelta
    
    print("[CLEANUP] Data Cleanup Service Started.")
    
    while True:
        try:
            # Retention: 30 Days
            cutoff = datetime.utcnow() - timedelta(days=30)
            
            async with AsyncSessionLocal() as db:
                # Delete old readings (30 days)
                await db.execute(
                    delete(models.NodeReading).where(models.NodeReading.timestamp < cutoff)
                )
                
                # P34: Delete resolved alerts older than 90 days
                alert_cutoff = datetime.utcnow() - timedelta(days=90)
                await db.execute(
                    delete(models.AlertHistory).where(
                        models.AlertHistory.resolved_at.isnot(None),
                        models.AlertHistory.triggered_at < alert_cutoff
                    )
                )
                
                # P34: Delete audit logs older than 365 days
                audit_cutoff = datetime.utcnow() - timedelta(days=365)
                await db.execute(
                    delete(models.AuditLog).where(models.AuditLog.timestamp < audit_cutoff)
                )
                
                await db.commit()
                print(f"[CLEANUP] Cleanup: readings>{cutoff.date()}, alerts>{alert_cutoff.date()}, audits>{audit_cutoff.date()}")
                
        except Exception as e:
            print(f"[ERROR] Error in Cleanup Loop: {e}")
            
        # Wait 24 hours (approx)
        await asyncio.sleep(86400)

async def poll_thingspeak_loop():
    """
    Periodic task to fetch data from all Online nodes.
    P8: Passes field_mapping for proper normalization.
    P9: Tracks consecutive failures per node (3 strikes → offline).
    P12: Uses asyncio.gather with semaphore for parallel polling.
    """
    from app.db.session import AsyncSessionLocal
    from app.services.telemetry.thingspeak import ThingSpeakTelemetryService
    from app.services.telemetry_processor import TelemetryProcessor
    from app.models import all_models as models
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.services.websockets import manager
    import json
    
    ts_service = ThingSpeakTelemetryService()
    failure_counts: dict[str, int] = {}  # P9: Track consecutive failures per node
    FAILURE_THRESHOLD = 3  # Mark offline after 3 consecutive failures
    semaphore = asyncio.Semaphore(10)  # P12: Max 10 concurrent ThingSpeak calls
    
    print("🚀 Telemetry Polling Service Started.")
    
    while True:
        try:
            async with AsyncSessionLocal() as db:
                # 1. Get all nodes with ThingSpeak config
                result = await db.execute(
                    select(models.Node)
                    .options(joinedload(models.Node.thingspeak_mapping))
                    .where(
                        models.Node.status.in_(["Online", "Offline", "Alert"])
                    )
                )
                nodes = result.scalars().all()
                
                processor = TelemetryProcessor(db)
                
                # 2. Filter nodes with ThingSpeak mapping
                ts_nodes = [n for n in nodes if n.thingspeak_mapping and n.thingspeak_mapping.channel_id]
                
                async def poll_single_node(node):
                    """Poll one node with semaphore control."""
                    async with semaphore:
                        config = {
                            "channel_id": node.thingspeak_mapping.channel_id,
                            "read_key": node.thingspeak_mapping.read_api_key,
                            "field_mapping": node.thingspeak_mapping.field_mapping or {}  # P8
                        }
                        
                        try:
                            reading = await ts_service.fetch_latest(node.id, config)
                            
                            if reading:
                                # Success — reset failure count
                                failure_counts[node.id] = 0
                                await processor.process_readings(node.id, [reading])
                                
                                # Update last_seen (P5)
                                node.last_seen = datetime.utcnow()
                                
                                if node.status != "Online":
                                    node.status = "Online"
                                    await manager.broadcast(json.dumps({"event": "STATUS_UPDATE", "node_id": node.id, "status": "Online"}))
                                    await memory_cache.invalidate("nodes:")
                                    await memory_cache.invalidate("dashboard_stats:")
                                    # P22: Auto-resolve offline alerts
                                    from app.services.alert_engine import AlertEngine
                                    ae = AlertEngine(db)
                                    await ae.auto_resolve_offline_alert(node.id)
                            else:
                                # No reading — increment failure count (P9)
                                failure_counts[node.id] = failure_counts.get(node.id, 0) + 1
                                
                                if failure_counts[node.id] >= FAILURE_THRESHOLD and node.status == "Online":
                                    node.status = "Offline"
                                    await manager.broadcast(json.dumps({"event": "STATUS_UPDATE", "node_id": node.id, "status": "Offline"}))
                                    await memory_cache.invalidate("nodes:")
                                    await memory_cache.invalidate("dashboard_stats:")
                                    # P22: Create offline alert
                                    from app.services.alert_engine import AlertEngine
                                    ae = AlertEngine(db)
                                    await ae.create_offline_alert(node.id)
                                    
                        except Exception as node_e:
                            print(f"Node {node.id} check failed: {node_e}")
                            failure_counts[node.id] = failure_counts.get(node.id, 0) + 1
                            
                            if failure_counts[node.id] >= FAILURE_THRESHOLD and node.status == "Online":
                                node.status = "Offline"
                                await manager.broadcast(json.dumps({"event": "STATUS_UPDATE", "node_id": node.id, "status": "Offline"}))
                                await memory_cache.invalidate("nodes:")
                                await memory_cache.invalidate("dashboard_stats:")
                                # P22: Create offline alert
                                from app.services.alert_engine import AlertEngine
                                ae2 = AlertEngine(db)
                                await ae2.create_offline_alert(node.id)
                
                # 3. Poll all nodes in parallel (P12)
                if ts_nodes:
                    await asyncio.gather(*[poll_single_node(n) for n in ts_nodes], return_exceptions=True)
                    await db.commit()
                        
        except Exception as e:
            print(f"[ERROR] Error in Polling Loop: {e}")
            
        # Wait 60 seconds
        await asyncio.sleep(60)
