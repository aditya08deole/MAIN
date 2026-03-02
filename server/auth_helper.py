from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Dict, Any, Optional

from config import get_settings

settings = get_settings()
security = HTTPBearer()

def verify_jwt(token: str) -> Dict[str, Any]:
    """Verify and decode a Supabase JWT token."""
    try:
        # Debug unverified headers
        from jose import jwt as jose_jwt
        header = jose_jwt.get_unverified_header(token)
        with open("auth_debug.log", "a") as f:
            f.write(f"Token Header: {header}\n")
        
        # Try 1: Plain string secret
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256", "RS256"],
                options={
                    "verify_aud": False,
                    "leeway": 60
                }
            )
            return payload
        except JWTError as e:
            # Try 2: Base64 decoded secret (common for binary secrets stored as B64)
            import base64
            try:
                decoded_secret = base64.b64decode(settings.SUPABASE_JWT_SECRET)
                payload = jwt.decode(
                    token,
                    decoded_secret,
                    algorithms=["HS256", "RS256"],
                    options={
                        "verify_aud": False,
                        "leeway": 60
                    }
                )
                return payload
            except:
                # Re-raise the original error if both fail
                raise e
    except JWTError as e:
        print(f"[AUTH ERROR] JWT verification failed: {e}")
        # Add a specific hint for users if it fails locally
        if "Signature verification failed" in str(e) or "alg value is not allowed" in str(e):
            print("[AUTH ERROR] CRITICAL: SUPABASE_JWT_SECRET is missing or incorrect in server/.env")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user(auth: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """Dependency for getting the current user from the JWT."""
    token = auth.credentials
    try:
        payload = verify_jwt(token)
        
        user_id = payload.get("sub")
        # For service role keys, sub might be missing. We allow if role is service_role.
        role = payload.get("user_metadata", {}).get("role") or payload.get("role")
        
        if not user_id and role != "service_role":
            with open("auth_debug.log", "a") as f:
                f.write(f"Invalid payload: {payload}\n")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing sub",
            )
            
        return {
            "id": user_id or "service-account",
            "email": payload.get("email"),
            "role": role or "customer"
        }
    except Exception as e:
        with open("auth_debug.log", "a") as f:
            f.write(f"Auth Exception: {str(e)}\n")
        raise e

async def requires_superadmin(user: Dict[str, Any] = Depends(get_current_user)):
    """Dependency for requiring superadmin role."""
    if user.get("role") != "superadmin":
        with open("auth_debug.log", "a") as f:
            f.write(f"Forbidden: role is {user.get('role')}\n")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin role required",
        )
    return user

async def get_optional_user(auth: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))) -> Optional[Dict[str, Any]]:
    """Dependency for optionally getting the current user from the JWT.
    Returns None if no auth token is provided, useful for public endpoints with optional auth."""
    if not auth:
        return None
    
    token = auth.credentials
    try:
        payload = verify_jwt(token)
        user_id = payload.get("sub")
        role = payload.get("user_metadata", {}).get("role") or payload.get("role")
        return {
            "id": user_id or "anonymous",
            "email": payload.get("email"),
            "role": role or "customer"
        }
    except Exception:
        return None
