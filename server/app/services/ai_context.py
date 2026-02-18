from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import all_models as models
from typing import Dict, Any

class AIContextService:
    """
    Aggregates system state to provide context for AI Assistants.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_context(self, user_id: str) -> Dict[str, Any]:
        """
        Builds a comprehensive context object for the given user.
        Includes: User Role, Community Info, Owned Nodes Status, Recent Alerts.
        """
        # 1. Fetch User & Community
        user = await self.db.get(models.User, user_id)
        if not user:
            return {"error": "User not found"}
            
        context = {
            "user": {
                "name": user.display_name,
                "role": user.role,
                "community_id": user.community_id
            },
            "timestamp": "Now", # In real app, use datetime.utcnow().isoformat()
        }

        # 2. Fetch Nodes
        # If Super Admin, fetch all? Or summary?
        # For AI context, usually we want what the user "sees".
        if user.role == "superadmin":
            nodes_result = await self.db.execute(select(models.Node).limit(20)) # Cap for prompt size
        else:
            nodes_result = await self.db.execute(
                select(models.Node).where(models.Node.community_id == user.community_id)
            )
        nodes = nodes_result.scalars().all()
        
        context["nodes"] = [
            {
                "id": n.id,
                "label": n.label,
                "status": n.status,
                "type": n.analytics_type,
                "location": n.location_name
            }
            for n in nodes
        ]

        # 3. Fetch Active Alerts
        # For the user's nodes
        node_ids = [n.id for n in nodes]
        if node_ids:
            alerts_result = await self.db.execute(
                select(models.AlertHistory)
                .where(
                    models.AlertHistory.node_id.in_(node_ids),
                    models.AlertHistory.resolved_at.is_(None)
                )
            )
            alerts = alerts_result.scalars().all()
            context["alerts"] = [
                {
                    "node_id": a.node_id,
                    "triggered_at": a.triggered_at.isoformat(),
                    "value": a.value_at_time
                }
                for a in alerts
            ]
        else:
            context["alerts"] = []
            
        return context
