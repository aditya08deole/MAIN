"""
Windows Firewall Troubleshooting for PostgreSQL connections.
Run this script as Administrator to add firewall rules.
"""
import subprocess
import sys
import socket

def is_admin():
    """Check if script is running with administrator privileges."""
    try:
        import ctypes
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def test_port(host, port, timeout=5):
    """Test if a port is accessible."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception as e:
        return False

def add_firewall_rule(port, name):
    """Add Windows Firewall rule to allow outbound connections."""
    if not is_admin():
        print(f"❌ Administrator privileges required to add firewall rules!")
        return False
    
    try:
        # Remove existing rule if present
        subprocess.run(
            f'netsh advfirewall firewall delete rule name="{name}"',
            shell=True,
            capture_output=True
        )
        
        # Add new outbound rule
        cmd = f'netsh advfirewall firewall add rule name="{name}" dir=out action=allow protocol=TCP remoteport={port}'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Added firewall rule for port {port}")
            return True
        else:
            print(f"❌ Failed to add firewall rule: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def check_firewall_rules():
    """Check existing firewall rules for PostgreSQL ports."""
    try:
        result = subprocess.run(
            'netsh advfirewall firewall show rule name=all | findstr /i "postgres"',
            shell=True,
            capture_output=True,
            text=True
        )
        return result.stdout
    except:
        return ""

def main():
    print("\n" + "="*70)
    print("🔥 WINDOWS FIREWALL TROUBLESHOOTER FOR SUPABASE")
    print("="*70)
    
    # Check admin status
    if is_admin():
        print("✅ Running with Administrator privileges")
    else:
        print("⚠️  Running without Administrator privileges")
        print("   Some features require admin (firewall rule creation)")
    
    print("\n" + "="*70)
    print("📡 TESTING SUPABASE CONNECTIVITY")
    print("="*70)
    
    # Test Supabase hosts and ports
    tests = [
        ("aws-0-ap-south-1.pooler.supabase.com", 6543, "Pooler Transaction Mode"),
        ("aws-0-ap-south-1.pooler.supabase.com", 5432, "Pooler Session Mode"),
        ("www.google.com", 80, "Internet Connectivity (Control)")
    ]
    
    results = []
    for host, port, description in tests:
        print(f"\n🔍 Testing {description}")
        print(f"   {host}:{port}... ", end="")
        
        accessible = test_port(host, port, timeout=5)
        results.append((description, accessible))
        
        if accessible:
            print("✅ ACCESSIBLE")
        else:
            print("❌ BLOCKED/TIMEOUT")
    
    # Analyze results
    print("\n" + "="*70)
    print("📊 DIAGNOSIS")
    print("="*70)
    
    internet_ok = results[-1][1]  # Google test
    postgres_ok = any(r[1] for r in results[:-1])  # Any postgres port
    
    if internet_ok and not postgres_ok:
        print("❌ FIREWALL OR ISP BLOCKING PostgreSQL PORTS")
        print("\n🔧 RECOMMENDED FIXES:")
        print("\n1. Add Windows Firewall Rules:")
        if is_admin():
            print("\n   [Will add automatically...]")
            add_firewall_rule(5432, "PostgreSQL_Supabase_5432")
            add_firewall_rule(6543, "PostgreSQL_Supabase_6543")
        else:
            print("\n   Run this script as Administrator:")
            print("   Right-click → Run as Administrator")
            print("\n   Or manually add rules:")
            print("   netsh advfirewall firewall add rule name=\"PostgreSQL_Supabase_5432\" dir=out action=allow protocol=TCP remoteport=5432")
            print("   netsh advfirewall firewall add rule name=\"PostgreSQL_Supabase_6543\" dir=out action=allow protocol=TCP remoteport=6543")
        
        print("\n2. Check antivirus software:")
        print("   - Disable temporarily to test")
        print("   - Add python.exe to whitelist")
        
        print("\n3. Check corporate/ISP firewall:")
        print("   - Some networks block database ports")
        print("   - Try using mobile hotspot")
        
        print("\n4. Use SQLite for local development:")
        print("   - Run: python switch_database.py")
        print("   - Select option 1 (SQLite)")
        
    elif not internet_ok:
        print("❌ NO INTERNET CONNECTION")
        print("   Check your network connection first!")
        
    elif postgres_ok:
        print("✅ POSTGRESQL PORTS ARE ACCESSIBLE!")
        print("   The network connectivity issue might be:")
        print("   - DNS resolution")
        print("   - Supabase project paused")
        print("   - Authentication issues")
        print("\n   Try running: python test_connection.py")
    
    # Show existing firewall rules
    print("\n" + "="*70)
    print("🔍 CHECKING EXISTING FIREWALL RULES")
    print("="*70)
    rules = check_firewall_rules()
    if rules:
        print(rules)
    else:
        print("No PostgreSQL-related rules found")
    
    print("\n" + "="*70)
    print("💡 NEXT STEPS")
    print("="*70)
    print("\n1. If firewall rules were added, restart your terminal")
    print("2. Run: python test_all_connections.py")
    print("3. If still failing, use SQLite: python switch_database.py")
    print("4. For production, deploy to Render (no firewall issues)")
    print("\n" + "="*70 + "\n")

if __name__ == "__main__":
    main()
    
    if not is_admin():
        print("\n💡 TIP: Run as Administrator to automatically fix firewall rules!")
        print("   Right-click this file → Run as Administrator")
