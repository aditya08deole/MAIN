from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core import security_supabase
from app.core.permissions import Permission
from app.core.security_supabase import RequirePermission
from app.schemas import schemas
from app.db.repository import NodeRepository, UserRepository
from app.models.all_models import User
from app.services.analytics import NodeAnalyticsService
from app.db.session import get_db
from app.services.seeder import INITIAL_NODES
from app.core.config import get_settings
from app.schemas.response import StandardResponse
from app.core.cache import memory_cache
from app.services.search import search_service
import asyncio
import traceback

router = APIRouter()

@router.post("/", response_model=schemas.NodeResponse)
async def create_node(
    *,
    db: AsyncSession = Depends(get_db),
    node_in: schemas.NodeCreate,
    user_payload: dict = Depends(RequirePermission(Permission.DEVICE_PROVISION))
) -> Any:
    """
    Create a new node.
    """
    current_user_id = user_payload.get("sub")
    repo = NodeRepository(db)
    
    # Check if node_key already exists
    existing = await repo.get_by_key(node_in.node_key)
    if existing:
        raise HTTPException(status_code=400, detail="Node with this key already exists")
    
    # P11: Verify ThingSpeak channel is accessible before saving
    node_data_dict = node_in.dict()
    ts_mapping = node_data_dict.get("thingspeak_mapping")
    if ts_mapping and ts_mapping.get("channel_id"):
        try:
            import httpx
            channel_id = ts_mapping["channel_id"]
            read_key = ts_mapping.get("read_api_key", "")
            url = f"https://api.thingspeak.com/channels/{channel_id}/feeds/last.json?api_key={read_key}"
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=400, detail=f"ThingSpeak channel {channel_id} is unreachable (HTTP {resp.status_code}). Verify channel_id and api_key.")
        except httpx.RequestError as e:
            raise HTTPException(status_code=400, detail=f"Cannot reach ThingSpeak API: {e}")
        except HTTPException:
            raise
        except Exception:
            pass  # Don't block creation if verification itself fails
    
    node_data_dict["created_by"] = current_user_id
    node = await repo.create(node_data_dict)
    return node

@router.get("/", response_model=StandardResponse[List[schemas.NodeResponse]])
async def read_nodes(
    response: Response,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    q: str = None, # Search query
    user_payload: dict = Depends(RequirePermission(Permission.DEVICE_READ))
) -> Any:
    """
    BULLETPROOF NODES ENDPOINT - NEVER FAILS, ALWAYS RETURNS DATA
    Retrieve nodes. Restricted to User's Community unless Super Admin.
    Returns empty list if DB fails - frontend stays operational.
    """
    import asyncio
    
    # 1. Try Cache (only if no search)
    user_id = user_payload.get("sub")
    if not q:
        cache_key = f"nodes:{user_id}:{skip}:{limit}"
        cached_data = await memory_cache.get(cache_key)
        if cached_data:
            response.headers["X-Cache"] = "HIT"
            return StandardResponse(data=cached_data, meta={"cached": True})
        
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
            all_nodes = await repo.get_all(skip=0, limit=2000) # Get all for memory filtering/search support
            
            # Filter by Community
            if current_user.role != "superadmin":
                nodes = [n for n in all_nodes if n.community_id == current_user.community_id]
            else:
                nodes = all_nodes

            # Apply Search if needed
            if q:
                # Lazy-load index if empty (first run)
                # Note: In prod, do this on startup
                if not search_service.index:
                    await search_service.rebuild_index(all_nodes)
                
                # Get matching IDs
                matched_ids = await search_service.search(q)
                matched_set = set(matched_ids)
                
                # Filter in-memory
                nodes = [n for n in nodes if str(n.id) in matched_set]
            
            # Apply Pagination manually if we fetched all
            # (If we didn't search, we could have used DB limit, but for consistency...)
            total = len(nodes)
            nodes = nodes[skip : skip + limit]
        
        # Save to Cache (only if no search, or handle search cache differently)
        if not q:
            await memory_cache.set(cache_key, nodes, ttl=30)
            
        response.headers["X-Cache"] = "MISS"
        
        return StandardResponse(data=nodes, meta={"total": total, "search": q if q else None})
    except (asyncio.TimeoutError, Exception) as e:
        traceback.print_exc()
        
        # BULLETPROOF FALLBACK: NEVER throw 404/503 - always return empty list
        print(f"⚠️ Nodes endpoint error: {str(e)}")
        print(f"⚠️ Returning empty list to keep UI operational")
        
        # Return empty list with error metadata for frontend to show notification
        return StandardResponse(
            data=[], 
            meta={
                "total": 0, 
                "error": str(e),
                "error_type": "database_timeout" if isinstance(e, asyncio.TimeoutError) else "unknown",
                "fallback": True
            }
        )

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
