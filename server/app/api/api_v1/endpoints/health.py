from typing import Any, Dict
from fastapi import APIRouter, Depends 
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
import httpx

router = APIRouter()

@router.get("", response_model=Dict[str, Any])
@router.get("/", response_model=Dict[str, Any])
async def health_check(
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Detailed System Health Check.
    Verifies Database and External Connectivity.
    """
    status = {
        "status": "ok",
        "services": {
            "database": "unknown",
            "thingspeak": "unknown"
        }
    }
    
    # 1. DB Check
    try:
        await db.execute(text("SELECT 1"))
        status["services"]["database"] = "ok"
    except Exception as e:
        status["services"]["database"] = f"error: {str(e)}"
        status["status"] = "degraded"

    # 2. ThingSpeak Check (Ping URL)
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.thingspeak.com/channels/public.json", timeout=2.0)
            if resp.status_code == 200:
                status["services"]["thingspeak"] = "ok"
            else:
                 status["services"]["thingspeak"] = f"unreachable ({resp.status_code})"
    except Exception as e:
        status["services"]["thingspeak"] = f"error: {str(e)}"
        # ThingSpeak down might not be critical for app UP, but is for telemetry
        status["status"] = "degraded"

    return status
