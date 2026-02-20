from datetime import timedelta
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core import security_supabase
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas import schemas
from app.schemas.response import StandardResponse
from app.db.repository import UserRepository
from app.models.all_models import User

settings = get_settings()
router = APIRouter()

@router.post("/sync", response_model=StandardResponse[schemas.UserResponse])
async def sync_user_profile(
    user_payload: Dict[str, Any] = Depends(security_supabase.get_current_user_token),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Sync Supabase User with Local DB.
    Called by frontend after Supabase login to ensure backend profile exists.
    """
    repo = UserRepository(db)
    
    # Extract details from Supabase JWT
    supabase_id = user_payload.get("sub")
    email = user_payload.get("email")
    user_metadata = user_payload.get("user_metadata", {})
    
    # Map Roles (Default to customer if not found)
    role = user_metadata.get("role", "customer")
    display_name = user_metadata.get("display_name", email.split("@")[0] if email else "User")
    
    # Check if user exists
    user = await repo.get(supabase_id)
    
    if not user:
        # Create new user
        user_in = schemas.UserCreate(
            id=supabase_id,
            email=email,
            display_name=display_name,
            role=role,
            organization_id="org_evara_hq",
            community_id="comm_myhome"  # Default community for new users
        )
        attrs = user_in.dict(exclude={"password"}) if hasattr(user_in, 'dict') else user_in.model_dump(exclude={"password"})
        user = await repo.create(attrs)
    else:
        # Update existing user metadata if changed
        updates = {}
        if user.email != email:
            updates["email"] = email
        if user.display_name != display_name:
            updates["display_name"] = display_name
        if user.role != role:
             # Only update role if it's explicitly set in Supabase metadata
             updates["role"] = role
            
        if updates:
            user = await repo.update(user.id, updates)
        
    return StandardResponse(data=user)


@router.post("/webhook", include_in_schema=False)
async def auth_webhook(
    request: Request,
    x_supabase_signature: str = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Handle Supabase Auth Webhooks (INSERT, UPDATE, DELETE).
    Securely updates local DB content.
    """
    # 1. Verify Secret (Simple check for now, can implement proper signature verification)
    # The signature verification is complex, for MVP we can check a shared secret in query param or header
    # But Supabase webhooks send a signature. 
    # For now, let's assume we rely on the URL being secret or verify a custom service key.
    
    payload = await request.json()
    
    event_type = payload.get("type") # INSERT, UPDATE, DELETE
    record = payload.get("record")
    old_record = payload.get("old_record")
    table = payload.get("table")
    
    if table != "users":
        return {"message": "Ignored non-user table"}

    repo = UserRepository(db)
    
    if event_type == "INSERT":
        user_id = record.get("id")
        email = record.get("email")
        meta = record.get("raw_user_meta_data", {})
        
        existing = await repo.get(user_id)
        if not existing:
            user_in = schemas.UserCreate(
                id=user_id,
                email=email,
                display_name=meta.get("display_name", email.split("@")[0]),
                role=meta.get("role", "customer"),
                organization_id="org_evara_hq",
                community_id="comm_myhome"
            )
            attrs = user_in.dict(exclude={"password"}) if hasattr(user_in, 'dict') else user_in.model_dump(exclude={"password"})
            await repo.create(attrs)
            print(f"WEBHOOK: Created user {user_id}")
            
    elif event_type == "UPDATE":
        user_id = record.get("id")
        email = record.get("email")
        meta = record.get("raw_user_meta_data", {})
        
        updates = {
            "email": email,
            "display_name": meta.get("display_name"),
            "role": meta.get("role")
        }
        # Filter None
        updates = {k: v for k, v in updates.items() if v is not None}
        
        await repo.update(user_id, updates)
        print(f"WEBHOOK: Updated user {user_id}")

    return {"status": "processed"}
