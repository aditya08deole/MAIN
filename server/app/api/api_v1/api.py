from fastapi import APIRouter
from app.api.api_v1.endpoints import auth, nodes, websockets, admin, devices, dashboard, reports, ai, health, ingest, alerts, export, device_management, analytics_v2

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(nodes.router, prefix="/nodes", tags=["nodes"])
api_router.include_router(websockets.router, prefix="/ws", tags=["websockets"])
api_router.include_router(admin.router, tags=["admin"]) 
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["telemetry"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(export.router, prefix="/export", tags=["export"])
api_router.include_router(device_management.router, prefix="/manage", tags=["device-management"])
api_router.include_router(analytics_v2.router, prefix="/analytics", tags=["analytics"])


