#!/usr/bin/env python3
"""
Test multiple Supabase connection endpoints
"""
import asyncio
import asyncpg

CONNECTIONS = [
    {
        "name": "Mumbai Pooler (6543)",
        "host": "aws-0-ap-south-1.pooler.supabase.com",
        "port": 6543,
        "user": "postgres.tihrvotigvaozizlcxse",
        "password": "Aditya@081204",
        "database": "postgres"
    },
    {
        "name": "Seoul Pooler (6543)",
        "host": "aws-1-ap-northeast-2.pooler.supabase.com",
        "port": 6543,
        "user": "postgres.tihrvotigvaozizlcxse",
        "password": "Wgj7DFMIn8TQwUXU",
        "database": "postgres"
    },
    {
        "name": "Direct Connection (5432)",
        "host": "db.tihrvotigvaozizlcxse.supabase.co",
        "port": 5432,
        "user": "postgres",
        "password": "Wgj7DFMIn8TQwUXU",
        "database": "postgres"
    }
]

async def test_connection(config):
    """Test a single connection"""
    print(f"\nTesting: {config['name']}")
    print(f"  Host: {config['host']}:{config['port']}")
    print(f"  User: {config['user']}")
    
    try:
        conn = await asyncpg.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database'],
            ssl="require",
            timeout=15
        )
        
        # Test query
        result = await conn.fetchval("SELECT 1")
        version = await conn.fetchval("SELECT version()")
        
        # Count tables
        table_count = await conn.fetchval("""
            SELECT COUNT(*) 
            FROM pg_tables 
            WHERE schemaname = 'public'
        """)
        
        await conn.close()
        
        print(f"  ✓ SUCCESS")
        print(f"  ✓ Test query: {result}")
        print(f"  ✓ Version: {version[:80]}...")
        print(f"  ✓ Tables: {table_count}")
        
        return True, config
        
    except asyncio.TimeoutError:
        print(f"  ✗ TIMEOUT")
        return False, None
    except Exception as e:
        print(f"  ✗ FAILED: {e}")
        return False, None

async def test_all():
    """Test all connections"""
    print("=" * 80)
    print("SUPABASE CONNECTION TEST")
    print("=" * 80)
    
    for config in CONNECTIONS:
        success, working_config = await test_connection(config)
        if success:
            print("\n" + "=" * 80)
            print(f"WORKING CONNECTION FOUND: {config['name']}")
            print("=" * 80)
            return working_config
    
    print("\n" + "=" * 80)
    print("NO WORKING CONNECTION FOUND")
    print("=" * 80)
    return None

if __name__ == "__main__":
    result = asyncio.run(test_all())
    exit(0 if result else 1)
