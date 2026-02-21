"""
Supabase JWT authentication.
Verifies JWT tokens from Supabase Auth.

⚠️ DEV-BYPASS MODE ENABLED: Accepts dev-bypass-id-{email} tokens.
WARNING: Remove dev-bypass logic before production deployment!
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from config import get_settings
from typing import Dict, Any
import time

settings = get_settings()
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """
    Verify Supabase JWT token and return user payload with comprehensive validation.
    
    ⚠️ DEV-BYPASS MODE: Accepts dev-bypass-id-{email} tokens for development.
    WARNING: This is NOT production-safe. Remove before production deployment.
    
    Usage in endpoints:
        user_payload: dict = Depends(get_current_user)
    
    Returns:
        dict: JWT payload containing user info
        {
            "sub": "user-uuid",
            "email": "user@example.com",
            "role": "authenticated",
            ...
        }
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    
    # ⚠️ DEV-BYPASS: Allow development bypass tokens (ONLY IN DEVELOPMENT)
    if token and token.startswith("dev-bypass-id-"):
        # SECURITY: Block dev-bypass in production environments
        if settings.ENVIRONMENT.lower() not in ["development", "dev", "local"]:
            print(f"[SECURITY BLOCK] ❌ Attempted dev-bypass in {settings.ENVIRONMENT} environment")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dev-bypass tokens are not allowed in this environment",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        email = token.replace("dev-bypass-id-", "")
        print(f"[DEV-BYPASS] ⚠️ Allowing dev-bypass token for: {email} (Environment: {settings.ENVIRONMENT})")
        
        # Return mock JWT payload matching Supabase structure
        return {
            "sub": token,  # Use full dev-bypass-id as user ID
            "email": email,
            "role": "authenticated",
            "aud": "authenticated",
            "user_metadata": {
                "role": "superadmin"  # Default dev role
            },
            "iss": "dev-bypass",
            "iat": int(time.time()),
            "exp": int(time.time()) + 86400  # 24 hours from now
        }
    
    # Validate token format
    if not token or len(token) < 20:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Decode and verify JWT
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase doesn't require aud verification
        )
        
        # Verify required fields
        if not payload.get("sub"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject"
            )
        
        if not payload.get("email"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing email"
            )
        
        # Verify token is not expired (JWT library checks this, but let's be explicit)
        exp = payload.get("exp")
        if exp and time.time() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTClaimsError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"[ERROR] Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_user_id(user_payload: Dict[str, Any]) -> str:
    """Extract user ID from JWT payload."""
    return user_payload.get("sub")


def get_user_email(user_payload: Dict[str, Any]) -> str:
    """Extract user email from JWT payload."""
    return user_payload.get("email")


def get_user_role(user_payload: Dict[str, Any]) -> str:
    """Extract user role from JWT payload metadata."""
    user_metadata = user_payload.get("user_metadata", {})
    return user_metadata.get("role", "customer")
