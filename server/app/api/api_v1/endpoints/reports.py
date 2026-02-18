from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api import deps
from app.db.session import get_db
from app.models import all_models as models
from app.core import security_supabase
from app.core.security_supabase import RequirePermission
from app.core.permissions import Permission
import csv
import io

router = APIRouter()

@router.get("/node/{node_id}/export")
async def export_node_readings(
    node_id: str,
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(RequirePermission(Permission.DEVICE_READ))
) -> Any:
    """
    Export Node Readings as CSV.
    """
    # Verify access (RLS handled by permission + query filter if strictly needed)
    # Fetch readings
    result = await db.execute(
        select(models.NodeReading)
        .where(models.NodeReading.node_id == node_id)
        .order_by(models.NodeReading.timestamp.desc())
        .limit(1000) # Cap for now
    )
    readings = result.scalars().all()
    
    if not readings:
        raise HTTPException(status_code=404, detail="No readings found")

    # Generate CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    # Inspect first reading data for keys? Defaulting to known
    headers = ["Timestamp", "Reading ID"]
    if readings:
        first_data = readings[0].data
        if isinstance(first_data, dict):
            headers.extend(sorted(first_data.keys()))
            
    writer.writerow(headers)
    
    for r in readings:
        row = [r.timestamp.isoformat(), r.id]
        if isinstance(r.data, dict):
            for k in headers[2:]:
                row.append(r.data.get(k, ""))
        writer.writerow(row)
        
    output.seek(0)
    
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=node_{node_id}_readings.csv"
    return response

@router.get("/audit-logs/export")
async def export_audit_logs(
    db: AsyncSession = Depends(get_db),
    user_payload: dict = Depends(RequirePermission(Permission.USER_MANAGE))
) -> Any:
    """
    Export System Audit Logs as CSV.
    """
    result = await db.execute(
        select(models.AuditLog)
        .order_by(models.AuditLog.timestamp.desc())
        .limit(1000)
    )
    logs = result.scalars().all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Timestamp", "User ID", "Action", "Resource Type", "Resource ID", "Details"])
    
    for log in logs:
        writer.writerow([
            log.timestamp.isoformat(),
            log.user_id,
            log.action,
            log.resource_type,
            log.resource_id,
            str(log.details)
        ])
        
    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=audit_logs.csv"
    return response
