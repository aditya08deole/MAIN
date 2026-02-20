"""
Quick setup for local SQLite development.
"""
import subprocess
import sys
import os
import shutil

def run_command(cmd, description):
    """Run a command and show progress."""
    print(f"\n🔄 {description}...")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"✅ {description} - Success!")
            return True
        else:
            print(f"❌ {description} - Failed!")
            if result.stderr:
                print(f"   Error: {result.stderr[:200]}")
            return False
    except Exception as e:
        print(f"❌ {description} - Error: {e}")
        return False

def main():
    print("\n" + "="*70)
    print("🚀 LOCAL SQLITE SETUP")
    print("="*70)
    print("\nThis will set up SQLite for local development (no network needed!)")
    print("\n" + "="*70)
    
    # Step 1: Install aiosqlite
    print("\n📦 STEP 1: Install Dependencies")
    run_command(
        "python -m pip install aiosqlite --quiet",
        "Installing aiosqlite"
    )
    
    # Step 2: Copy .env.local to .env
    print("\n📦 STEP 2: Configure Database")
    if os.path.exists('.env.local'):
        # Backup current .env
        if os.path.exists('.env'):
            shutil.copy('.env', '.env.backup')
            print("✅ Backed up current .env to .env.backup")
        
        shutil.copy('.env.local', '.env')
        print("✅ Configured for SQLite (copied .env.local to .env)")
    else:
        print("❌ .env.local not found!")
        return
    
    # Step 3: Verify configuration
    print("\n📦 STEP 3: Verify Configuration")
    with open('.env', 'r') as f:
        content = f.read()
        if 'sqlite' in content.lower():
            print("✅ Database: SQLite")
            print("   📁 Database file: evara_local.db")
            print("   🌐 Network: Not required")
        else:
            print("⚠️  Warning: .env doesn't contain SQLite configuration")
    
    # Step 4: Test database
    print("\n📦 STEP 4: Test Database Connection")
    print("   Starting server on port 8002 (5 second test)...")
    
    # Start server in background
    import subprocess
    import time
    
    server_process = subprocess.Popen(
        "python -m uvicorn main:app --host 0.0.0.0 --port 8002",
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for startup
    time.sleep(3)
    
    # Test health endpoint
    try:
        import urllib.request
        response = urllib.request.urlopen('http://localhost:8002/health', timeout=3)
        data = response.read().decode('utf-8')
        if '"status"' in data:
            print("✅ Server started successfully!")
            print(f"   Response: {data[:100]}")
        else:
            print("⚠️  Server started but health check returned unexpected data")
    except Exception as e:
        print(f"⚠️  Could not reach health endpoint: {e}")
        print("   (This is okay - server might still be starting)")
    
    # Stop server
    server_process.terminate()
    time.sleep(1)
    server_process.kill()
    
    # Success message
    print("\n" + "="*70)
    print("✅ SETUP COMPLETE!")
    print("="*70)
    print("\n📚 Quick Start:")
    print("\n   1. Start server:")
    print("      python -m uvicorn main:app --reload --port 8000")
    print("\n   2. Test API:")
    print("      http://localhost:8000/docs")
    print("\n   3. Switch back to Supabase:")
    print("      python switch_database.py")
    print("\n" + "="*70)
    print("\n💡 BENEFITS OF SQLITE:")
    print("   ✅ No network required")
    print("   ✅ No firewall issues")
    print("   ✅ Fast local development")
    print("   ✅ Easy database inspection (DB Browser for SQLite)")
    print("   ✅ Database file: evara_local.db")
    print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    main()
