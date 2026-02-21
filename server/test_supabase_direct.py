#!/usr/bin/env python3
"""
Direct Supabase connection test - bypassing SQLAlchemy
"""
import asyncio
import asyncpg
import os

async def test_direct_connection():
    """Test direct connection to Supabase"""
    
    # Connection parameters
    host = "aws-0-ap-south-1.pooler.supabase.com"
    port = 6543
    user = "postgres.tihrvotigvaozizlcxse"
    password = "Aditya@081204"
    database = "postgres"
    
    print(f"Attempting connection to {host}:{port}...")
    print(f"User: {user}")
    print(f"Database: {database}")
    print("-" * 80)
    
    try:
        conn = await asyncpg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            ssl="require",
            timeout=30,
            command_timeout=30
        )
        
        print("✓ CONNECTION SUCCESSFUL")
        print("-" * 80)
        
        # Test query
        result = await conn.fetchval("SELECT 1")
        print(f"✓ Test query result: {result}")
        
        # Get database version
        version = await conn.fetchval("SELECT version()")
        print(f"✓ PostgreSQL Version: {version[:100]}...")
        
        # List tables
        tables = await conn.fetch("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        
        print(f"\n✓ Tables in public schema ({len(tables)}):")
        for row in tables:
            print(f"  - {row['tablename']}")
        
        await conn.close()
        print("\n✓ Connection closed successfully")
        return True
        
    except Exception as e:
        print(f"\n✗ CONNECTION FAILED: {e}")
        print(f"Error type: {type(e).__name__}")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_direct_connection())
    exit(0 if success else 1)
