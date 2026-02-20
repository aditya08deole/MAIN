# 🔧 Render Environment Variables Setup

## ⚠️ CRITICAL: Your backend needs these environment variables in Render

The 401 error is happening because **Render doesn't have your environment variables**.

Your local `.env` file is NOT uploaded to Render (it's in `.gitignore`).

---

## 📋 Required Environment Variables for Render

Go to your Render dashboard:
1. Select your backend service
2. Go to **Environment** tab
3. Add these variables:

### Database

```
DATABASE_URL
postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
```

### Supabase Authentication (CRITICAL!)

```
SUPABASE_URL
https://tihrvotigvaozizlcxse.supabase.co
```

```
SUPABASE_JWT_SECRET
fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A==
```

```
SUPABASE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHJ2b3RpZ3Zhb3ppemxjeHNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwOTUyNywiZXhwIjoyMDg2ODg1NTI3fQ.zTcjoRCoo8AQHd0X8CFGuHh-WUHwXPDfeQeQKts3JJI
```

### CORS

```
CORS_ORIGINS
http://localhost:5173,https://evara-dashboard.onrender.com
```

(Add your actual frontend URL)

### Environment

```
ENVIRONMENT
production
```

```
PROJECT_NAME
EvaraTech Backend
```

---

## 🚨 Most Important Variable

**`SUPABASE_JWT_SECRET`** is CRITICAL!

Without this, backend cannot verify JWT tokens from Supabase.
Result: Every request returns 401.

---

## ✅ After Adding Variables

1. Click **Save Changes** in Render
2. Render will automatically redeploy
3. Wait 2-3 minutes
4. Test your frontend again

---

## 🔍 How to Verify It's Fixed

### Test 1: Health Check (No Auth Required)
```
https://your-backend.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "database": "ok",
  "services": {
    "database": "ok",
    "thingspeak": "ok"
  }
}
```

### Test 2: Protected Endpoint (After Login)

1. Login to your frontend using Supabase
2. Open browser DevTools → Network tab
3. Try to load nodes/devices
4. Check the request - should have `Authorization: Bearer ...` header
5. Should return 200 (not 401)

---

## 🎯 Why This Happens

Your `.env` file is gitignored (security best practice).
Render only knows about variables you manually configure.

Without `SUPABASE_JWT_SECRET`:
- Backend cannot verify Supabase tokens
- All protected endpoints return 401
- Frontend shows "Unable to fetch nodes"

---

## 📞 Next Steps

1. Add all variables to Render (especially JWT_SECRET)
2. Wait for redeploy
3. Login to frontend
4. Try again

Your backend code is correct. You just need to configure Render properly.
