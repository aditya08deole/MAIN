"""
Quick test script to check if migration worked
"""
import asyncio
from sqlalchemy import text
from database import engine


async def check_tables():
    """Check if tables exist"""
    async with engine.connect() as conn:
        # Check regions
        try:
            result = await conn.execute(text("SELECT COUNT(*) FROM regions"))
            count = result.scalar()
            print(f"[OK] regions table exists with {count} rows")
        except Exception as e:
            print(f"[ERROR] regions table: {e}")
        
        # Check communities
        try:
            result = await conn.execute(text("SELECT COUNT(*) FROM communities"))
            count = result.scalar()
            print(f"[OK] communities table exists with {count} rows")
        except Exception as e:
            print(f"[ERROR] communities table: {e}")
        
        # Check devices columns
        try:
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'devices' 
                AND column_name IN ('community_id', 'device_type', 'physical_category', 'analytics_template', 'thingspeak_write_key')
            """))
            columns = result.fetchall()
            print(f"[OK] devices table: {len(columns)} new columns - {[c[0] for c in columns]}")
        except Exception as e:
            print(f"[ERROR] devices columns: {e}")


if __name__ == "__main__":
    asyncio.run(check_tables())
