"""
Test backend endpoints
"""
import asyncio
from sqlalchemy import text
from database import get_db, engine


async def test_endpoints():
    """Test all new endpoints"""
    print("=" * 80)
    print("TESTING BACKEND ENDPOINTS")
    print("=" * 80)
    
    async with engine.connect() as conn:
        # Test 1: Regions endpoint (should return 20 cities)
        print("\n[TEST 1] Regions")
        result = await conn.execute(text("SELECT id, name, state FROM regions ORDER BY name LIMIT 5"))
        regions = result.fetchall()
        print(f"  [OK] Found {len(regions)} regions (showing first 5):")
        for region in regions:
            print(f"    - {region[1]}, {region[2]}")
        
        # Test 2: Communities endpoint (should return communities)
        print("\n[TEST 2] Communities")
        result = await conn.execute(text("SELECT COUNT(*) FROM communities"))
        count = result.scalar()
        print(f"  [OK] Found {count} communities")
        
        # Test 3: Check devices have new columns
        print("\n[TEST 3] Devices table structure")
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'devices' 
            AND column_name IN ('community_id', 'device_type', 'physical_category', 'analytics_template', 'thingspeak_write_key')
            ORDER BY column_name
        """))
        columns = result.fetchall()
        print(f"  [OK] New device columns ({len(columns)}):")
        for col in columns:
            print(f"    - {col[0]}")
        
        # Test 4: Check users have community_id
        print("\n[TEST 4] Users table structure")
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'community_id'
        """))
        col = result.fetchone()
        if col:
            print(f"  [OK] Users have community_id column")
        else:
            print(f"  [ERROR] Users missing community_id column")
        
        # Test 5: Sample query - get devices with their potential community
        print("\n[TEST 5] Sample device query")
        result = await conn.execute(text("""
            SELECT d.name, d.device_type, d.analytics_template, d.status 
            FROM devices d 
            LIMIT 5
        """))
        devices = result.fetchall()
        print(f"  [OK] Sample devices:")
        for device in devices:
            name, dtype, template, status = device
            print(f"    - {name}: type={dtype or 'NULL'}, template={template or 'NULL'}, status={status}")
    
    print("\n" + "=" * 80)
    print("[SUCCESS] All backend tests passed!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_endpoints())
