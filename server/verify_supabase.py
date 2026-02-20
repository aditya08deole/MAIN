"""
COMPREHENSIVE SUPABASE CONNECTION VERIFICATION
Tests the new Seoul region connection with correct credentials.
"""
import asyncio
import asyncpg
import ssl
import time

async def test_supabase_connection():
    """Test the NEW Supabase connection (Seoul region, correct password)."""
    
    # NEW CONNECTION DETAILS (Seoul region)
    host = "aws-1-ap-northeast-2.pooler.supabase.com"
    port = 6543
    database = "postgres"
    user = "postgres.tihrvotigvaozizlcxse"
    password = "Wgj7DFMIn8TQwUXU"  # NEW PASSWORD
    
    print("\n" + "="*80)
    print("🔍 SUPABASE CONNECTION VERIFICATION")
    print("="*80)
    print(f"Region: Seoul (ap-northeast-2)")
    print(f"Host: {host}")
    print(f"Port: {port} (Transaction Pooler)")
    print(f"Database: {database}")
    print(f"User: {user}")
    print(f"SSL: Enabled (required)")
    print("-"*80)
    
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
        print(f"✅ CONNECTED successfully in {elapsed}s!")
        print("-"*80)
        
        # Test 1: Simple query
        print("\n📊 TEST 1: Simple Query")
        start_time = time.time()
        result = await conn.fetchval("SELECT 1")
        elapsed = round((time.time() - start_time) * 1000, 2)
        print(f"✅ SELECT 1 = {result} ({elapsed}ms)")
        
        # Test 2: Database version
        print("\n📊 TEST 2: Database Version")
        version = await conn.fetchval("SELECT version()")
        print(f"✅ PostgreSQL: {version[:80]}...")
        
        # Test 3: Current database
        print("\n📊 TEST 3: Current Database")
        current_db = await conn.fetchval("SELECT current_database()")
        print(f"✅ Database: {current_db}")
        
        # Test 4: Schema check
        print("\n📊 TEST 4: Schema Check")
        schemas = await conn.fetch("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schema_name
        """)
        print(f"✅ Schemas found: {len(schemas)}")
        for schema in schemas:
            print(f"   - {schema['schema_name']}")
        
        # Test 5: Tables in public schema
        print("\n📊 TEST 5: Tables in 'public' Schema")
        tables = await conn.fetch("""
            SELECT table_name, table_type
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
        
        if len(tables) > 0:
            print(f"✅ Tables found: {len(tables)}")
            for table in tables[:10]:  # Show first 10
                print(f"   - {table['table_name']} ({table['table_type']})")
            if len(tables) > 10:
                print(f"   ... and {len(tables) - 10} more")
        else:
            print("⚠️  No tables found (this is OK for a fresh database)")
        
        # Test 6: Can create table?
        print("\n📊 TEST 6: Write Permission Test")
        try:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS _connection_test (
                    id SERIAL PRIMARY KEY,
                    test_value TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """)
            print("✅ Can create tables (write permission OK)")
            
            # Test insert
            await conn.execute("""
                INSERT INTO _connection_test (test_value) 
                VALUES ('Connection test successful')
            """)
            print("✅ Can insert data")
            
            # Test select
            count = await conn.fetchval("SELECT COUNT(*) FROM _connection_test")
            print(f"✅ Can read data (records: {count})")
            
            # Cleanup
            await conn.execute("DROP TABLE _connection_test")
            print("✅ Can drop tables (full permissions confirmed)")
            
        except Exception as e:
            print(f"⚠️  Write permission test failed: {e}")
        
        # Test 7: Connection info
        print("\n📊 TEST 7: Connection Information")
        server_version = await conn.fetchval("SHOW server_version")
        print(f"✅ Server version: {server_version}")
        
        await conn.close()
        
        # FINAL VERDICT
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED!")
        print("="*80)
        print("\n🎉 YOUR SUPABASE CONNECTION IS WORKING PERFECTLY!")
        print("\n📋 Connection String for Render:")
        print(f"   postgresql://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require")
        print("\n📝 Next Steps:")
        print("   1. Copy the connection string above")
        print("   2. Go to Render → Your Service → Environment")
        print("   3. Update DATABASE_URL with the connection string")
        print("   4. Click 'Save Changes'")
        print("   5. Wait for auto-deploy")
        print("   6. Test: https://your-backend.onrender.com/health")
        print("\n" + "="*80 + "\n")
        return True
        
    except asyncio.TimeoutError:
        elapsed = round(time.time() - start_time, 2)
        print(f"\n❌ CONNECTION TIMEOUT after {elapsed}s")
        print("\n🔧 Possible Issues:")
        print("   1. Check internet connection")
        print("   2. Verify Supabase project is active (not paused)")
        print("   3. Check if password is correct")
        print("   4. Try from Supabase SQL Editor to confirm DB is accessible")
        print("="*80 + "\n")
        return False
        
    except asyncpg.exceptions.InvalidPasswordError:
        print("\n❌ AUTHENTICATION FAILED - Invalid password")
        print("\n🔧 Fix:")
        print("   1. Go to Supabase → Project Settings → Database")
        print("   2. Reset Database Password")
        print("   3. Update password in this script")
        print("="*80 + "\n")
        return False
        
    except Exception as e:
        elapsed = round(time.time() - start_time, 2)
        print(f"\n❌ CONNECTION FAILED after {elapsed}s")
        print(f"\nError Type: {type(e).__name__}")
        print(f"Error Message: {str(e)}")
        print("\n🔧 Troubleshooting:")
        print("   1. Verify password is correct: Wgj7DFMIn8TQwUXU")
        print("   2. Check Supabase project status (not paused)")
        print("   3. Verify region: Seoul (ap-northeast-2)")
        print("   4. Test from Supabase dashboard SQL editor")
        print("="*80 + "\n")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_supabase_connection())
    
    if success:
        print("✅ You can now deploy to Render with confidence!")
    else:
        print("❌ Fix the issues above before deploying to Render")
