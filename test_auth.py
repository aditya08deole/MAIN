"""
🔧 EVARA AUTH DIAGNOSTIC TOOL
Run this script to test if your JWT secret is correct
"""
import os
import sys
from jose import jwt, JWTError
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test JWT secret
JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Example JWT token from Supabase (you'll get this from browser localStorage)
# To get your token:
# 1. Open browser DevTools (F12)
# 2. Application tab → Local Storage → your frontend URL
# 3. Look for key: sb-{project-id}-auth-token
# 4. Copy the "access_token" value
TEST_TOKEN = input("Paste your JWT token from browser localStorage:\n").strip()

print("\n" + "="*60)
print("🔍 EVARA JWT DIAGNOSTIC REPORT")
print("="*60)

# Check 1: JWT Secret exists
print("\n1️⃣ JWT Secret Configuration:")
if JWT_SECRET:
    print(f"✅ JWT secret is set")
    print(f"   Length: {len(JWT_SECRET)} characters")
    print(f"   Preview: {JWT_SECRET[:8]}...{JWT_SECRET[-8:]}")
else:
    print("❌ JWT secret is NOT set in .env file!")
    print("   Add this line to your .env:")
    print("   SUPABASE_JWT_SECRET=your-secret-from-supabase")
    sys.exit(1)

# Check 2: Token format
print("\n2️⃣ JWT Token Format:")
if not TEST_TOKEN:
    print("❌ No token provided!")
    sys.exit(1)

if TEST_TOKEN.count('.') != 2:
    print("❌ Invalid JWT format! Expected 3 parts separated by dots.")
    print(f"   Your token has {TEST_TOKEN.count('.')+1} parts")
    sys.exit(1)
else:
    print("✅ Token format looks correct (3 parts)")

# Check 3: Decode without verification (to see payload)
print("\n3️⃣ Token Payload (decoded without verification):")
try:
    payload = jwt.get_unverified_claims(TEST_TOKEN)
    print("✅ Token decoded successfully")
    print(f"   User ID: {payload.get('sub', 'N/A')}")
    print(f"   Email: {payload.get('email', 'N/A')}")
    print(f"   Role: {payload.get('role', 'N/A')}")
    print(f"   Issuer: {payload.get('iss', 'N/A')}")
except Exception as e:
    print(f"❌ Failed to decode token: {e}")
    sys.exit(1)

# Check 4: Verify with your JWT secret
print("\n4️⃣ JWT Verification with Your Secret:")
try:
    verified_payload = jwt.decode(
        TEST_TOKEN,
        JWT_SECRET,
        algorithms=["HS256"],
        options={"verify_aud": False}  # Supabase doesn't use aud claim
    )
    print("✅✅✅ SUCCESS! JWT verification PASSED!")
    print("   Your JWT secret is CORRECT!")
    print("   Backend will accept this token ✅")
    
    print("\n📋 Verified User Info:")
    print(f"   User ID: {verified_payload.get('sub')}")
    print(f"   Email: {verified_payload.get('email')}")
    print(f"   Role: {verified_payload.get('role')}")
    
except JWTError as e:
    print(f"❌❌❌ VERIFICATION FAILED!")
    print(f"   Error: {e}")
    print("\n💡 This means:")
    print("   → Your JWT secret doesn't match the one Supabase uses")
    print("   → Backend will return 401 errors")
    print("\n🔧 Fix:")
    print("   1. Go to Supabase Dashboard → Settings → API")
    print("   2. Copy the JWT Secret (NOT the anon key!)")
    print("   3. Update SUPABASE_JWT_SECRET in .env file")
    print("   4. Update SUPABASE_JWT_SECRET in Render environment variables")
    sys.exit(1)

print("\n" + "="*60)
print("🎉 DIAGNOSIS COMPLETE - ALL CHECKS PASSED!")
print("="*60)
print("\n✅ Action Items:")
print("   1. Make sure this JWT secret is in Render:")
print(f"      SUPABASE_JWT_SECRET={JWT_SECRET[:8]}...{JWT_SECRET[-8:]}")
print("   2. Wait 2-3 minutes for Render to redeploy")
print("   3. Check /config-check endpoint shows all true")
print("   4. Refresh your frontend - 401 errors should be gone!")
print("\n💚 Your setup is correct! If still getting 401, check RLS policies.")
