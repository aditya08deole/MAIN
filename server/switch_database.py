"""
Switch between local SQLite and production Supabase databases.
"""
import shutil
import os

def switch_to_sqlite():
    """Switch to local SQLite database."""
    if os.path.exists('.env.local'):
        shutil.copy('.env.local', '.env')
        print("✅ Switched to LOCAL SQLite database")
        print("   Database: evara_local.db")
        print("   No network required!")
        print("\n   Run: python -m uvicorn main:app --reload")
    else:
        print("❌ .env.local not found!")
        print("   Create it with:")
        print('   DATABASE_URL="sqlite+aiosqlite:///./evara_local.db"')

def switch_to_supabase():
    """Switch to production Supabase database."""
    if os.path.exists('.env.supabase'):
        shutil.copy('.env.supabase', '.env')
        print("✅ Switched to PRODUCTION Supabase database")
        print("   Database: Supabase PostgreSQL (requires network)")
        print("\n   Run: python -m uvicorn main:app --reload")
    else:
        # Backup current .env as .env.supabase if it has supabase
        if os.path.exists('.env'):
            with open('.env', 'r') as f:
                if 'supabase' in f.read().lower():
                    shutil.copy('.env', '.env.supabase')
                    print("✅ Backed up current .env as .env.supabase")
        print("✅ Already using Supabase configuration")

def show_status():
    """Show current database configuration."""
    if not os.path.exists('.env'):
        print("❌ No .env file found!")
        return
    
    with open('.env', 'r') as f:
        content = f.read()
        
    if 'sqlite' in content.lower():
        print("📊 Current Database: SQLite (Local)")
        print("   - No network required")
        print("   - Perfect for testing")
        print("   - Data stored in evara_local.db")
    elif 'supabase' in content.lower() or 'postgres' in content.lower():
        print("📊 Current Database: Supabase (Production)")
        print("   - Requires network connection")
        print("   - Shared production data")
        print("   - May have connection issues locally")
    else:
        print("❓ Unknown database configuration")

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🔄 DATABASE SWITCHER")
    print("="*70)
    
    show_status()
    
    print("\n" + "="*70)
    print("Options:")
    print("  1 - Switch to SQLite (local, no network)")
    print("  2 - Switch to Supabase (production)")
    print("  3 - Show current status")
    print("  q - Quit")
    print("="*70)
    
    choice = input("\nEnter choice: ").strip()
    
    if choice == '1':
        switch_to_sqlite()
    elif choice == '2':
        switch_to_supabase()
    elif choice == '3':
        show_status()
    elif choice.lower() == 'q':
        print("Goodbye!")
    else:
        print("Invalid choice!")
