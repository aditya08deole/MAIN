"""
Fix communities table - ensure it has correct structure
"""
import asyncio
from sqlalchemy import text
from database import engine


async def fix_communities_table():
    """Fix communities table structure"""
    print("=" * 80)
    print("FIXING COMMUNITIES TABLE")
    print("=" * 80)
    
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        
        # Drop and recreate communities table with correct structure
        print("\n[INFO] Dropping old communities table...")
        await conn.execute(text("DROP TABLE IF EXISTS communities CASCADE"))
        
        print("[INFO] Creating communities table with correct structure...")
        await conn.execute(text("""
            CREATE TABLE communities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
                address TEXT,
                contact_email TEXT,
                contact_phone TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(name, region_id)
            )
        """))
        
        print("[INFO] Creating indexes...")
        await conn.execute(text("CREATE INDEX idx_communities_region_id ON communities(region_id)"))
        await conn.execute(text("CREATE INDEX idx_communities_name ON communities(name)"))
        
        print("[INFO] Creating trigger...")
        await conn.execute(text("""
            CREATE TRIGGER communities_updated_at_trigger
            BEFORE UPDATE ON communities
            FOR EACH ROW
            EXECUTE FUNCTION update_timestamp()
        """))
        
        # Verify
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'communities'
            ORDER BY ordinal_position
        """))
        columns = [r[0] for r in result.fetchall()]
        
        print(f"\n[SUCCESS] Communities table created with columns: {', '.join(columns)}")
        print("=" * 80)


if __name__ == "__main__":
    asyncio.run(fix_communities_table())
