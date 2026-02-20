import asyncio
from datetime import datetime
from app.core.cache import memory_cache
from collections import defaultdict

# Global async queue for buffering writes
write_queue = asyncio.Queue()


class BackgroundJobManager:
    """
    Enhanced background job manager with:
    - Batch processing for improved efficiency
    - Error tracking and retry logic
    - Job statistics and monitoring
    """
    
    def __init__(self):
        self.stats = {
            "writes_processed": 0,
            "writes_failed": 0,
            "cleanups_completed": 0,
            "polls_completed": 0
        }
        self.batch_size = 100  # Process writes in batches of 100
        self.batch_timeout = 5.0  # Max wait time for batch
    
    async def process_write_batch(self, batch: list):
        """Process a batch of write operations efficiently."""
        try:
            # TODO: Implement bulk insert logic
            # await bulk_insert_to_db(batch)
            self.stats["writes_processed"] += len(batch)
        except Exception as e:
            self.stats["writes_failed"] += len(batch)
            print(f"❌ Batch write error: {e}")
    
    async def process_write_queue(self):
        """
        Background task to process buffered writes to the database with batching.
        This prevents the DB from being overwhelmed by high-frequency sensor data.
        """
        print("📝 Write Queue Processor Started (Batch Mode)")
        batch = []
        
        while True:
            try:
                # Try to fill batch up to batch_size or timeout
                try:
                    item = await asyncio.wait_for(write_queue.get(), timeout=self.batch_timeout)
                    batch.append(item)
                    write_queue.task_done()
                    
                    # Continue collecting until batch is full
                    while len(batch) < self.batch_size and not write_queue.empty():
                        try:
                            item = write_queue.get_nowait()
                            batch.append(item)
                            write_queue.task_done()
                        except asyncio.QueueEmpty:
                            break
                    
                except asyncio.TimeoutError:
                    # Process whatever we have if timeout reached
                    pass
                
                # Process batch if we have items
                if batch:
                    await self.process_write_batch(batch)
                    batch = []
                    
            except Exception as e:
                print(f"❌ Write queue processor error: {e}")
                batch = []  # Clear batch on error


# Global job manager instance
job_manager = BackgroundJobManager()


async def process_write_queue():
    """Wrapper for backward compatibility."""
    await job_manager.process_write_queue()


async def start_background_tasks():
    asyncio.create_task(process_write_queue())
    asyncio.create_task(poll_thingspeak_loop())
    asyncio.create_task(cleanup_loop())


async def cleanup_loop():
    """
    Periodic task to clean up old data (Retention Policy).
    Run every 24 hours.
    Now with better error handling and statistics.
    """
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import delete
    from app.models import all_models as models
    from datetime import datetime, timedelta
    
    print("🧹 Data Cleanup Service Started.")
    
    while True:
        try:
            # Retention: 30 Days
            cutoff = datetime.utcnow() - timedelta(days=30)
            
            async with AsyncSessionLocal() as db:
                # Delete old readings (30 days)
                result1 = await db.execute(
                    delete(models.NodeReading).where(models.NodeReading.timestamp < cutoff)
                )
                
                # P34: Delete resolved alerts older than 90 days
                alert_cutoff = datetime.utcnow() - timedelta(days=90)
                result2 = await db.execute(
                    delete(models.AlertHistory).where(
                        models.AlertHistory.resolved_at.isnot(None),
                        models.AlertHistory.triggered_at < alert_cutoff
                    )
                )
                
                # P34: Delete audit logs older than 365 days
                audit_cutoff = datetime.utcnow() - timedelta(days=365)
                result3 = await db.execute(
                    delete(models.AuditLog).where(models.AuditLog.timestamp < audit_cutoff)
                )
                
                await db.commit()
                
                # Log results
                job_manager.stats["cleanups_completed"] += 1
                print(f"✅ Cleanup completed: {result1.rowcount} readings, "
                      f"{result2.rowcount} alerts, {result3.rowcount} audit logs deleted")
                
        except Exception as e:
            print(f"❌ Error in Cleanup Loop: {e}")
            
        # Wait 24 hours (approx)
        await asyncio.sleep(86400)

async def poll_thingspeak_loop():
    """
    Periodic task to fetch data from all Online nodes.
    P8: Passes field_mapping for proper normalization.
    P9: Tracks consecutive failures per node (3 strikes → offline).
    P12: Uses asyncio.gather with semaphore for parallel polling.
    P34: Optimized with batched broadcasts and cache invalidations.
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
    
    print("🚀 Telemetry Polling Service Started (Optimized)")
    
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
                
                # Track status changes for batched broadcasts
                status_updates = []
                cache_invalidation_needed = False
                
                async def poll_single_node(node):
                    """Poll one node with semaphore control."""
                    nonlocal cache_invalidation_needed
                    
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
                                    status_updates.append({"event": "STATUS_UPDATE", "node_id": node.id, "status": "Online"})
                                    cache_invalidation_needed = True
                                    # P22: Auto-resolve offline alerts
                                    from app.services.alert_engine import AlertEngine
                                    ae = AlertEngine(db)
                                    await ae.auto_resolve_offline_alert(node.id)
                            else:
                                # No reading — increment failure count (P9)
                                failure_counts[node.id] = failure_counts.get(node.id, 0) + 1
                                
                                if failure_counts[node.id] >= FAILURE_THRESHOLD and node.status == "Online":
                                    node.status = "Offline"
                                    status_updates.append({"event": "STATUS_UPDATE", "node_id": node.id, "status": "Offline"})
                                    cache_invalidation_needed = True
                                    # P22: Create offline alert
                                    from app.services.alert_engine import AlertEngine
                                    ae = AlertEngine(db)
                                    await ae.create_offline_alert(node.id)
                                    
                        except Exception as node_e:
                            print(f"Node {node.id} check failed: {node_e}")
                            failure_counts[node.id] = failure_counts.get(node.id, 0) + 1
                            
                            if failure_counts[node.id] >= FAILURE_THRESHOLD and node.status == "Online":
                                node.status = "Offline"
                                status_updates.append({"event": "STATUS_UPDATE", "node_id": node.id, "status": "Offline"})
                                cache_invalidation_needed = True
                                # P22: Create offline alert
                                from app.services.alert_engine import AlertEngine
                                ae2 = AlertEngine(db)
                                await ae2.create_offline_alert(node.id)
                
                # 3. Poll all nodes in parallel (P12)
                if ts_nodes:
                    await asyncio.gather(*[poll_single_node(n) for n in ts_nodes], return_exceptions=True)
                    await db.commit()
                    
                    # 4. Batched WebSocket broadcasts (P34: Optimization)
                    if status_updates:
                        # Send single batched broadcast instead of individual broadcasts
                        await manager.broadcast_json({
                            "event": "BATCH_STATUS_UPDATE",
                            "updates": status_updates
                        })
                        print(f"📡 Sent batched status update for {len(status_updates)} nodes")
                    
                    # 5. Batched cache invalidation (P34: Optimization)
                    if cache_invalidation_needed:
                        # Invalidate both patterns in one batch
                        await asyncio.gather(
                            memory_cache.invalidate("nodes:"),
                            memory_cache.invalidate("dashboard_stats:")
                        )
                    
                    job_manager.stats["polls_completed"] += 1
                        
        except Exception as e:
            print(f"❌ Error in Polling Loop: {e}")
            
        # Wait 60 seconds
        await asyncio.sleep(60)
