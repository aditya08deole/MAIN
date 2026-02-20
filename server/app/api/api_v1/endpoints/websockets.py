from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.websockets import manager
import json

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: str = Query(None, description="Optional client identifier")
):
    """
    Enhanced WebSocket endpoint with:
    - Connection pooling and limits
    - Topic subscriptions
    - Heartbeat/pong handling
    - JSON message protocol
    """
    await manager.connect(websocket, client_id=client_id)
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            
            try:
                # Parse JSON message
                message = json.loads(data)
                msg_type = message.get("type")
                
                # Handle different message types
                if msg_type == "subscribe":
                    # Subscribe to topic
                    topic = message.get("topic")
                    if topic:
                        await manager.subscribe(websocket, topic)
                        await manager.send_personal_message(
                            json.dumps({"type": "subscribed", "topic": topic}),
                            websocket
                        )
                
                elif msg_type == "unsubscribe":
                    # Unsubscribe from topic
                    topic = message.get("topic")
                    if topic:
                        await manager.unsubscribe(websocket, topic)
                        await manager.send_personal_message(
                            json.dumps({"type": "unsubscribed", "topic": topic}),
                            websocket
                        )
                
                elif msg_type == "pong":
                    # Client responded to ping - update last_ping timestamp
                    if websocket in manager.connection_metadata:
                        from datetime import datetime
                        manager.connection_metadata[websocket]["last_ping"] = datetime.utcnow()
                
                elif msg_type == "echo":
                    # Echo back for testing
                    await manager.send_personal_message(
                        json.dumps({"type": "echo", "data": message.get("data")}),
                        websocket
                    )
                
                else:
                    # Unknown message type
                    await manager.send_personal_message(
                        json.dumps({"type": "error", "message": f"Unknown message type: {msg_type}"}),
                        websocket
                    )
                    
            except json.JSONDecodeError:
                # Not JSON - echo back as plain text (backward compatibility)
                await manager.send_personal_message(f"You wrote: {data}", websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics."""
    return manager.get_stats()
