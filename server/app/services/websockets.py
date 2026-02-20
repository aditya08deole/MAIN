import asyncio
from typing import List, Dict, Set, Optional
from fastapi import WebSocket
from collections import defaultdict
from datetime import datetime
import json


class ConnectionManager:
    """
    Enhanced WebSocket ConnectionManager with:
    - Connection pooling and limits
    - Message queue for buffering
    - Heartbeat/ping-pong for health monitoring
    - Automatic cleanup of dead connections
    - Subscription-based broadcasting
    - Connection statistics
    """
    
    def __init__(self, max_connections: int = 1000, heartbeat_interval: int = 30):
        # Active connections
        self.active_connections: List[WebSocket] = []
        
        # Subscription mapping: topic -> List[WebSocket]
        self.subscriptions: Dict[str, List[WebSocket]] = defaultdict(list)
        
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict] = {}
        
        # Message queue for buffering (per connection)
        self.message_queues: Dict[WebSocket, asyncio.Queue] = {}
        
        # Dead connections tracking
        self.dead_connections: Set[WebSocket] = set()
        
        # Configuration
        self.max_connections = max_connections
        self.heartbeat_interval = heartbeat_interval
        
        # Statistics
        self.stats = {
            "total_connections": 0,
            "total_messages": 0,
            "total_broadcasts": 0,
            "failed_sends": 0
        }
        
        # Background task for cleanup
        self._cleanup_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None):
        """Connect a new WebSocket client with connection pooling."""
        # Enforce connection limit
        if len(self.active_connections) >= self.max_connections:
            await websocket.close(code=1008, reason="Connection limit reached")
            raise Exception(f"Max connections ({self.max_connections}) reached")
        
        await websocket.accept()
        self.active_connections.append(websocket)
        
        # Initialize metadata
        self.connection_metadata[websocket] = {
            "client_id": client_id or f"ws_{id(websocket)}",
            "connected_at": datetime.utcnow(),
            "last_ping": datetime.utcnow(),
            "message_count": 0
        }
        
        # Initialize message queue
        self.message_queues[websocket] = asyncio.Queue(maxsize=100)
        
        # Start message worker for this connection
        asyncio.create_task(self._message_worker(websocket))
        
        # Update stats
        self.stats["total_connections"] += 1
        
        # Start cleanup task if not running
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_dead_connections())
        
        print(f"✅ WS Connected: {self.connection_metadata[websocket]['client_id']} "
              f"(Active: {len(self.active_connections)}/{self.max_connections})")

    def disconnect(self, websocket: WebSocket):
        """Disconnect a WebSocket client and cleanup resources."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        # Remove from all subscriptions
        for topic in list(self.subscriptions.keys()):
            if websocket in self.subscriptions[topic]:
                self.subscriptions[topic].remove(websocket)
                if not self.subscriptions[topic]:
                    del self.subscriptions[topic]
        
        # Cleanup metadata and queue
        client_id = self.connection_metadata.get(websocket, {}).get("client_id", "unknown")
        self.connection_metadata.pop(websocket, None)
        self.message_queues.pop(websocket, None)
        self.dead_connections.discard(websocket)
        
        print(f"❌ WS Disconnected: {client_id} "
              f"(Active: {len(self.active_connections)}/{self.max_connections})")

    async def subscribe(self, websocket: WebSocket, topic: str):
        """Subscribe a connection to a specific topic."""
        if websocket not in self.subscriptions[topic]:
            self.subscriptions[topic].append(websocket)
            print(f"📡 WS Subscribed: {self.connection_metadata[websocket]['client_id']} -> {topic}")

    async def unsubscribe(self, websocket: WebSocket, topic: str):
        """Unsubscribe a connection from a topic."""
        if websocket in self.subscriptions.get(topic, []):
            self.subscriptions[topic].remove(websocket)
            print(f"🔇 WS Unsubscribed: {self.connection_metadata[websocket]['client_id']} <- {topic}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send message to a specific connection via queue."""
        if websocket in self.active_connections and websocket not in self.dead_connections:
            try:
                # Use non-blocking put to prevent queue overflow
                self.message_queues[websocket].put_nowait(message)
                self.connection_metadata[websocket]["message_count"] += 1
                self.stats["total_messages"] += 1
            except asyncio.QueueFull:
                print(f"⚠️  Message queue full for {self.connection_metadata[websocket]['client_id']}")
                self.stats["failed_sends"] += 1

    async def _message_worker(self, websocket: WebSocket):
        """Background worker to send queued messages."""
        queue = self.message_queues[websocket]
        
        try:
            while websocket in self.active_connections:
                # Get message from queue (with timeout)
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=1.0)
                    await websocket.send_text(message)
                except asyncio.TimeoutError:
                    # Send heartbeat ping
                    if websocket not in self.dead_connections:
                        try:
                            await websocket.send_text(json.dumps({"type": "ping"}))
                            self.connection_metadata[websocket]["last_ping"] = datetime.utcnow()
                        except Exception:
                            self.dead_connections.add(websocket)
                except Exception as e:
                    print(f"❌ Message worker error: {e}")
                    self.dead_connections.add(websocket)
                    break
        except Exception as e:
            print(f"❌ Message worker fatal error: {e}")
        finally:
            # Cleanup on worker exit
            if websocket in self.active_connections:
                self.disconnect(websocket)

    async def broadcast(self, message: str, topic: Optional[str] = None):
        """
        Broadcast message to all connected clients or specific topic subscribers.
        Uses message queue for reliable delivery.
        """
        self.stats["total_broadcasts"] += 1
        
        # Determine target connections
        if topic and topic in self.subscriptions:
            targets = self.subscriptions[topic]
            print(f"📢 Broadcasting to topic '{topic}': {len(targets)} subscribers")
        else:
            targets = self.active_connections
            print(f"📢 Broadcasting to all: {len(targets)} connections")
        
        # Queue messages for all targets
        for connection in targets[:]:  # Use slice to avoid modification during iteration
            if connection not in self.dead_connections:
                await self.send_personal_message(message, connection)

    async def broadcast_json(self, data: dict, topic: Optional[str] = None):
        """Broadcast JSON data."""
        message = json.dumps(data)
        await self.broadcast(message, topic)

    async def _cleanup_dead_connections(self):
        """Background task to cleanup dead connections periodically."""
        while True:
            try:
                await asyncio.sleep(self.heartbeat_interval)
                
                # Cleanup dead connections
                for websocket in list(self.dead_connections):
                    self.disconnect(websocket)
                
                # Check for stale connections (no ping in 2x heartbeat interval)
                cutoff = datetime.utcnow().timestamp() - (self.heartbeat_interval * 2)
                for websocket, metadata in list(self.connection_metadata.items()):
                    if metadata["last_ping"].timestamp() < cutoff:
                        print(f"⚠️  Stale connection detected: {metadata['client_id']}")
                        self.dead_connections.add(websocket)
                        self.disconnect(websocket)
                
            except Exception as e:
                print(f"❌ Cleanup task error: {e}")

    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            **self.stats,
            "active_connections": len(self.active_connections),
            "dead_connections": len(self.dead_connections),
            "subscriptions": {topic: len(conns) for topic, conns in self.subscriptions.items()},
            "max_connections": self.max_connections
        }


# Global ConnectionManager instance
manager = ConnectionManager()
