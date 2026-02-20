"""
RENDER DEPLOYMENT VERIFICATION
Checks if your deployed backend on Render is working correctly.
"""
import urllib.request
import json
import time
import sys

def test_url(url, description, expected_status=200):
    """Test a URL and return results."""
    print(f"\n🔍 Testing: {description}")
    print(f"   URL: {url}")
    
    try:
        start_time = time.time()
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=15)
        elapsed = round((time.time() - start_time) * 1000, 2)
        
        if response.status == expected_status:
            print(f"   ✅ Status: {response.status} ({elapsed}ms)")
            
            # Try to parse JSON
            try:
                data = json.loads(response.read().decode('utf-8'))
                print(f"   📄 Response:")
                print(f"      {json.dumps(data, indent=6)}")
                return True, data
            except:
                content = response.read().decode('utf-8')[:200]
                print(f"   📄 Response: {content}")
                return True, None
        else:
            print(f"   ⚠️  Unexpected status: {response.status}")
            return False, None
            
    except urllib.error.HTTPError as e:
        print(f"   ❌ HTTP Error {e.code}: {e.reason}")
        try:
            error_content = e.read().decode('utf-8')
            print(f"   Error details: {error_content[:200]}")
        except:
            pass
        return False, None
        
    except urllib.error.URLError as e:
        print(f"   ❌ Connection failed: {e.reason}")
        return False, None
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return False, None

def main():
    print("\n" + "="*80)
    print("🚀 RENDER DEPLOYMENT VERIFICATION")
    print("="*80)
    
    # Get backend URL from user
    backend_url = input("\n📝 Enter your Render backend URL (e.g., https://your-backend.onrender.com): ").strip()
    
    if not backend_url:
        print("❌ No URL provided!")
        return
    
    # Remove trailing slash
    backend_url = backend_url.rstrip('/')
    
    # Validate URL
    if not backend_url.startswith('http'):
        backend_url = 'https://' + backend_url
    
    print(f"\n🔍 Testing backend: {backend_url}")
    print("-"*80)
    
    results = []
    
    # Test 1: Root endpoint
    success, data = test_url(f"{backend_url}/", "Root Endpoint")
    results.append(("Root Endpoint", success))
    
    # Test 2: Health endpoint
    success, data = test_url(f"{backend_url}/health", "Health Check")
    results.append(("Health Check", success))
    
    if success and data:
        # Check database status
        print("\n   🔍 Checking database status...")
        if data.get('status') == 'ok':
            print("   ✅ Overall status: OK")
        else:
            print(f"   ⚠️  Overall status: {data.get('status')}")
        
        if data.get('database') == 'ok':
            print("   ✅ Database: WORKING!")
        else:
            print(f"   ❌ Database: {data.get('database')}")
            print("\n   🔧 Database not connected. Check:")
            print("      1. DATABASE_URL in Render environment matches:")
            print("         postgresql://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require")
            print("      2. No extra quotes or spaces")
            print("      3. Redeploy after changing environment variables")
    
    # Test 3: API Docs
    success, data = test_url(f"{backend_url}/docs", "API Documentation")
    results.append(("API Documentation", success))
    
    # Test 4: OpenAPI schema
    success, data = test_url(f"{backend_url}/openapi.json", "OpenAPI Schema")
    results.append(("OpenAPI Schema", success))
    
    # Summary
    print("\n" + "="*80)
    print("📊 TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
    
    print("-"*80)
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        print("Your backend is deployed and working correctly!")
        print("\n📚 Available Endpoints:")
        print(f"   • API Docs: {backend_url}/docs")
        print(f"   • Health Check: {backend_url}/health")
        print(f"   • Root Info: {backend_url}/")
    else:
        print("\n⚠️  SOME TESTS FAILED")
        print("Check the errors above and fix them.")
        if passed == 0:
            print("\n🔧 Common deployment issues:")
            print("   1. Service is still deploying (wait 2-3 minutes)")
            print("   2. Service crashed on startup (check Render logs)")
            print("   3. Wrong URL (verify in Render dashboard)")
    
    print("\n" + "="*80)
    
    # Additional verification URLs
    print("\n🔗 ADDITIONAL VERIFICATION LINKS:")
    print(f"   1. Health Check (JSON): {backend_url}/health")
    print(f"   2. API Documentation: {backend_url}/docs")
    print(f"   3. ReDoc: {backend_url}/redoc")
    print(f"   4. OpenAPI Schema: {backend_url}/openapi.json")
    print("\n📖 Render Dashboard:")
    print("   • Logs: Check for startup errors")
    print("   • Metrics: Check if service is running")
    print("   • Environment: Verify DATABASE_URL is set correctly")
    print("\n" + "="*80 + "\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Verification cancelled by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
