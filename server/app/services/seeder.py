import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.all_models import User, Distributor, Community, Node, DeviceThingSpeakMapping
from app.db.session import AsyncSessionLocal
from app.core.config import get_settings
from app.services.security import EncryptionService
from datetime import datetime

settings = get_settings()

INITIAL_USERS = [
    {"id": "usr_admin", "email": "admin@evara.com", "display_name": "Super Admin", "role": "superadmin"},
    {"id": "usr_dist", "email": "dist@evara.com", "display_name": "Distributor 1", "role": "distributor"},
]

# Full 29-node dataset from migration plan
INITIAL_NODES = [
    # Pump Houses
    {"type": "EvaraFlow", "id": "PH-01", "node_key": "ph-01", "label": "Pump House 1", "category": "PumpHouse", "capacity": "4.98L L", "status": "Online", "lat": 17.4456, "lng": 78.3516, "location_name": "ATM Gate"},
    {"type": "EvaraFlow", "id": "PH-02", "node_key": "ph-02", "label": "Pump House 2", "category": "PumpHouse", "capacity": "75k L", "status": "Online", "lat": 17.44608, "lng": 78.34925, "location_name": "Guest House"},
    {"type": "EvaraFlow", "id": "PH-03", "node_key": "ph-03", "label": "Pump House 3", "category": "PumpHouse", "capacity": "55k L", "status": "Online", "lat": 17.4430, "lng": 78.3487, "location_name": "Staff Qtrs"},
    {"type": "EvaraFlow", "id": "PH-04", "node_key": "ph-04", "label": "Pump House 4", "category": "PumpHouse", "capacity": "2.00L L", "status": "Online", "lat": 17.4481, "lng": 78.3489, "location_name": "Bakul"},

    # Sumps
    {"type": "EvaraTank", "id": "SUMP-S1", "node_key": "sump-s1", "label": "Sump S1", "category": "Sump", "capacity": "2.00L L", "status": "Online", "lat": 17.448097, "lng": 78.349060, "location_name": "Bakul"},
    {"type": "EvaraTank", "id": "SUMP-S2", "node_key": "sump-s2", "label": "Sump S2", "category": "Sump", "capacity": "1.10L L", "status": "Online", "lat": 17.444919, "lng": 78.346195, "location_name": "Palash"},
    {"type": "EvaraTank", "id": "SUMP-S3", "node_key": "sump-s3", "label": "Sump S3", "category": "Sump", "capacity": "1.00L L", "status": "Online", "lat": 17.446779, "lng": 78.346996, "location_name": "NBH"},
    {"type": "EvaraTank", "id": "SUMP-S4", "node_key": "sump-s4", "label": "Sump S4 (Main Sump)", "category": "Sump", "capacity": "4.98L L", "status": "Online", "lat": 17.44563, "lng": 78.351593, "location_name": "Central"},
    {"type": "EvaraTank", "id": "SUMP-S5", "node_key": "sump-s5", "label": "Sump S5", "category": "Sump", "capacity": "55k L", "status": "Online", "lat": 17.444766, "lng": 78.350087, "location_name": "Blk A&B"},
    {"type": "EvaraTank", "id": "SUMP-S6", "node_key": "sump-s6", "label": "Sump S6", "category": "Sump", "capacity": "10k L", "status": "Online", "lat": 17.445498, "lng": 78.350202, "location_name": "Guest House"},
    {"type": "EvaraTank", "id": "SUMP-S7", "node_key": "sump-s7", "label": "Sump S7", "category": "Sump", "capacity": "43k L", "status": "Online", "lat": 17.44597, "lng": 78.34906, "location_name": "Pump House"},
    {"type": "EvaraTank", "id": "SUMP-S8", "node_key": "sump-s8", "label": "Sump S8", "category": "Sump", "capacity": "12k L", "status": "Online", "lat": 17.446683, "lng": 78.348995, "location_name": "Football"},
    {"type": "EvaraTank", "id": "SUMP-S9", "node_key": "sump-s9", "label": "Sump S9", "category": "Sump", "capacity": "15k L", "status": "Online", "lat": 17.446613, "lng": 78.346487, "location_name": "Felicity"},
    {"type": "EvaraTank", "id": "SUMP-S10", "node_key": "sump-s10", "label": "Sump S10", "category": "Sump", "capacity": "34k+31k", "status": "Online", "lat": 17.443076, "lng": 78.348737, "location_name": "FSQ A&B"},
    {"type": "EvaraTank", "id": "SUMP-S11", "node_key": "sump-s11", "label": "Sump S11", "category": "Sump", "capacity": "1.5L+60k", "status": "Online", "lat": 17.444773, "lng": 78.347797, "location_name": "FSQ C,D,E"},

    # Overhead Tanks
    {"type": "EvaraTank", "id": "OHT-1", "node_key": "oht-1", "label": "Bakul OHT", "category": "OHT", "capacity": "2 Units", "status": "Online", "lat": 17.448045, "lng": 78.348438, "location_name": "Bakul", "thingspeak_channel_id": "3212670", "thingspeak_read_api_key": "UXORK5OUGJ2VK5PX"},
    {"type": "EvaraTank", "id": "OHT-2", "node_key": "oht-2", "label": "Parijat OHT", "category": "OHT", "capacity": "2 Units", "status": "Online", "lat": 17.447547, "lng": 78.347752, "location_name": "Parijat"},
    {"type": "EvaraTank", "id": "OHT-3", "node_key": "oht-3", "label": "Kadamba OHT", "category": "OHT", "capacity": "2 Units", "status": "Online", "lat": 17.446907, "lng": 78.347178, "location_name": "Kadamba"},
    {"type": "EvaraTank", "id": "OHT-4", "node_key": "oht-4", "label": "NWH Block C OHT", "category": "OHT", "capacity": "1 Unit", "status": "Online", "lat": 17.447675, "lng": 78.34743, "location_name": "NWH Block C"},
    {"type": "EvaraTank", "id": "OHT-5", "node_key": "oht-5", "label": "NWH Block B OHT", "category": "OHT", "capacity": "1 Unit", "status": "Online", "lat": 17.447391, "lng": 78.347172, "location_name": "NWH Block B"},
    {"type": "EvaraTank", "id": "OHT-6", "node_key": "oht-6", "label": "NWH Block A OHT", "category": "OHT", "capacity": "1 Unit", "status": "Online", "lat": 17.447081, "lng": 78.346884, "location_name": "NWH Block A"},
    {"type": "EvaraTank", "id": "OHT-7", "node_key": "oht-7", "label": "Palash Nivas OHT", "category": "OHT", "capacity": "4 Units", "status": "Online", "lat": 17.445096, "lng": 78.345966, "location_name": "Palash"},
    {"type": "EvaraTank", "id": "OHT-8", "node_key": "oht-8", "label": "Anand Nivas OHT", "category": "OHT", "capacity": "2 Units", "status": "Online", "lat": 17.443976, "lng": 78.348432, "location_name": "Anand"},
    {"type": "EvaraTank", "id": "OHT-9", "node_key": "oht-9", "label": "Budha Nivas OHT", "category": "OHT", "capacity": "2 Units", "status": "Online", "lat": 17.443396, "lng": 78.3485, "location_name": "Budha"},
    {"type": "EvaraTank", "id": "OHT-10", "node_key": "oht-10", "label": "C Block OHT", "category": "OHT", "capacity": "3 Units", "status": "Online", "lat": 17.443387, "lng": 78.347834, "location_name": "Block C"},
    {"type": "EvaraTank", "id": "OHT-11", "node_key": "oht-11", "label": "D Block OHT", "category": "OHT", "capacity": "3 Units", "status": "Online", "lat": 17.443914, "lng": 78.347773, "location_name": "Block D"},
    {"type": "EvaraTank", "id": "OHT-12", "node_key": "oht-12", "label": "E Block OHT", "category": "OHT", "capacity": "3 Units", "status": "Online", "lat": 17.444391, "lng": 78.347958, "location_name": "Block E"},
    {"type": "EvaraTank", "id": "OHT-13", "node_key": "oht-13", "label": "Vindhya OHT", "category": "OHT", "capacity": "Mixed", "status": "Online", "lat": 17.44568, "lng": 78.34973, "location_name": "Vindhya"},
    {"type": "EvaraTank", "id": "OHT-14", "node_key": "oht-14", "label": "Himalaya OHT", "category": "OHT", "capacity": "1 Unit", "status": "Online", "lat": 17.44525, "lng": 78.34966, "location_name": "Himalaya"},

    # Borewells
    {"type": "EvaraDeep", "id": "BW-P1", "node_key": "bw-p1", "label": "Borewell P1", "category": "Borewell", "capacity": "5 HP", "status": "Offline", "lat": 17.443394, "lng": 78.348117, "location_name": "Block C,D,E"},
    {"type": "EvaraDeep", "id": "BW-P2", "node_key": "bw-p2", "label": "Borewell P2", "category": "Borewell", "capacity": "12.5 HP", "status": "Offline", "lat": 17.443093, "lng": 78.348936, "location_name": "Agri Farm"},
    {"type": "EvaraDeep", "id": "BW-P3", "node_key": "bw-p3", "label": "Borewell P3", "category": "Borewell", "capacity": "5 HP", "status": "Offline", "lat": 17.444678, "lng": 78.347234, "location_name": "Palash"},
    {"type": "EvaraDeep", "id": "BW-P4", "node_key": "bw-p4", "label": "Borewell P4", "category": "Borewell", "capacity": "--", "status": "Offline", "lat": 17.446649, "lng": 78.350578, "location_name": "Vindhya"},
    {"type": "EvaraDeep", "id": "BW-P5", "node_key": "bw-p5", "label": "Borewell P5", "category": "Borewell", "capacity": "5 HP", "status": "Online", "lat": 17.447783, "lng": 78.34904, "location_name": "Nilgiri"},
    {"type": "EvaraDeep", "id": "BW-P6", "node_key": "bw-p6", "label": "Borewell P6", "category": "Borewell", "capacity": "7.5 HP", "status": "Offline", "lat": 17.448335, "lng": 78.348594, "location_name": "Bakul"},
    {"type": "EvaraDeep", "id": "BW-P7", "node_key": "bw-p7", "label": "Borewell P7", "category": "Borewell", "capacity": "N/A", "status": "Offline", "lat": 17.445847, "lng": 78.346416, "location_name": "Volleyball"},
    {"type": "EvaraDeep", "id": "BW-P8", "node_key": "bw-p8", "label": "Borewell P8", "category": "Borewell", "capacity": "7.5 HP", "status": "Online", "lat": 17.445139, "lng": 78.345277, "location_name": "Palash"},
    {"type": "EvaraDeep", "id": "BW-P9", "node_key": "bw-p9", "label": "Borewell P9", "category": "Borewell", "capacity": "7.5 HP", "status": "Online", "lat": 17.446922, "lng": 78.346699, "location_name": "Girls Blk A"},
    {"type": "EvaraDeep", "id": "BW-P10", "node_key": "bw-p10", "label": "Borewell P10", "category": "Borewell", "capacity": "5 HP", "status": "Online", "lat": 17.443947, "lng": 78.350139, "location_name": "Parking NW"},
    {"type": "EvaraDeep", "id": "BW-P10A", "node_key": "bw-p10a", "label": "Borewell P10A", "category": "Borewell", "capacity": "--", "status": "Offline", "lat": 17.443451, "lng": 78.349635, "location_name": "Agri Farm"},
    {"type": "EvaraDeep", "id": "BW-P11", "node_key": "bw-p11", "label": "Borewell P11", "category": "Borewell", "capacity": "5 HP", "status": "Offline", "lat": 17.444431, "lng": 78.347649, "location_name": "Blk C,D,E"},
]

async def seed_db(force: bool = True):
    import asyncio
    try:
        # Strict 5-second timeout to prevent startup hang
        async with asyncio.timeout(5):
            print("🌱 Seeding Database...")
            async with AsyncSessionLocal() as session:
                # 1. Hierarchy: Distributor → Community
                distributor = await session.get(Distributor, "dist_evara_hq")
                if not distributor:
                    distributor = Distributor(
                        id="dist_evara_hq",
                        name="Evara HQ Distributor",
                        region="Hyderabad North",
                        status="active"
                    )
                    session.add(distributor)
                    
                community = await session.get(Community, "comm_myhome")
                if not community:
                    community = Community(
                        id="comm_myhome",
                        name="My Home Avatar",
                        region="Hyderabad",
                        city="Hyderabad",
                        distributor_id="dist_evara_hq",
                        status="active"
                    )
                    session.add(community)
                    
                await session.flush()

                # 2. Users (Linked to Community)
                for u in INITIAL_USERS:
                    existing = await session.get(User, u["id"])
                    if not existing:
                        u_data = u.copy()
                        u_data["community_id"] = "comm_myhome"
                        session.add(User(**u_data))
                
                # 3. Nodes (Linked to Org/Community)
                nodes_added = 0
                ts_mappings_added = 0
                for n in INITIAL_NODES:
                    n_data = n.copy()
                    analytics_type = n_data.pop("type")  # EvaraTank, EvaraDeep, EvaraFlow
                    node_id = n_data["id"]
                    
                    # Extract ThingSpeak config before creating node
                    ts_channel_id = n_data.pop("thingspeak_channel_id", None)
                    ts_read_key = n_data.pop("thingspeak_read_api_key", None)
                    
                    existing_node = await session.get(Node, node_id)
                    if existing_node:
                        # Node exists — but check if ThingSpeak mapping is missing
                        if ts_channel_id and not existing_node.thingspeak_mapping:
                            ts_mapping = DeviceThingSpeakMapping(
                                device_id=node_id,
                                channel_id=str(ts_channel_id),
                                read_api_key=EncryptionService.encrypt(ts_read_key) if ts_read_key else None,
                                field_mapping={"field1": "water_level", "field2": "tds", "field3": "temperature"}
                            )
                            session.add(ts_mapping)
                            ts_mappings_added += 1
                        continue

                    n_data["distributor_id"] = "dist_evara_hq"
                    n_data["community_id"] = "comm_myhome"
                    n_data["analytics_type"] = analytics_type  # Store analytics type in generic Node
                    
                    # Use single Node model for all device types
                    session.add(Node(**n_data))
                    nodes_added += 1
                    
                    # Create ThingSpeak mapping if credentials present (P7)
                    if ts_channel_id:
                        await session.flush()  # Ensure node exists before FK
                        ts_mapping = DeviceThingSpeakMapping(
                            device_id=node_id,
                            channel_id=str(ts_channel_id),
                            read_api_key=EncryptionService.encrypt(ts_read_key) if ts_read_key else None,
                            field_mapping={"field1": "water_level", "field2": "tds", "field3": "temperature"}
                        )
                        session.add(ts_mapping)
                        ts_mappings_added += 1
                
                await session.commit()
                
                from sqlalchemy import select, func
                count = await session.scalar(select(func.count()).select_from(Node))
                print(f"✅ Seeding Complete. Added {nodes_added} new nodes, {ts_mappings_added} ThingSpeak mappings. Total Nodes: {count}")
    except (asyncio.TimeoutError, Exception) as e:
        print(f"⚠️ Seeding skipped: Database unreachable (TIMEOUT). ({e})")

if __name__ == "__main__":
    asyncio.run(seed_db())
