import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.all_models import User, TankNode, DeepNode, FlowNode, Pipeline, NodeAssignment, Organization, Region, Community
from app.db.session import AsyncSessionLocal
from app.core.config import get_settings
from datetime import datetime

settings = get_settings()

INITIAL_USERS = [
    {"id": "usr_admin", "email": "admin@evara.com", "display_name": "Super Admin", "role": "superadmin"},
    {"id": "usr_dist", "email": "dist@evara.com", "display_name": "Distributor 1", "role": "distributor"},
]

INITIAL_NODES = [
    # Tanks
    {"type": "EvaraTank", "id": "OHT-1", "node_key": "oht-1", "label": "Bakul OHT", "category": "OHT", "capacity": "2 Units", "status": "Online", "lat": 17.448045, "lng": 78.348438},
    {"type": "EvaraTank", "id": "SUMP-S1", "node_key": "sump-s1", "label": "Sump S1", "category": "Sump", "capacity": "2.00L L", "status": "Online", "lat": 17.448097, "lng": 78.349060},
    
    # Deep
    {"type": "EvaraDeep", "id": "BW-P1", "node_key": "bw-p1", "label": "Borewell P1", "category": "Borewell", "capacity": "5 HP", "status": "Offline", "lat": 17.443394, "lng": 78.348117},
    
    # Flow
    {"type": "EvaraFlow", "id": "PH-01", "node_key": "ph-01", "label": "Pump House 1", "category": "PumpHouse", "capacity": "4.98L L", "status": "Online", "lat": 17.4456, "lng": 78.3516},
]

async def seed_db():
    print("🌱 Seeding Database...")
    async with AsyncSessionLocal() as session:
        # Check if initialized
        existing_org = await session.get(Organization, "org_evara_hq")
        if existing_org:
            print("  - Database already seeded.")
            return

        # 1. Hierarchy
        org = Organization(id="org_evara_hq", name="Evara HQ", plan_tier="enterprise")
        region = Region(id="reg_hyd_north", name="Hyderabad North", organization_id="org_evara_hq")
        community = Community(id="comm_myhome", name="My Home Avatar", region_id="reg_hyd_north", organization_id="org_evara_hq")
        
        session.add(org)
        session.add(region)
        session.add(community)
        await session.flush() # Ensure IDs differ

        # 2. Users (Linked to Org/Community)
        for u in INITIAL_USERS:
            # All seeded users belong to the main org/community for now
            u["organization_id"] = "org_evara_hq"
            u["community_id"] = "comm_myhome"
            session.add(User(**u))
        
        # 3. Nodes (Linked to Org/Community)
        for n in INITIAL_NODES:
            ntype = n.pop("type")
            n["organization_id"] = "org_evara_hq"
            n["community_id"] = "comm_myhome"
            
            if ntype == "EvaraTank":
                session.add(TankNode(analytics_type="EvaraTank", **n))
            elif ntype == "EvaraDeep":
                session.add(DeepNode(analytics_type="EvaraDeep", **n))
            elif ntype == "EvaraFlow":
                session.add(FlowNode(analytics_type="EvaraFlow", **n))
        
        await session.commit()
        print("✅ Seeding Complete.")

if __name__ == "__main__":
    asyncio.run(seed_db())
