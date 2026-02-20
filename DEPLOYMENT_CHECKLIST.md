# ✅ SUPABASE + RENDER DEPLOYMENT CHECKLIST

## 🎯 Complete Setup Guide

Your backend is now configured for **Seoul-region Supabase** with the correct credentials.

---

## STEP 1: Verify Local Supabase Connection ✅

**Run this test first:**

```bash
cd server
python verify_supabase.py
```

**Expected Output:**
```
✅ CONNECTED successfully in 0.5s!
✅ SELECT 1 = 1
✅ PostgreSQL: PostgreSQL 15.x...
✅ Can create tables
✅ Can insert data
✅ Can read data
✅ ALL TESTS PASSED!
```

**If it fails:**
- Check internet connection
- Verify Supabase project is not paused
- Confirm password: `Wgj7DFMIn8TQwUXU`
- Check firewall (run as Administrator if needed)

---

## STEP 2: Update Render Environment Variables ✅

### Go to Render Dashboard

1. **Open**: https://dashboard.render.com
2. **Select**: Your backend service
3. **Click**: "Environment" tab

### Update DATABASE_URL

**Find** the `DATABASE_URL` variable

**Replace** with this EXACT string (no quotes, single line):

```
postgresql://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```

**Important Rules:**
- ❌ No quotes around the URL
- ❌ No spaces
- ❌ No line breaks
- ✅ One single line
- ✅ Include `?sslmode=require` at the end

### Verify Other Environment Variables

Make sure these are also set:

```
SUPABASE_URL=https://tihrvotigvaozizlcxse.supabase.co
SUPABASE_JWT_SECRET=fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A==
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHJ2b3RpZ3Zhb3ppemxjeHNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwOTUyNywiZXhwIjoyMDg2ODg1NTI3fQ.zTcjoRCoo8AQHd0X8CFGuHh-WUHwXPDfeQeQKts3JJI
CORS_ORIGINS=http://localhost:5173,https://your-frontend.onrender.com
ENVIRONMENT=production
```

### Save & Deploy

1. **Click**: "Save Changes" button
2. **Wait**: Render will automatically start deploying
3. **Monitor**: Watch the deployment logs

---

## STEP 3: Monitor Deployment ✅

### Watch Logs

In Render dashboard, **Logs** tab should show:

```
[OK] Using Supabase connection pooler (port 6543)
[OK] Region: Seoul (ap-northeast-2)
[OK] Database tables initialized
[OK] Database connection verified
[OK] Connection pool: size=5, checked_out=0
[OK] ThingSpeak client initialized
✅ STARTUP SUCCESSFUL
```

### Expected Deploy Time

- ⏱️ Build: 1-2 minutes
- ⏱️ Deploy: 30 seconds
- ⏱️ Total: ~2-3 minutes

---

## STEP 4: Test Deployed Backend ✅

### Method 1: Automated Test Script

```bash
python server/verify_render.py
```

Enter your Render URL when prompted.

### Method 2: Manual Browser Tests

**Replace** `your-backend` with your actual Render service name:

#### 1. Health Check
```
https://your-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2026-02-20T..."
}
```

✅ **KEY INDICATOR**: `"database": "ok"` means success!

#### 2. Root Endpoint
```
https://your-backend.onrender.com/
```

**Expected Response:**
```json
{
  "message": "EvaraTech Backend API",
  "version": "1.0.0",
  "environment": "production",
  "docs": "/docs",
  "health": "/health"
}
```

#### 3. API Documentation
```
https://your-backend.onrender.com/docs
```

Should show interactive Swagger UI

#### 4. OpenAPI Schema
```
https://your-backend.onrender.com/openapi.json
```

Should return JSON schema

---

## STEP 5: Test Database Operations ✅

### Access API Docs

Open: `https://your-backend.onrender.com/docs`

### Test 1: Auth Sync (POST /auth/sync)

**Click** "Try it out"

**Request body:**
```json
{
  "id": "test-user-123",
  "email": "test@example.com",
  "display_name": "Test User",
  "role": "user"
}
```

**Click** "Execute"

**Expected**: Status 200, user created

### Test 2: List Devices (GET /devices)

**Click** "Try it out" → "Execute"

**Expected**: Empty array `[]` (no devices yet)

### Test 3: Create Device (POST /devices)

**Request body:**
```json
{
  "node_key": "TEST001",
  "label": "Test Device",
  "category": "Tank",
  "thingspeak_channel_id": "123456"
}
```

**Expected**: Status 201, device created

### Test 4: Verify in Supabase

1. Go to: https://supabase.com/dashboard
2. Open your project
3. Click: "Table Editor"
4. Check: `users` and `devices` tables
5. **Confirm**: Data appears!

---

## STEP 6: Final Verification ✅

### Checklist

- [ ] ✅ Local connection test passes (`verify_supabase.py`)
- [ ] ✅ Render environment variables updated
- [ ] ✅ Deployment succeeded (no errors in logs)
- [ ] ✅ Health endpoint returns `"database": "ok"`
- [ ] ✅ API docs accessible at `/docs`
- [ ] ✅ Can create users via `/auth/sync`
- [ ] ✅ Can create devices via `/devices`
- [ ] ✅ Data appears in Supabase dashboard

---

## 🔧 Troubleshooting

### Issue: "Network is unreachable"

**Check:**
1. DATABASE_URL in Render matches exactly (no typos)
2. No quotes around DATABASE_URL value
3. Includes `?sslmode=require` at the end
4. Supabase project is not paused

**Fix:**
- Update DATABASE_URL in Render
- Redeploy
- Wait 2-3 minutes
- Test again

### Issue: "Invalid password"

**Check:**
1. Password in DATABASE_URL: `Wgj7DFMIn8TQwUXU`
2. No URL encoding issues

**Fix:**
- Go to Supabase → Settings → Database
- Reset password if needed
- Update in Render
- Redeploy

### Issue: "Connection timeout"

**Check:**
1. Using port 6543 (not 5432)
2. Using pooler URL: `aws-1-ap-northeast-2.pooler.supabase.com`
3. SSL mode is `require`

**Fix:**
- Verify complete connection string
- Check Supabase project status
- Wait for Supabase to wake up (if paused)

### Issue: Deployment fails

**Check Logs:**
- Look for Python errors
- Check if requirements.txt has all dependencies
- Verify Dockerfile is correct

**Fix:**
- Check Render logs for specific error
- Ensure all required environment variables are set
- Try manual deploy from Render dashboard

---

## 📋 Connection String Reference

### For Render (PostgreSQL standard format):
```
postgresql://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```

### For our code (asyncpg format, SSL in code):
```
postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:Wgj7DFMIn8TQwUXU@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
```

**Note**: Our code removes `?sslmode=require` and configures SSL in Python, so either format works!

---

## 🎯 Success Criteria

Your deployment is successful when:

1. ✅ `python verify_supabase.py` shows "ALL TESTS PASSED"
2. ✅ Render deployment logs show "STARTUP SUCCESSFUL"
3. ✅ `/health` endpoint returns `"database": "ok"`
4. ✅ Can create records via API
5. ✅ Data appears in Supabase dashboard

---

## 🚀 Next Steps After Success

1. **Connect Frontend**: Update frontend API URL to your Render backend
2. **Test Full Flow**: Login → Create devices → View data
3. **Monitor**: Check Render metrics for performance
4. **Scale**: Adjust connection pool if needed

---

## 📞 Quick Commands

```bash
# Test local Supabase connection
python server/verify_supabase.py

# Test deployed Render backend
python server/verify_render.py

# Check what's configured locally
cat server/.env | grep DATABASE_URL

# View Render logs (if you have Render CLI)
render logs -t <service-name>
```

---

**Status**: ✅ **Configuration Complete**  
**Next**: Run verification scripts → Deploy to Render → Test! 🚀
