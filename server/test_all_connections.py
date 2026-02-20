"""
Test multiple Supabase connection methods.
"""
import asyncio
import asyncpg
import ssl
import time

async def test_connection(host, port, description):
    """Test a specific connection configuration."""
    database = "postgres"
    user = "postgres.tihrvotigvaozizlcxse"
    password = "Aditya@081204"
    
    print(f"\n{'='*70}")
    print(f"🔍 {description}")
    print(f"{'='*70}")
    print(f"Host: {host}:{port}")
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    try:
        print("⏱️  Attempting connection (15s timeout)...")
        start_time = time.time()
        
        conn = await asyncio.wait_for(
            asyncpg.connect(
                host=host,
                port=port,
                database=database,
                user=user,
                password=password,
                ssl=ssl_context,
                timeout=15
            ),
            timeout=18
        )
        
        elapsed = round(time.time() - start_time, 2)
        print(f"✅ Connected in {elapsed}s")
        
        # Test query
        result = await conn.fetchval("SELECT 1")
        print(f"✅ Query successful: {result}")
        
        # Get table count
        tables = await conn.fetch("""
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        print(f"✅ Tables found: {tables[0]['count']}")
        
        await conn.close()
        print(f"\n✅ SUCCESS - Use this configuration!")
        return True
        
    except asyncio.TimeoutError:
        print(f"❌ TIMEOUT after 15s")
        return False
    except Exception as e:
        print(f"❌ FAILED: {type(e).__name__}: {str(e)[:100]}")
        return False

async def main():
    """Test all connection methods."""
    
    print("\n" + "="*70)
    print("🚀 TESTING ALL SUPABASE CONNECTION METHODS")
    print("="*70)
    
    # Connection options to test
    connections = [
        ("aws-0-ap-south-1.pooler.supabase.com", 6543, "Pooler (Transaction Mode)"),
        ("aws-0-ap-south-1.pooler.supabase.com", 5432, "Pooler (Session Mode)"),
        ("db.tihrvotigvaozizlcxse.supabase.co", 5432, "Direct Connection"),
        ("db.tihrvotigvaozizlcxse.supabase.co", 6543, "Direct Connection (Alt Port)"),
    ]
    
    results = []
    for host, port, description in connections:
        success = await test_connection(host, port, description)
        results.append((description, success))
        
        if success:
            print(f"\n{'='*70}")
            print(f"✅ WORKING CONNECTION FOUND!")
            print(f"{'='*70}")
            print(f"\nUpdate your .env DATABASE_URL to:")
            if port == 6543:
                print(f'"postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Aditya%40081204@{host}:6543/postgres"')
            else:
                print(f'"postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Aditya%40081204@{host}:5432/postgres"')
            print(f"\n{'='*70}\n")
            break
        
        await asyncio.sleep(1)  # Brief pause between attempts
    
    # Summary
    print(f"\n{'='*70}")
    print("📊 CONNECTION TEST SUMMARY")
    print(f"{'='*70}")
    for description, success in results:
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"{status} - {description}")
    
    if not any(success for _, success in results):
        print(f"\n{'='*70}")
        print("❌ ALL CONNECTION METHODS FAILED")
        print(f"{'='*70}")
        print("\n🔧 Next Steps:")
        print("   1. Check if Supabase project is paused (visit dashboard)")
        print("   2. Verify your internet connection")
        print("   3. Try from Supabase SQL Editor to confirm DB is accessible")
        print("   4. Check Windows Firewall settings")
        print("   5. Deploy to Render where network access should work")
        print(f"\n{'='*70}\n")

if __name__ == "__main__":
    asyncio.run(main())
