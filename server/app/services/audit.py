import uuid
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import all_models as models
from datetime import datetime

class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log_action(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Log an administrative action.
        """
        try:
            log_entry = models.AuditLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details or {},
                timestamp=datetime.utcnow()
            )
            self.db.add(log_entry)
            # We don't verify commit here usually, let the caller commit or do it here?
            # Ideally caller does it to keep transaction atomic, but for audit sometimes we want it even if main fails?
            # For simplicity, we assume caller manages transaction OR we flush here.
            # Let's commit to ensure audit trail exists even if subsequent logic might act up, 
            # BUT if main transaction fails, we might not want to log "SUCCESS".
            # Better: Append to session.
            
        except Exception as e:
            print(f"Failed to create audit log: {e}")
