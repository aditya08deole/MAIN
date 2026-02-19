from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core import security_supabase
from app.schemas import schemas
from app.db.repository import NodeRepository, UserRepository
from app.models.all_models import User
from app.services.analytics import NodeAnalyticsService
from app.db.session import get_db
from app.services.seeder import INITIAL_NODES
from app.core.config import get_settings
import asyncio
import traceback

router = APIRouter()

@router.post("/", response_model=schemas.NodeResponse)
async def create_node(
    *,
    db: AsyncSession = Depends(get_db),
    node_in: schemas.NodeCreate,
    current_user = Depends(deps.get_current_user),
) -> Any:
    """
    Create a new node.
    """
    repo = NodeRepository(db)
    
    # Check if node_key already exists
    existing = await repo.get_by_key(node_in.node_key)
    if existing:
        raise HTTPException(status_code=400, detail="Node with this key already exists")
        
    node_data = node_in.dict()
    node_data["created_by"] = current_user.id
    
    node = await repo.create(node_data)
    return node

@router.get("/", response_model=List[schemas.NodeResponse])
async def read_nodes(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    user_payload: dict = Depends(security_supabase.get_current_user_token) # Get Supabase Token
) -> Any:
    """
    Retrieve nodes.
    Restricted to User's Community unless Super Admin.
    """
    import asyncio
    repo = NodeRepository(db)
    
    # Extract Access Context
    user_metadata = user_payload.get("user_metadata", {})
    role = user_metadata.get("role", "customer")
    user_id = user_payload.get("sub")
    
    print(f"DEBUG: Processing read_nodes for user {user_id} (Role: {role})")
    
    try:
        # BETTER APPROACH: Query the local DB user to get the latest permissions/community
        user_repo = UserRepository(db)
        
        # 5s timeout to prevent hanging on blocked nodes
        async with asyncio.timeout(5):
            current_user = await user_repo.get(user_id)
            
            if not current_user and user_id.startswith("dev-bypass-"):
                # Auto-create dev user if missing
                print(f"Auto-creating dev user profile for {user_id}")
                current_user = User(
                    id=user_id,
                    email=user_payload.get("email"),
                    display_name=user_payload.get("user_metadata", {}).get("display_name", "Dev User"),
                    role=user_payload.get("user_metadata", {}).get("role", "superadmin"),
                    community_id="comm_myhome",
                    organization_id="org_evara_hq"
                )
                db.add(current_user)
                await db.commit()
                await db.refresh(current_user)

        if not current_user:
            print(f"ERROR: User {user_id} not found in local profiles table. Please run synchronization.")
            raise HTTPException(status_code=401, detail=f"User {user_id} not synchronized")

        # Fetch nodes with timeout
        async with asyncio.timeout(5):
            if current_user.role == "superadmin":
                # Super Admin sees all
                nodes = await repo.get_all(skip=skip, limit=limit)
            else:
                all_nodes = await repo.get_all(skip=0, limit=1000)
                nodes = [n for n in all_nodes if n.community_id == current_user.community_id]
                
        return nodes
    except (asyncio.TimeoutError, Exception) as e:
        traceback.print_exc()
        
        settings = get_settings()
        if settings.ENVIRONMENT == "development":
            print(f"⚠️ PRO-FALLBACK: DB unreachable ({str(e)}). Serving mock nodes for {user_id}")
            
            mock_response = []
            for n in INITIAL_NODES:
                mock_node = {
                    "id": n.get("id", "mock-id"),
                    "node_key": n.get("node_key", "mock-key"),
                    "label": n.get("label", "Mock Node"),
                    "category": n.get("category", "General"),
                    "analytics_type": n.get("type", n.get("category", "EvaraFlow")),
                    "status": n.get("status", "Online"),
                    "lat": n.get("lat"),
                    "lng": n.get("lng"),
                    "location_name": n.get("location_name"),
                    "capacity": n.get("capacity"),
                    "thingspeak_channel_id": n.get("thingspeak_channel_id"),
                    "thingspeak_read_api_key": n.get("thingspeak_read_api_key"),
                    "assignments": []
                }
                mock_response.append(mock_node)
            return mock_response
            
        print(f"ERROR: Database failed while fetching nodes for {user_id}: {str(e)}")
        raise HTTPException(status_code=503, detail="Database connection timed out or failed")

@router.get("/{node_id}", response_model=schemas.NodeResponse)
async def read_node_by_id(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user),
) -> Any:
    repo = NodeRepository(db)
    # Try by UUID first
    try:
        node = await repo.get(node_id)
    except Exception:
        node = None
        
    # If not found, try by node_key
    if not node:
        node = await repo.get_by_key(node_id)
        
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.get("/{node_id}/analytics", response_model=schemas.NodeAnalyticsResponse)
async def get_node_analytics(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(security_supabase.get_current_user_token)
) -> Any:
    """
    Returns calculated analytics using REAL ThingSpeak Data.
    """
    # 1. Fetch Node
    repo = NodeRepository(db)
    node = await repo.get(node_id)
    if not node:
         raise HTTPException(status_code=404, detail="Node not found")
    
    # Check permissions (reuse logic if needed, but RLS handled by repo access ideally)
    # For now assuming user access is valid if they know the ID (or add check)
    
    # 2. Fetch Telemetry
    from app.services.telemetry.thingspeak import ThingSpeakTelemetryService
    ts_service = ThingSpeakTelemetryService()
    
    config = {
        "channel_id": node.thingspeak_channel_id,
        "read_key": node.thingspeak_read_api_key
    }
    
    readings = await ts_service.fetch_history(node_id, config, days=7)
    
    # 3. Compute Analytics
    analytics_service = NodeAnalyticsService(repo)
    
    # Extract flow data (assuming field1 is flow for now)
    flow_series = [
        float(r["field1"]) for r in readings 
        if r.get("field1") and r["field1"] is not None and r["field1"].replace('.', '', 1).isdigit()
    ]
    
    days = analytics_service.predict_days_to_empty(flow_series, 2000) # Mock capacity
    avg = analytics_service.calculate_rolling_average(flow_series)
    
    return schemas.NodeAnalyticsResponse(
        node_id=node_id,
        days_to_empty=days,
        rolling_avg_flow=avg
    )
