from typing import Optional, Dict, Any
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings

settings = get_settings()
security = HTTPBearer()

def verify_supabase_token(token: str) -> Dict[str, Any]:
    """
    Verifies a Supabase JWT token.
    Uses HS256 algorithm and the SUPABASE_JWT_SECRET (or SECRET_KEY as fallback).
    """
    # ─── DEV BYPASS ───
    if token.startswith("dev-bypass-"):
        print(f"DEBUG: Dev Bypass detected. ENVIRONMENT: {settings.ENVIRONMENT}")
        if settings.ENVIRONMENT != "development":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dev Bypass not allowed in production"
            )

        # Create a mock payload for local development
        # The token format is 'dev-bypass-id-email' or 'dev-bypass-role'
        parts = token.split("-")
        email = parts[-1] if "@" in parts[-1] else "dev@evara.com"
        
        # Match frontend bypass admins
        admins = ['ritik@evaratech.com', 'yasha@evaratech.com', 'aditya@evaratech.com', 'admin@evara.com']
        role = "superadmin" if email in admins or "admin" in token else "customer"
        
        return {
            "sub": token,
            "email": email,
            "user_metadata": {
                "role": role,
                "display_name": "Dev User",
                "community_id": "comm_myhome"
            },
            "aud": "authenticated"
        }

    secret = settings.SUPABASE_JWT_SECRET or settings.SECRET_KEY
    if not secret:
         raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT Secret not configured"
        )

    try:
        # Decode and verify the token
        # Standard Supabase tokens use HS256
        payload = jwt.decode(
            token, 
            secret, 
            algorithms=["HS256"], # Explicitly allow HS256
            options={"verify_aud": False} # Sometimes audience varies, let's be flexible in dev
        )
        return payload
    except JWTError as e:
        print(f"JWT Verification Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}. (Ensure SUPABASE_JWT_SECRET is correct)",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Dependency to get the verified JWT payload.
    """
    return verify_supabase_token(credentials.credentials)

class RequirePermission:
    def __init__(self, permission: str):
        self.permission = permission

    def __call__(self, user_payload: Dict[str, Any] = Depends(get_current_user_token)):
        # Extract role from metadata
        user_metadata = user_payload.get("user_metadata", {})
        role = user_metadata.get("role", "customer")
        
        # Verify permission
        from app.core.permissions import has_permission, Permission
        
        if not has_permission(role, self.permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {self.permission}"
            )
        return user_payload
