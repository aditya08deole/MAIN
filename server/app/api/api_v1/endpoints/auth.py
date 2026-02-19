from datetime import timedelta
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core import security, security_supabase
from app.core.config import get_settings
from app.db.session import get_db
from app.schemas import schemas
from app.db.repository import UserRepository

settings = get_settings()
router = APIRouter()

@router.post("/sync", response_model=schemas.User)
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
        # Assign to default Community/Org if not present (Logic can be improved later)
        # For now, linking to Evara HQ default
        user_in = schemas.UserCreate(
            id=supabase_id,
            email=email,
            display_name=display_name,
            role=role,
            organization_id="org_evara_hq",
            community_id="comm_myhome"  # Default community for new users
        )
        attrs = user_in.model_dump(exclude={"password"})
        user = await repo.create(attrs)
    else:
        # Update existing user metadata if needed
        # (Optional: sync logic here)
        pass
        
    return user
