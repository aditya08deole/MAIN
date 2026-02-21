#!/usr/bin/env python3
"""
Quick database connectivity test
"""
import asyncio
from database import engine
from sqlalchemy import text

async def test_connection():
    """Test database connection"""
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            print(f"✓ Database connection successful: {row}")
            
            # Test tables exist
            result = await conn.execute(text(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"
            ))
            count = result.scalar()
            print(f"✓ Tables in public schema: {count}")
            
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False
    finally:
        await engine.dispose()

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    exit(0 if success else 1)
