#!/usr/bin/env python3
"""
Test connection with extended timeout and SSL configuration
"""
import asyncio
import asyncpg
import ssl

async def test_with_ssl():
    """Test with proper SSL context"""
    print("=" * 80)
    print("TESTING WITH EXTENDED TIMEOUT AND SSL CONTEXT")
    print("=" * 80)
    
    # Create SSL context
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    configs = [
        {
            "name": "Mumbai (No SSL Verify)",
            "host": "aws-0-ap-south-1.pooler.supabase.com",
            "port": 6543,
            "user": "postgres.tihrvotigvaozizlcxse",
            "password": "Aditya@081204",
        },
        {
            "name": "Seoul (No SSL Verify)",
            "host": "aws-1-ap-northeast-2.pooler.supabase.com",
            "port": 6543,
            "user": "postgres.tihrvotigvaozizlcxse",
            "password": "Wgj7DFMIn8TQwUXU",
        }
    ]
    
    for config in configs:
        print(f"\nTesting: {config['name']}")
        print(f"  Host: {config['host']}:{config['port']}")
        print(f"  User: {config['user']}")
        print(f"  Timeout: 60 seconds")
        
        try:
            conn = await asyncio.wait_for(
                asyncpg.connect(
                    host=config['host'],
                    port=config['port'],
                    user=config['user'],
                    password=config['password'],
                    database="postgres",
                    ssl=ssl_context,
                    command_timeout=60
                ),
                timeout=60
            )
            
            print(f"  ✓ Connected!")
            
            # Test queries
            version = await conn.fetchval("SELECT version()")
            print(f"  ✓ Version: {version[:100]}...")
            
            tables = await conn.fetch("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            """)
            
            print(f"  ✓ Tables found: {len(tables)}")
            for table in tables[:10]:
                print(f"      - {table['tablename']}")
            
            if len(tables) > 10:
                print(f"      ... and {len(tables) - 10} more")
            
            await conn.close()
            print(f"  ✓ Connection closed successfully")
            
            return True, config
            
        except asyncio.TimeoutError:
            print(f"  ✗ TIMEOUT (60s)")
        except Exception as e:
            print(f"  ✗ FAILED: {type(e).__name__}: {e}")
    
    return False, None

if __name__ == "__main__":
    success, config = asyncio.run(test_with_ssl())
    
    if success:
        print("\n" + "=" * 80)
        print("SUCCESS! Use this connection:")
        print("=" * 80)
        print(f"Host: {config['host']}")
        print(f"Port: {config['port']}")
        print(f"User: {config['user']}")
        print(f"Password: {config['password']}")
        exit(0)
    else:
        print("\n" + "=" * 80)
        print("ALL TESTS FAILED")
        print("=" * 80)
        exit(1)
