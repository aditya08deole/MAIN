#!/usr/bin/env python3
"""
Health Check Script for EvaraTech Backend
Run this to diagnose connection and configuration issues
"""
import os
import sys
import asyncio
import httpx
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

async def check_health():
    print("🔍 EvaraTech Backend Health Check\n")
    print("=" * 60)
    
    # 1. Check Environment Variables
    print("\n📋 Environment Variables:")
    required_vars = [
        "DATABASE_URL",
        "SUPABASE_URL",
        "SUPABASE_KEY",
        "SUPABASE_JWT_SECRET"
    ]
    
    missing = []
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # Mask sensitive values
            if "KEY" in var or "SECRET" in var or "PASSWORD" in var.upper():
                display = f"{value[:10]}...{value[-10:]}" if len(value) > 20 else "***"
            else:
                display = value
            print(f"  ✅ {var}: {display}")
        else:
            print(f"  ❌ {var}: NOT SET")
            missing.append(var)
    
    if missing:
        print(f"\n⚠️  Missing variables: {', '.join(missing)}")
        return False
    
    # 2. Check Database Connection
    print("\n🗄️  Database Connection:")
    try:
        from app.db.session import engine
        from sqlalchemy import text
        
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print("  ✅ Database connection successful")
    except Exception as e:
        print(f"  ❌ Database connection failed: {e}")
        return False
    
    # 3. Check Supabase API
    print("\n☁️  Supabase API:")
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{supabase_url}/rest/v1/")
            print(f"  ✅ Supabase API reachable (HTTP {resp.status_code})")
    except Exception as e:
        print(f"  ❌ Supabase API check failed: {e}")
    
    # 4. Check Backend Server
    print("\n🌐 Backend Server:")
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get("http://localhost:8000/health")
            data = resp.json()
            print(f"  ✅ Server is running")
            print(f"     Status: {data.get('status')}")
            print(f"     Uptime: {data.get('uptime_seconds')}s")
            print(f"     DB Status: {data.get('database', {}).get('status')}")
    except httpx.ConnectError:
        print("  ⚠️  Server not running (start with: uvicorn app.main:app --reload)")
    except Exception as e:
        print(f"  ❌ Server check failed: {e}")
    
    # 5. Check Tables
    print("\n📊 Database Tables:")
    try:
        from sqlalchemy import inspect
        async with engine.connect() as conn:
            def check_tables(conn_sync):
                inspector = inspect(conn_sync)
                return inspector.get_table_names()
            
            tables = await conn.run_sync(check_tables)
            essential_tables = ['nodes', 'users_profiles', 'communities', 'distributors']
            
            for table in essential_tables:
                if table in tables:
                    print(f"  ✅ {table}")
                else:
                    print(f"  ❌ {table} - MISSING! Run migration SQL")
    except Exception as e:
        print(f"  ❌ Table check failed: {e}")
    
    print("\n" + "=" * 60)
    print("✅ Health check complete!\n")
    return True

if __name__ == "__main__":
    # Load environment
    from dotenv import load_dotenv
    load_dotenv()
    
    asyncio.run(check_health())
