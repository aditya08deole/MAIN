"""
Direct Supabase connection test - diagnose connectivity issues.
"""
import asyncio
import asyncpg
import ssl
import time

async def test_supabase_connection():
    """Test direct connection to Supabase."""
    
    # Connection details
    host = "aws-0-ap-south-1.pooler.supabase.com"
    port = 6543
    database = "postgres"
    user = "postgres.tihrvotigvaozizlcxse"
    password = "Aditya@081204"
    
    print("\n" + "="*70)
    print("🔍 SUPABASE CONNECTION TEST")
    print("="*70)
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"Database: {database}")
    print(f"User: {user}")
    print("-"*70)
    
    # Create SSL context
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        print("\n⏱️  Attempting connection (30s timeout)...")
        start_time = time.time()
        
        conn = await asyncio.wait_for(
            asyncpg.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                ssl=ssl_context,
                timeout=30,
                command_timeout=60
            ),
            timeout=35
        )
        
        elapsed = round(time.time() - start_time, 2)
        print(f"✅ Connected successfully in {elapsed}s")
        print("-"*70)
        
        # Test query
        print("\n🔄 Testing database query...")
        start_time = time.time()
        result = await conn.fetchval("SELECT 1")
        elapsed = round(time.time() - start_time, 2)
        print(f"✅ Query successful: SELECT 1 = {result} ({elapsed}s)")
        
        # Get database info
        print("\n📊 Database Information:")
        version = await conn.fetchval("SELECT version()")
        print(f"   PostgreSQL: {version[:60]}...")
        
        # Check tables
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        print(f"\n📋 Tables in 'public' schema: {len(tables)} found")
        for table in tables[:5]:  # Show first 5
            print(f"   - {table['table_name']}")
        if len(tables) > 5:
            print(f"   ... and {len(tables) - 5} more")
        
        await conn.close()
        print("\n" + "="*70)
        print("✅ ALL TESTS PASSED - Supabase is working!")
        print("="*70 + "\n")
        return True
        
    except asyncio.TimeoutError:
        elapsed = round(time.time() - start_time, 2)
        print(f"\n❌ CONNECTION TIMEOUT after {elapsed}s")
        print("\n🔧 Troubleshooting:")
        print("   1. Check your internet connection")
        print("   2. Verify firewall isn't blocking port 6543")
        print("   3. Try connecting from Supabase SQL Editor to verify DB is up")
        print("   4. Check if VPN/proxy is interfering")
        print("="*70 + "\n")
        return False
        
    except asyncpg.exceptions.InvalidPasswordError:
        print("\n❌ AUTHENTICATION FAILED - Invalid password")
        print("\n🔧 Check your .env file:")
        print("   DATABASE_URL password may be incorrect")
        print("="*70 + "\n")
        return False
        
    except asyncpg.exceptions.InvalidAuthorizationSpecificationError:
        print("\n❌ AUTHORIZATION FAILED - Invalid credentials")
        print("="*70 + "\n")
        return False
        
    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        print(f"\n❌ CONNECTION FAILED after {elapsed}s")
        print(f"\nError Type: {type(e).__name__}")
        print(f"Error Message: {str(e)}")
        print("\n🔧 Troubleshooting:")
        print("   1. Verify Supabase project is active (not paused)")
        print("   2. Check DATABASE_URL in .env is correct")
        print("   3. Ensure connection pooler is enabled in Supabase")
        print("="*70 + "\n")
        return False

if __name__ == "__main__":
    asyncio.run(test_supabase_connection())
