# 🚀 DEPLOY TO RENDER - STEP BY STEP

## ✅ Your JWT Secret is Ready!

```
fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A==
```

---

## 📋 COMPLETE ENVIRONMENT VARIABLE LIST

Copy these EXACT values to Render:

### 1. DATABASE_URL
```
postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```

### 2. SUPABASE_URL
```
https://tihrvotigvaozizlcxse.supabase.co
```

### 3. SUPABASE_JWT_SECRET ⚠️ CRITICAL
```
fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A==
```

### 4. SUPABASE_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHJ2b3RpZ3Zhb3ppemxjeHNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwOTUyNywiZXhwIjoyMDg2ODg1NTI3fQ.zTcjoRCoo8AQHd0X8CFGuHh-WUHwXPDfeQeQKts3JJI
```

### 5. CORS_ORIGINS
```
http://localhost:5173,https://your-frontend-url.onrender.com
```
*(Replace with your actual frontend URL)*

### 6. ENVIRONMENT
```
production
```

### 7. PROJECT_NAME
```
EvaraTech Backend - Seoul
```

---

## 🎯 STEP-BY-STEP GUIDE

### Step 1: Go to Render Dashboard

1. Open: https://dashboard.render.com
2. Find your **backend service**
3. Click on it

### Step 2: Add Environment Variables

1. Click **"Environment"** tab (left sidebar)
2. For each variable above, click **"Add Environment Variable"**
3. Copy the **exact** key name and value
4. **Important:** No quotes, no extra spaces!

### Step 3: Save and Deploy

1. Click **"Save Changes"** at the bottom
2. Render will automatically redeploy (you'll see the logs)
3. Wait 2-3 minutes for deployment to complete

### Step 4: Verify Config

After deployment completes, open in your browser:

```
https://your-backend-url.onrender.com/config-check
```

**Expected Result:**
```json
{
  "database_url": true,
  "supabase_url": true,
  "supabase_jwt_secret": true,  ← MUST be true!
  "supabase_key": true,
  "cors_origins": true
}
```

✅ If all are `true`, you're ready!

### Step 5: Test Your Frontend

1. Go to your frontend URL
2. Try to log in
3. The "Unable to fetch nodes: 401" error should be **GONE**!

---

## 🔧 TROUBLESHOOTING

### Still Getting 401?

**Check 1: JWT Secret in Render**
- Go to Render → Environment tab
- Find `SUPABASE_JWT_SECRET`
- Make sure it matches EXACTLY:
  ```
  fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A==
  ```
- No quotes, no spaces!

**Check 2: Render Logs**
- Render Dashboard → Your service → **Logs** tab
- Look for errors related to JWT or authentication

**Check 3: RLS Policies**
If config-check shows all true but still 401:
- Go to Supabase SQL Editor
- Run the RLS policy fixes from `CRITICAL_FIX_JWT_SECRET.md`

---

## 🎉 SUCCESS CHECKLIST

- [ ] All 7 environment variables added to Render
- [ ] Render redeployed successfully (no errors in logs)
- [ ] `/config-check` shows all `true`
- [ ] Frontend loads without 401 errors
- [ ] Dashboard displays node data
- [ ] DB status shows "ok"
- [ ] IoT Broker status shows "ok"

---

## 📞 NEED HELP?

If still not working after following all steps:

1. Share screenshot of `/config-check` output
2. Share browser console errors (F12 → Console)
3. Share Render deployment logs (last 50 lines)

---

## 💡 UNDERSTANDING WHY THIS FIXES 401

**Before (401 error):**
```
Frontend sends JWT → Backend tries to verify with ??? → FAIL → 401
```

**After (working):**
```
Frontend sends JWT → Backend verifies with correct secret → SUCCESS → 200
```

The JWT secret is like a password that both Supabase and your backend must know. If they don't match, authentication fails!

---

## 🚀 YOU'RE ALMOST THERE!

Just add those environment variables to Render and your app will work perfectly!

The hard part is done - your code is correct, database is set up, everything is ready.

You just need to tell Render the secrets so it can verify user tokens.

**Let's do this! 💪**
