"""
Check communities table structure
"""
import asyncio
from sqlalchemy import text
from database import engine


async def check_communities_table():
    """Check communities table structure"""
    async with engine.connect() as conn:
        # Get all columns in communities table
        result = await conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'communities'
            ORDER BY ordinal_position
        """))
        columns = result.fetchall()
        
        print("Communities table columns:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")


if __name__ == "__main__":
    asyncio.run(check_communities_table())
