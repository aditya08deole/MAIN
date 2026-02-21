# 🚨 CRITICAL FIX: JWT Secret Configuration

## THE PROBLEM
Your backend returns **401 Unauthorized** because it cannot verify the JWT tokens sent by the frontend.

## WHY THIS HAPPENS
1. Frontend uses Supabase Auth → generates JWT signed with Supabase's secret
2. Backend tries to verify JWT → needs the EXACT same secret
3. If secrets don't match → JWT verification fails → 401 error

---

## 🔧 STEP-BY-STEP FIX

### 1️⃣ **Get Your JWT Secret from Supabase**

Go to: **Supabase Dashboard → Project Settings → API**

```
Project: tihrvotigvaozizlcxse (Seoul region)
URL: https://supabase.com/dashboard/project/tihrvotigvaozizlcxse/settings/api
```

**Look for:**
```
JWT Settings
├── JWT Secret: [COPY THIS EXACT STRING]
└── This is NOT the same as your anon key!
```

**Example format (yours will be different):**
```
your-jwt-secret-looks-like-this-32-char-string
```

---

### 2️⃣ **Add JWT Secret to Render Environment Variables**

**Go to Render Dashboard:**
```
https://dashboard.render.com
→ Select your backend service
→ Environment tab
```

**Add this variable:**
```
Key:   SUPABASE_JWT_SECRET
Value: [paste the JWT secret from Supabase]
```

⚠️ **IMPORTANT:** Make sure there are NO extra spaces or quotes!

---

### 3️⃣ **Verify All Environment Variables**

Your backend needs **7 environment variables**. Check them all:

```bash
# Backend service on Render
DATABASE_URL=postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require

SUPABASE_URL=https://tihrvotigvaozizlcxse.supabase.co

SUPABASE_JWT_SECRET=your-actual-jwt-secret-from-supabase  # ← CRITICAL!

SUPABASE_KEY=your-anon-key-here

CORS_ORIGINS=https://your-frontend.onrender.com

ENVIRONMENT=production

PROJECT_NAME=Evara Tech - Seoul
```

---

### 4️⃣ **Test the Fix**

**After adding the JWT secret, Render will auto-deploy (2-3 minutes).**

**Then test:**

1. **Visit config-check:**
   ```
   https://your-backend.onrender.com/config-check
   ```
   
   **Should show:**
   ```json
   {
     "database_url": true,
     "supabase_url": true,
     "supabase_jwt_secret": true,  ← Must be TRUE now!
     "supabase_key": true,
     "cors_origins": true
   }
   ```

2. **Refresh your frontend dashboard**
   - The "Unable to fetch nodes: 401" error should disappear
   - Dashboard should load successfully

---

## 🔍 COMMON MISTAKES TO AVOID

### ❌ **Wrong Secret Used**
```
# DON'T use the anon key as JWT secret!
SUPABASE_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # ← This is anon key!
```

### ✅ **Correct JWT Secret**
```
# Use the actual JWT secret from Supabase settings
SUPABASE_JWT_SECRET=your-32-character-secret-string  # ← This is correct!
```

---

### ❌ **Extra Spaces/Quotes**
```
SUPABASE_JWT_SECRET= your-secret   # ← Space before secret = FAIL
SUPABASE_JWT_SECRET="your-secret"  # ← Quotes around secret = FAIL
```

### ✅ **Clean Value**
```
SUPABASE_JWT_SECRET=your-secret  # ← No spaces, no quotes = CORRECT
```

---

## 🧪 HOW TO VERIFY IT WORKS

### **Test 1: Health Check**
```bash
curl https://your-backend.onrender.com/health
```
**Expected:**
```json
{
  "status": "ok",
  "services": {
    "database": "ok",
    "thingspeak": "ok"
  }
}
```

### **Test 2: Config Check**
```bash
curl https://your-backend.onrender.com/config-check
```
**Expected:**
```json
{
  "database_url": true,
  "supabase_url": true,
  "supabase_jwt_secret": true,  ← KEY CHECK
  "supabase_key": true,
  "cors_origins": true
}
```

### **Test 3: Frontend Dashboard**
1. Open your frontend URL
2. Log in with your Supabase credentials
3. Dashboard should load **without 401 errors**

---

## 🚨 IF STILL GETTING 401 AFTER FIXING JWT SECRET

This means **RLS (Row Level Security) policies** are blocking you. Here's the fix:

### **Go to Supabase SQL Editor:**
```
https://supabase.com/dashboard/project/tihrvotigvaozizlcxse/sql/new
```

### **Run this SQL to fix RLS policies:**

```sql
-- Enable RLS (if not already enabled)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_channels ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all devices
CREATE POLICY "Allow authenticated users to read devices"
ON devices FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert devices
CREATE POLICY "Allow authenticated users to insert devices"
ON devices FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update devices they created or have access to
CREATE POLICY "Allow authenticated users to update devices"
ON devices FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete devices
CREATE POLICY "Allow authenticated users to delete devices"
ON devices FOR DELETE
TO authenticated
USING (true);

-- Allow authenticated users to read device_channels
CREATE POLICY "Allow authenticated users to read device_channels"
ON device_channels FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert device_channels
CREATE POLICY "Allow authenticated users to insert device_channels"
ON device_channels FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to delete device_channels
CREATE POLICY "Allow authenticated users to delete device_channels"
ON device_channels FOR DELETE
TO authenticated
USING (true);
```

**After running this SQL:**
- Refresh your frontend
- 401 errors should be completely resolved

---

## 📊 DEBUGGING CHECKLIST

- [ ] JWT secret copied from Supabase dashboard (NOT anon key)
- [ ] JWT secret added to Render environment variables
- [ ] No extra spaces or quotes in the JWT secret value
- [ ] Render backend redeployed (auto-happens after env var change)
- [ ] `/config-check` shows `supabase_jwt_secret: true`
- [ ] RLS policies enabled for devices and device_channels tables
- [ ] Frontend refreshed after backend deployment completes

---

## 🎯 EXPECTED RESULT

**Before fix:**
```
❌ Unable to fetch nodes: Request failed with status code 401
❌ DB: Unknown
❌ IoT Broker: Unknown
```

**After fix:**
```
✅ Dashboard loads successfully
✅ DB: ok
✅ IoT Broker: ok
✅ Nodes list populated
✅ No 401 errors in console
```

---

## 💡 UNDERSTANDING THE ARCHITECTURE

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│  Frontend   │  JWT    │   Backend    │  Pool   │   Supabase   │
│  (React)    │────────▶│  (FastAPI)   │────────▶│  (Database)  │
└─────────────┘  Token  └──────────────┘  Query  └──────────────┘
      │                         │
      │                         │
      │ JWT signed with         │ Verifies JWT using
      │ Supabase secret         │ SUPABASE_JWT_SECRET
      │                         │
      └─────────────────────────┘
        MUST MATCH EXACTLY! ←────── This is why 401 happens
```

**Key insight:**
- Frontend gets JWT from Supabase Auth (signed by Supabase)
- Backend must use the SAME secret to verify the JWT
- If secrets don't match → JWT verification fails → 401

---

## 🆘 STILL NOT WORKING?

**Share this info:**
1. Output from `/config-check` endpoint
2. Browser console errors (press F12 → Console tab)
3. Screenshot of Render environment variables (hide the values!)

**Pro tip:** Check Render logs for backend errors:
```
Render Dashboard → Your backend service → Logs tab
Look for JWT or authentication errors
```
