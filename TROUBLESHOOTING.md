# 🔧 Troubleshooting Guide - EvaraTech Platform

## Common Issues and Solutions

### 1. ❌ 404 Error: "Unable to fetch some nodes"

#### Symptoms
- Frontend shows repeated error: "Unable to fetch some nodes: Request failed with status code 404"
- All Nodes page shows "0 of 0 nodes"

#### Possible Causes & Solutions

**A. Backend Not Running**
```bash
# Check if backend is running
curl http://localhost:8000/health

# If connection refused, start backend:
cd server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**B. Wrong API URL**
```bash
# Check frontend .env file
cat client/.env

# Should contain:
VITE_API_URL=http://localhost:8000/api/v1

# If wrong or missing, fix it and restart frontend:
cd client
npm run dev
```

**C. Authentication Failure**
```bash
# Test with dev bypass token
curl -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
     http://localhost:8000/api/v1/nodes/

# If 401 Unauthorized:
# - Check SUPABASE_JWT_SECRET in backend .env
# - Check browser localStorage for auth tokens
```

**D. Database Connection Issue**
```bash
# Run health check
cd server
python health_check.py

# Look for database connection errors
# Fix DATABASE_URL in server/.env
```

**E. CORS Error**
```bash
# Check browser console for CORS errors
# Update BACKEND_CORS_ORIGINS in server/.env:
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

---

### 2. ❌ "Cannot read properties of undefined (reading 'database')"

#### Symptoms
- React error in browser console
- Page crashes when trying to access certain features

#### Solution
✅ **FIXED** - Updated SystemHealth interface in `client/src/hooks/useDashboard.ts`

If still occurring:
```bash
# Clear browser cache
# Restart frontend
cd client
rm -rf node_modules/.vite
npm run dev
```

---

### 3. ❌ Database Connection Timeout

#### Symptoms
- Backend logs: "DATABASE CONNECTION TIMEOUT"
- Health check fails

#### Solutions

**A. Check Supabase Credentials**
```bash
# Verify DATABASE_URL format
# Should be:
postgresql+asyncpg://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

# Get correct URL from:
# Supabase Dashboard → Project Settings → Database → Connection String
```

**B. Check Network/Firewall**
```bash
# Test direct connection
psql "postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres"

# If fails, check:
# - Firewall rules
# - VPN connection
# - Internet connectivity
```

**C. Check Supabase Project Status**
```
Visit: https://status.supabase.com/
Check if there are any ongoing incidents
```

---

### 4. ❌ Tables Not Found

#### Symptoms
- Backend error: "relation 'nodes' does not exist"
- Empty database queries

#### Solutions

**A. Run Database Migration**
```sql
-- In Supabase SQL Editor, run:
-- File: server/migrations/001_backend_excellence.sql

-- Check tables exist:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should see: nodes, users_profiles, communities, etc.
```

**B. Check RLS Policies**
```sql
-- Check if RLS is blocking queries
-- Temporarily disable for testing:
ALTER TABLE nodes DISABLE ROW LEVEL SECURITY;

-- If this fixes it, the issue is with RLS policies
```

---

### 5. ❌ Frontend Build Failures

#### Symptoms
- `npm run build` fails
- TypeScript errors in console

#### Solutions

**A. Type Errors**
```bash
# Clear type cache
cd client
rm -rf node_modules
rm package-lock.json
npm install

# If still errors, check:
cat src/types/database.ts
# Ensure Database interface is complete
```

**B. Dependency Issues**
```bash
# Update dependencies
cd client
npm update
npm audit fix

# If conflicts:
npm install --legacy-peer-deps
```

---

### 6. ❌ WebSocket Connection Failed

#### Symptoms
- Console: "WS Closed. Retrying..."
- No real-time updates

#### Solutions

**A. Backend WebSocket Endpoint**
```bash
# Test WebSocket manually
wscat -c ws://localhost:8000/api/v1/ws/ws

# Should connect successfully
```

**B. Check Proxy Configuration**
```javascript
// In client/vite.config.ts
server: {
  proxy: {
    '/ws': {
      target: 'ws://localhost:8000',
      ws: true,
    }
  }
}
```

---

### 7. ❌ Import Errors in Backend

#### Symptoms
- Python: "ModuleNotFoundError"
- "Cannot import name 'X'"

### Solutions

**A. Missing Dependencies**
```bash
cd server
pip install -r requirements.txt

# For development dependencies:
pip install pytest httpx pytest-asyncio
```

**B. Circular Import**
```bash
# Check import order in files
# Move imports to function level if needed
```

**C. Wrong Python Environment**
```bash
# Activate virtual environment
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# Verify correct Python
which python  # Should point to venv
```

---

### 8. ❌ Supabase Auth Not Working

#### Symptoms
- Login fails
- Token verification errors

#### Solutions

**A. Check Supabase Auth Setup**
```sql
-- In Supabase, check users exist:
SELECT * FROM auth.users;

-- If no users:
-- 1. Go to Supabase → Authentication → Users
-- 2. Add users manually
-- 3. Set passwords
```

**B. Check JWT Configuration**
```bash
# In backend .env:
# SUPABASE_JWT_SECRET must match Supabase → Settings → API → JWT Secret

# Test token verification:
python
>>> from jose import jwt
>>> token = "your_token_here"
>>> jwt.decode(token, "your_secret", algorithms=["HS256"])
```

---

### 9. ❌ Deployment to Render Fails

#### Symptoms
- Build fails on Render
- Service won't start

#### Solutions

**A. Check render.yaml**
```yaml
# Ensure environment variables are set in Render Dashboard
# Check build command succeeds locally
```

**B. Check Logs**
```bash
# In Render Dashboard:
# → Select service
# → Logs tab
# Look for specific error messages
```

**C. Check Health Endpoint**
```bash
# After deployment:
curl https://your-backend.onrender.com/health

# Should return 200 OK with database status
```

---

### 10. ❌ High Memory Usage / Crashes

#### Symptoms
- Backend crashes after running for a while
- Memory leaks

#### Solutions

**A. Check Background Tasks**
```python
# In main.py, ensure cleanup runs:
# - Database connections are closed
# - AsyncIO tasks are cancelled properly
```

**B. Monitor Resources**
```bash
# Check memory usage
top -p $(pgrep -f uvicorn)

# Check database connections
# In Supabase → Database → Connections
```

**C. Adjust Pool Size**
```python
# In server/app/db/session.py
engine = create_async_engine(
    db_url,
    pool_size=10,      # Reduce if needed
    max_overflow=5,    # Reduce if needed
)
```

---

## 🚨 Emergency Checklist

If everything is broken:

1. **Reset Everything**
```bash
# Stop all processes
pkill -f uvicorn
pkill -f vite

# Clear caches
cd server
rm -rf __pycache__ app/__pycache__
rm -rf venv

cd ../client
rm -rf node_modules/.vite
rm -rf dist

# Reinstall
cd ../server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cd ../client
npm install
```

2. **Check All Environment Variables**
```bash
# Backend
cat server/.env
# Must have: DATABASE_URL, SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET

# Frontend
cat client/.env
# Must have: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

3. **Test Basic Connectivity**
```bash
# Database
psql $DATABASE_URL

# Supabase API
curl $SUPABASE_URL/rest/v1/

# Backend
curl http://localhost:8000/health
```

4. **Check Firewalls**
```bash
# Linux
sudo ufw status

# Windows
Get-NetFirewallRule | Where-Object {$_.Enabled -eq 'True'}
```

5. **Contact Support**
If still not working
- Check: https://github.com/your-repo/issues
- Discord: https://discord.gg/your-server
- Email: dev@evaratech.com

---

## 📊 Debugging Tools

### Backend
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Run with verbose output
uvicorn app.main:app --reload --log-level debug

# Test specific endpoint
curl -v http://localhost:8000/api/v1/nodes/
```

### Frontend
```javascript
// In browser console:
// Check API config
console.log(import.meta.env.VITE_API_URL)

// Check auth token
localStorage.getItem('evara_session')

// Test API manually
fetch('http://localhost:8000/api/v1/nodes/', {
  headers: {
    'Authorization': 'Bearer dev-bypass-ritik@evaratech.com'
  }
}).then(r => r.json()).then(console.log)
```

### Database
```sql
-- Check recent errors
SELECT * FROM pg_stat_activity;

-- Check locks
SELECT * FROM pg_locks;

-- Check slow queries
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;
```

---

## 💡 Prevention Tips

1. **Always run health check before deploying**
2. **Keep dependencies updated**
3. **Test locally before pushing**
4. **Monitor logs regularly**
5. **Set up alerts for errors**
6. **Document any custom configurations**
7. **Version your API properly**
8. **Keep backups of database**

---

## 📞 Getting Help

**Before asking for help, provide:**
1. Error message (full text)
2. Steps to reproduce
3. Environment (dev/prod, OS, versions)
4. Recent changes made
5. Logs (backend and browser console)
6. Health check output

**Useful commands to share:**
```bash
# System info
python --version
node --version
npm --version

# Backend status
curl http://localhost:8000/health | jq

# Frontend build
cd client && npm run build

# Health check
cd server && python health_check.py
```
