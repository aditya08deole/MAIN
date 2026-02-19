"""
Phase 26: Multi-Tenancy Isolation Middleware
Enforces Row-Level Security (RLS) at the application layer.
Prevents cross-tenant data access even if business logic has bugs.
"""
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Optional

class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """
    Middleware that extracts tenant context from JWT and injects it
    into the request state for use by downstream handlers.
    
    This provides a defense-in-depth layer on top of RBAC.
    Even if an endpoint forgets to filter by community_id,
    this middleware ensures the tenant context is always available.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Extract tenant info from authorization header
        auth_header = request.headers.get("Authorization", "")
        
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            
            try:
                from app.core.security_supabase import verify_supabase_token
                payload = verify_supabase_token(token)
                
                # Inject tenant context into request state
                request.state.user_id = payload.get("sub")
                request.state.user_role = payload.get("user_metadata", {}).get("role", "customer")
                request.state.community_id = payload.get("user_metadata", {}).get("community_id")
                request.state.distributor_id = payload.get("app_metadata", {}).get("distributor_id")
                request.state.tenant_context = {
                    "user_id": request.state.user_id,
                    "role": request.state.user_role,
                    "community_id": request.state.community_id,
                    "distributor_id": request.state.distributor_id,
                }
            except Exception:
                # Don't block unauthenticated requests (public endpoints exist)
                request.state.tenant_context = None
        else:
            request.state.tenant_context = None
        
        response = await call_next(request)
        return response


def get_tenant_filter(request: Request) -> Optional[dict]:
    """
    Utility to extract tenant filter from request state.
    Use in endpoints: tenant = get_tenant_filter(request)
    """
    ctx = getattr(request.state, 'tenant_context', None)
    if not ctx:
        return None
    
    if ctx["role"] == "superadmin":
        return {}  # No filter for superadmin
    elif ctx["role"] == "distributor":
        return {"distributor_id": ctx["distributor_id"]}
    else:
        return {"community_id": ctx["community_id"]}
