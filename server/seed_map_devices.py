"""
Seed script for map devices data.
Populates the devices table with water management infrastructure data.
"""
import asyncio
import sys
from sqlalchemy import text
from database import SessionLocal

# Device data extracted from map.html
MAP_DEVICES = [
    # Pump Houses
    {"name": "Pump House 1", "node_key": "PH-01", "label": "PH-01", "asset_type": "pump", "asset_category": "Primary Hub", "capacity": "4.98L L", "specifications": "ATM Gate", "status": "Running", "latitude": 17.4456, "longitude": 78.3516},
    {"name": "Pump House 2", "node_key": "PH-02", "label": "PH-02", "asset_type": "pump", "asset_category": "Secondary", "capacity": "75k L", "specifications": "Guest House", "status": "Running", "latitude": 17.44608, "longitude": 78.34925},
    {"name": "Pump House 3", "node_key": "PH-03", "label": "PH-03", "asset_type": "pump", "asset_category": "FSQ Node", "capacity": "55k L", "specifications": "Staff Qtrs", "status": "Running", "latitude": 17.4430, "longitude": 78.3487},
    {"name": "Pump House 4", "node_key": "PH-04", "label": "PH-04", "asset_type": "pump", "asset_category": "Hostel Node", "capacity": "2.00L L", "specifications": "Bakul", "status": "Running", "latitude": 17.4481, "longitude": 78.3489},
    
    # Sumps
    {"name": "Sump S1", "node_key": "SUMP-S1", "label": "SUMP-S1", "asset_type": "sump", "asset_category": "Hostel Sump", "capacity": "2.00L L", "specifications": "Bakul", "status": "Normal", "latitude": 17.448097, "longitude": 78.349060},
    {"name": "Sump S2", "node_key": "SUMP-S2", "label": "SUMP-S2", "asset_type": "sump", "asset_category": "Hostel Sump", "capacity": "1.10L L", "specifications": "Palash", "status": "Normal", "latitude": 17.444919, "longitude": 78.346195},
    {"name": "Sump S3", "node_key": "SUMP-S3", "label": "SUMP-S3", "asset_type": "sump", "asset_category": "Hostel Sump", "capacity": "1.00L L", "specifications": "NBH", "status": "Normal", "latitude": 17.446779, "longitude": 78.346996},
    {"name": "Sump S4 (Main Sump)", "node_key": "SUMP-S4", "label": "SUMP-S4", "asset_type": "sump", "asset_category": "Main Sump", "capacity": "4.98L L", "specifications": "Central", "status": "Normal", "latitude": 17.445630, "longitude": 78.351593},
    {"name": "Sump S5", "node_key": "SUMP-S5", "label": "SUMP-S5", "asset_type": "sump", "asset_category": "Block Sump", "capacity": "55k L", "specifications": "Blk A&B", "status": "Normal", "latitude": 17.444766, "longitude": 78.350087},
    {"name": "Sump S6", "node_key": "SUMP-S6", "label": "SUMP-S6", "asset_type": "sump", "asset_category": "Guest Sump", "capacity": "10k L", "specifications": "Guest House", "status": "Normal", "latitude": 17.445498, "longitude": 78.350202},
    {"name": "Sump S7", "node_key": "SUMP-S7", "label": "SUMP-S7", "asset_type": "sump", "asset_category": "Pump Sump", "capacity": "43k L", "specifications": "Pump House", "status": "Normal", "latitude": 17.44597, "longitude": 78.34906},
    {"name": "Sump S8", "node_key": "SUMP-S8", "label": "SUMP-S8", "asset_type": "sump", "asset_category": "Ground Sump", "capacity": "12k L", "specifications": "Football", "status": "Normal", "latitude": 17.446683, "longitude": 78.348995},
    {"name": "Sump S9", "node_key": "SUMP-S9", "label": "SUMP-S9", "asset_type": "sump", "asset_category": "Felicity Sump", "capacity": "15k L", "specifications": "Felicity", "status": "Normal", "latitude": 17.446613, "longitude": 78.346487},
    {"name": "Sump S10", "node_key": "SUMP-S10", "label": "SUMP-S10", "asset_type": "sump", "asset_category": "FSQ Sump", "capacity": "34k+31k", "specifications": "FSQ A&B", "status": "Normal", "latitude": 17.443076, "longitude": 78.348737},
    {"name": "Sump S11", "node_key": "SUMP-S11", "label": "SUMP-S11", "asset_type": "sump", "asset_category": "FSQ Sump", "capacity": "1.5L+60k", "specifications": "FSQ C,D,E", "status": "Normal", "latitude": 17.444773, "longitude": 78.347797},
    
    # OHTs/Tanks
    {"name": "Bakul OHT", "node_key": "OHT-1", "label": "OHT-1", "asset_type": "tank", "asset_category": "OHT Pair", "capacity": "2 Units", "specifications": "3x(16'2\"x15'x4\")", "status": "Normal", "latitude": 17.448045, "longitude": 78.348438},
    {"name": "Parijat OHT", "node_key": "OHT-2", "label": "OHT-2", "asset_type": "tank", "asset_category": "OHT Pair", "capacity": "2 Units", "specifications": "19'x9'5\"x7'4\"", "status": "Normal", "latitude": 17.447547, "longitude": 78.347752},
    {"name": "Kadamba OHT", "node_key": "OHT-3", "label": "OHT-3", "asset_type": "tank", "asset_category": "OHT Pair", "capacity": "2 Units", "specifications": "19'x9'5\"x7'4\"", "status": "Normal", "latitude": 17.446907, "longitude": 78.347178},
    {"name": "NWH Block C OHT", "node_key": "OHT-4", "label": "OHT-4", "asset_type": "tank", "asset_category": "OHT", "capacity": "1 Unit", "specifications": "15' x 11' x 4'7\"", "status": "Normal", "latitude": 17.447675, "longitude": 78.347430},
    {"name": "NWH Block B OHT", "node_key": "OHT-5", "label": "OHT-5", "asset_type": "tank", "asset_category": "OHT", "capacity": "1 Unit", "specifications": "14'9\"x8'5\"", "status": "Normal", "latitude": 17.447391, "longitude": 78.347172},
    {"name": "NWH Block A OHT", "node_key": "OHT-6", "label": "OHT-6", "asset_type": "tank", "asset_category": "OHT", "capacity": "1 Unit", "specifications": "15' x 10'9\" x 5'", "status": "Normal", "latitude": 17.447081, "longitude": 78.346884},
    {"name": "Palash Nivas OHT 7", "node_key": "OHT-7", "label": "OHT-7", "asset_type": "tank", "asset_category": "OHT Cluster", "capacity": "4 Units", "specifications": "12'6\" x 12'6\" x 11\"", "status": "Normal", "latitude": 17.445096, "longitude": 78.345966},
    {"name": "Anand Nivas OHT 8", "node_key": "OHT-8", "label": "OHT-8", "asset_type": "tank", "asset_category": "OHT Pair", "capacity": "2 Units", "specifications": "2x(11'x10'9\")", "status": "Normal", "latitude": 17.443976, "longitude": 78.348432},
    {"name": "Budha Nivas OHT 9", "node_key": "OHT-9", "label": "OHT-9", "asset_type": "tank", "asset_category": "OHT Pair", "capacity": "2 Units", "specifications": "2x(10'9\"x10'2\")", "status": "Normal", "latitude": 17.443396, "longitude": 78.348500},
    {"name": "C Block OHT 10", "node_key": "OHT-10", "label": "OHT-10", "asset_type": "tank", "asset_category": "OHT Cluster", "capacity": "3 Units", "specifications": "2x(5'8\"x11'7\")", "status": "Normal", "latitude": 17.443387, "longitude": 78.347834},
    {"name": "D Block OHT 11", "node_key": "OHT-11", "label": "OHT-11", "asset_type": "tank", "asset_category": "OHT Cluster", "capacity": "3 Units", "specifications": "2x(11'9\"x6'11\")", "status": "Normal", "latitude": 17.443914, "longitude": 78.347773},
    {"name": "E Block OHT 12", "node_key": "OHT-12", "label": "OHT-12", "asset_type": "tank", "asset_category": "OHT Cluster", "capacity": "3 Units", "specifications": "2x(11'x6'8\")", "status": "Normal", "latitude": 17.444391, "longitude": 78.347958},
    {"name": "Vindhya OHT", "node_key": "OHT-13", "label": "OHT-13", "asset_type": "tank", "asset_category": "OHT Cluster (4 Units)", "capacity": "Mixed Sources", "specifications": "Bore: 29'6\" & 21'11\" | Manjeera: 22'", "status": "Normal", "latitude": 17.44568, "longitude": 78.34973},
    {"name": "Himalaya OHT (KRB)", "node_key": "OHT-14", "label": "OHT-14", "asset_type": "tank", "asset_category": "OHT (1 Unit)", "capacity": "Borewell", "specifications": "13'11\"x29' | 14'10\"x29' (x2)", "status": "Normal", "latitude": 17.44525, "longitude": 78.34966},
    
    # IIIT Borewells
    {"name": "Borewell P1", "node_key": "BW-P1", "label": "BW-P1", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "5 HP", "specifications": "Block C,D,E", "status": "Not Working", "latitude": 17.443394, "longitude": 78.348117},
    {"name": "Borewell P2", "node_key": "BW-P2", "label": "BW-P2", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "12.5 HP", "specifications": "Agri Farm", "status": "Not Working", "latitude": 17.443093, "longitude": 78.348936},
    {"name": "Borewell P3", "node_key": "BW-P3", "label": "BW-P3", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "5 HP", "specifications": "Palash", "status": "Not Working", "latitude": 17.444678, "longitude": 78.347234},
    {"name": "Borewell P4", "node_key": "BW-P4", "label": "BW-P4", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "--", "specifications": "Vindhya", "status": "Not Working", "latitude": 17.446649, "longitude": 78.350578},
    {"name": "Borewell P5", "node_key": "BW-P5", "label": "BW-P5", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "5 HP", "specifications": "Nilgiri", "status": "Working", "latitude": 17.447783, "longitude": 78.349040},
    {"name": "Borewell P6", "node_key": "BW-P6", "label": "BW-P6", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "5/7.5 HP", "specifications": "Bakul", "status": "Not Working", "latitude": 17.448335, "longitude": 78.348594},
    {"name": "Borewell P7", "node_key": "BW-P7", "label": "BW-P7", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "N/A", "specifications": "Volleyball", "status": "Not Working", "latitude": 17.445847, "longitude": 78.346416},
    {"name": "Borewell P8", "node_key": "BW-P8", "label": "BW-P8", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "7.5 HP", "specifications": "Palash", "status": "Working", "latitude": 17.445139, "longitude": 78.345277},
    {"name": "Borewell P9", "node_key": "BW-P9", "label": "BW-P9", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "7.5 HP", "specifications": "Girls Blk A", "status": "Working", "latitude": 17.446922, "longitude": 78.346699},
    {"name": "Borewell P10", "node_key": "BW-P10", "label": "BW-P10", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "5 HP", "specifications": "Parking NW", "status": "Working", "latitude": 17.443947, "longitude": 78.350139},
    {"name": "Borewell P10A", "node_key": "BW-P10A", "label": "BW-P10A", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "--", "specifications": "Agri Farm", "status": "Not Working", "latitude": 17.443451, "longitude": 78.349635},
    {"name": "Borewell P11", "node_key": "BW-P11", "label": "BW-P11", "asset_type": "bore", "asset_category": "IIIT Bore", "capacity": "5 HP", "specifications": "Blk C,D,E", "status": "Not Working", "latitude": 17.444431, "longitude": 78.347649},
    
    # Government Borewells
    {"name": "Borewell 1", "node_key": "BW-G1", "label": "BW-G1", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "5 HP", "specifications": "Palash", "status": "Not Working", "latitude": 17.444601, "longitude": 78.345459},
    {"name": "Borewell 2", "node_key": "BW-G2", "label": "BW-G2", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "1.5 HP", "specifications": "Palash", "status": "Not Working", "latitude": 17.445490, "longitude": 78.346838},
    {"name": "Borewell 3", "node_key": "BW-G3", "label": "BW-G3", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "5 HP", "specifications": "Vindhaya C4", "status": "Working", "latitude": 17.446188, "longitude": 78.350067},
    {"name": "Borewell 4", "node_key": "BW-G4", "label": "BW-G4", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "N/A", "specifications": "Entrance", "status": "Not Working", "latitude": 17.447111, "longitude": 78.350151},
    {"name": "Borewell 5", "node_key": "BW-G5", "label": "BW-G5", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "N/A", "specifications": "Entrance", "status": "Not Working", "latitude": 17.446311, "longitude": 78.351042},
    {"name": "Borewell 6", "node_key": "BW-G6", "label": "BW-G6", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "N/A", "specifications": "Bamboo House", "status": "Not Working", "latitude": 17.445584, "longitude": 78.347148},
    {"name": "Borewell 7", "node_key": "BW-G7", "label": "BW-G7", "asset_type": "govt", "asset_category": "Govt Bore", "capacity": "N/A", "specifications": "Football", "status": "Not Working", "latitude": 17.446115, "longitude": 78.348536},
]


async def seed_devices():
    """Seed devices table with map data."""
    async with SessionLocal() as db:
        try:
            # Use dev-bypass admin user
            admin_user_id = "dev-bypass-id-admin@evara.com"
            
            print(f"[SEED] Starting device seed for user: {admin_user_id}")
            print(f"[SEED] Total devices to insert: {len(MAP_DEVICES)}")
            
            inserted = 0
            updated = 0
            
            for device_data in MAP_DEVICES:
                # Check if device already exists
                check_query = text("""
                    SELECT id FROM devices WHERE node_key = :node_key
                """)
                result = await db.execute(check_query, {"node_key": device_data["node_key"]})
                existing = result.fetchone()
                
                if existing:
                    # Update existing device
                    update_query = text("""
                        UPDATE devices SET
                            name = :name,
                            asset_type = :asset_type,
                            asset_category = :asset_category,
                            latitude = :latitude,
                            longitude = :longitude,
                            capacity = :capacity,
                            specifications = :specifications,
                            status = :status,
                            is_active = 'true',
                            updated_at = NOW()
                        WHERE node_key = :node_key
                    """)
                    await db.execute(update_query, {
                        "node_key": device_data["node_key"],
                        "name": device_data["name"],
                        "asset_type": device_data["asset_type"],
                        "asset_category": device_data["asset_category"],
                        "latitude": device_data["latitude"],
                        "longitude": device_data["longitude"],
                        "capacity": device_data["capacity"],
                        "specifications": device_data["specifications"],
                        "status": device_data["status"]
                    })
                    updated += 1
                    print(f"  ✓ Updated: {device_data['name']}")
                else:
                    # Insert new device
                    insert_query = text("""
                        INSERT INTO devices (
                            id, node_key, label, name, asset_type, asset_category,
                            latitude, longitude, capacity, specifications,
                            status, is_active, user_id, category, created_at, updated_at
                        ) VALUES (
                            gen_random_uuid(), :node_key, :label, :name, :asset_type, :asset_category,
                            :latitude, :longitude, :capacity, :specifications,
                            :status, 'true', :user_id, :category, NOW(), NOW()
                        )
                    """)
                    await db.execute(insert_query, {
                        "node_key": device_data["node_key"],
                        "label": device_data["label"],
                        "name": device_data["name"],
                        "asset_type": device_data["asset_type"],
                        "asset_category": device_data["asset_category"],
                        "latitude": device_data["latitude"],
                        "longitude": device_data["longitude"],
                        "capacity": device_data["capacity"],
                        "specifications": device_data["specifications"],
                        "status": device_data["status"],
                        "user_id": admin_user_id,
                        "category": device_data["asset_type"]  # Set category same as asset_type for compatibility
                    })
                    inserted += 1
                    print(f"  ✓ Inserted: {device_data['name']}")
            
            await db.commit()
            
            print(f"\n[SEED] Complete!")
            print(f"  - Inserted: {inserted} devices")
            print(f"  - Updated: {updated} devices")
            print(f"  - Total: {inserted + updated} devices")
            
            # Verify count
            count_query = text("SELECT COUNT(*) FROM devices WHERE is_active = 'true'")
            result = await db.execute(count_query)
            total = result.scalar()
            print(f"  - Active devices in database: {total}")
            
        except Exception as e:
            print(f"[ERROR] Seed failed: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()
            raise


if __name__ == "__main__":
    print("=" * 80)
    print("DEVICE SEED SCRIPT")
    print("=" * 80)
    asyncio.run(seed_devices())
    print("=" * 80)
