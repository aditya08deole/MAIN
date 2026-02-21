"""
Run database migration 003: Devices Map Upgrade
"""
import asyncio
from sqlalchemy import text
from database import engine


async def run_migration():
    """Execute migration SQL."""
    print("=" * 80)
    print("RUNNING MIGRATION: 003_devices_map_upgrade.sql")
    print("=" * 80)
    
    try:
        # Read migration file
        with open('migrations/003_devices_map_upgrade.sql', 'r') as f:
            migration_sql = f.read()
        
        # Execute migration
        async with engine.begin() as conn:
            await conn.execute(text(migration_sql))
        
        print("\n✓ Migration completed successfully!")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(run_migration())
