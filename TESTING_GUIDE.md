# ✅ Testing & Validation Checklist

## Pre-Start Checklist

Before starting the application, verify:

### Environment Setup
- [ ] Python 3.10+ installed (`python --version`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Git installed (`git --version`)
- [ ] PostgreSQL client (optional, for debugging)

### Configuration Files
- [ ] `server/.env` exists and configured
- [ ] `client/.env` exists and configured
- [ ] Database connection string is correct
- [ ] Supabase credentials are valid

### Dependencies
```bash
# Backend
cd server
pip install -r requirements.txt
# Should complete without errors

# Frontend
cd client
npm install
# Should complete without errors
```

---

## Backend Testing

### 1. Health Check
```bash
cd server
python health_check.py
```

**Expected Output:**
```
🔍 EvaraTech Backend Health Check
============================================================

📋 Environment Variables:
  ✅ DATABASE_URL: postgresql+a...
  ✅ SUPABASE_URL: https://...
  ✅ SUPABASE_KEY: eyJhbGci...
  ✅ SUPABASE_JWT_SECRET: fzxLrpy...

🗄️  Database Connection:
  ✅ Database connection successful

☁️  Supabase API:
  ✅ Supabase API reachable (HTTP 200)

🌐 Backend Server:
  ✅ Server is running
     Status: ok
     Uptime: 123s
     DB Status: ok

📊 Database Tables:
  ✅ nodes
  ✅ users_profiles
  ✅ communities
  ✅ distributors

============================================================
✅ Health check complete!
```

### 2. Start Backend Server
```bash
cd server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Will watch for changes in these directories: ['/path/to/server']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
[OK] Database tables created/verified successfully
🚀 Telemetry Polling Service Started.
INFO:     Application startup complete.
```

✅ **Success**: No error messages, server starts cleanly

❌ **Failure**: Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### 3. Test API Endpoints

**Health Endpoint:**
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok","database":{"status":"ok",...}}`

**Nodes Endpoint (with auth):**
```bash
curl -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
     http://localhost:8000/api/v1/nodes/
```
Expected: `{"status":"success","data":[...],"meta":{...}}`

**Dashboard Stats:**
```bash
curl -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
     http://localhost:8000/api/v1/dashboard/stats
```
Expected: `{"status":"success","data":{"total_nodes":...,}}`

**API Documentation:**
Open browser: `http://localhost:8000/docs`
Expected: Swagger UI with all endpoints listed

---

## Frontend Testing

### 1. Start Frontend Server
```bash
cd client
npm run dev
```

**Expected Output:**
```
  VITE v7.3.1  ready in 542 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.x:5173/
  ➜  press h + enter to show help
```

### 2. Browser Testing

Open: `http://localhost:5173`

#### Landing/Splash Screen
- [ ] EvaraTech logo appears
- [ ] Smooth fade-in animation
- [ ] Transitions to main app after ~1.5s

#### Login Page
- [ ] Login form appears
- [ ] Can enter email/password
- [ ] "Login" button works
- [ ] Error messages display correctly

**Test Credentials:**
- Email: `ritik@evaratech.com`
- Password: `evaratech@1010`

#### Dashboard Page
- [ ] Map loads with correct center
- [ ] Device markers appear on map
- [ ] Stats cards show correct data:
  - Total Nodes
  - Online Nodes
  - Active Alerts
  - System Health
- [ ] Live feed shows telemetry (if configured)
- [ ] No JavaScript errors in console

#### All Nodes Page
- [ ] Node list loads
- [ ] Filter buttons work:
  - All Status
  - Online
  - Offline
- [ ] Category tabs work:
  - All Nodes
  - EvaraTank
  - EvaraDeep
  - EvaraFlow
- [ ] Search bar works
- [ ] Node cards display correctly

#### Individual Node Details
- [ ] Click on a node opens details page
- [ ] Node information displays
- [ ] Analytics charts render
- [ ] Real-time data updates (if configured)

#### Admin Panel (Superadmin only)
- [ ] Admin menu accessible
- [ ] Communities page loads
- [ ] Customers page loads
- [ ] Nodes management works
- [ ] Audit logs display

---

## Integration Testing

### WebSocket Connection
```javascript
// In browser console:
const ws = new WebSocket('ws://localhost:8000/api/v1/ws/ws');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('📨 Message:', e.data);
ws.onerror = (e) => console.error('❌ Error:', e);
```

Expected: Connection success, periodic messages

### Real-time Updates
1. Open app in two browser windows
2. In one window, trigger a status change
3. Verify the other window updates automatically

### ThingSpeak Integration (if configured)
```bash
# Test ThingSpeak API
curl "https://api.thingspeak.com/channels/YOUR_CHANNEL/feeds/last.json?api_key=YOUR_KEY"
```

Expected: Latest reading returned

---

## Performance Testing

### API Response Times
```bash
# Measure response time
time curl -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
     http://localhost:8000/api/v1/nodes/
```

Expected: < 500ms for nodes endpoint

### Frontend Load Time
1. Open DevTools → Network tab
2. Hard refresh (Ctrl+Shift+R)
3. Check "Load" time

Expected:
- DOMContentLoaded: < 1s
- Full Load: < 3s

### Memory Usage
```bash
# Backend
ps aux | grep uvicorn

# Check memory usage (VSZ/RSS columns)
# Should be < 500MB under normal load
```

---

## Security Testing

### CORS Configuration
```bash
# Should succeed (allowed origin)
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8000/api/v1/nodes/

# Should fail (not allowed origin)
curl -H "Origin: http://evil.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     http://localhost:8000/api/v1/nodes/
```

### Authentication
```bash
# Should fail (no auth)
curl http://localhost:8000/api/v1/nodes/
# Expected: 401 Unauthorized or 403 Forbidden

# Should succeed (with auth)
curl -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
     http://localhost:8000/api/v1/nodes/
# Expected: 200 OK with data
```

### SQL Injection Prevention
```bash
# Try SQL injection in search
curl -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
     "http://localhost:8000/api/v1/nodes/?q='; DROP TABLE nodes; --"
     
# Should be safely escaped, no SQL error
```

---

## Load Testing (Optional)

### Using Apache Bench
```bash
# 100 requests, 10 concurrent
ab -n 100 -c 10 \
   -H "Authorization: Bearer dev-bypass-ritik@evaratech.com" \
   http://localhost:8000/api/v1/nodes/
```

Expected Results:
- Requests per second: > 50
- Mean response time: < 200ms
- Failed requests: 0

### Using Artillery
```bash
npm install -g artillery

# Create quick-test.yml:
artillery quick --count 10 --num 100 http://localhost:8000/health
```

Expected:
- p95 latency: < 300ms
- p99 latency: < 500ms

---

## Deployment Testing (Render/Production)

### Pre-Deployment Checklist
- [ ] All tests pass locally
- [ ] No console errors
- [ ] Environment variables documented
- [ ] Database migrations applied
- [ ] Backup created

### Post-Deployment Verification
```bash
# Replace with your actual URLs

# Health check
curl https://your-backend.onrender.com/health

# Test auth
curl -H "Authorization: Bearer YOUR_REAL_TOKEN" \
     https://your-backend.onrender.com/api/v1/nodes/

# Check frontend
curl -I https://your-frontend.onrender.com
# Should return 200 OK
```

### Monitor for 24 Hours
- [ ] Check Render logs for errors
- [ ] Monitor response times
- [ ] Check for memory leaks
- [ ] Verify real-time updates work
- [ ] Test from different devices/networks

---

## Automated Testing (Future)

### Unit Tests
```bash
cd server
pytest tests/unit/ -v
```

### Integration Tests
```bash
cd server
pytest tests/integration/ -v
```

### E2E Tests
```bash
cd client
npx playwright test
```

---

## Issue Tracking

### Found an Issue?

1. **Document it:**
   - What were you doing?
   - What did you expect?
   - What actually happened?
   - Error messages?
   - Screenshots?

2. **Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

3. **Report it:**
   - GitHub Issues
   - Discord/Slack
   - Email: dev@evaratech.com

### Issue Template
```markdown
**Environment:**
- OS: [Windows/Mac/Linux]
- Python version: [output of `python --version`]
- Node version: [output of `node --version`]

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. See error

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Error Messages:**
```
[Paste error messages]
```

**Screenshots:**
[Attach screenshots]

**Additional Context:**
[Any other relevant information]
```

---

## Success Criteria

✅ **Consider the platform ready for production when:**

1. **Reliability**
   - [ ] All health checks pass
   - [ ] No crashes for 48+ hours
   - [ ] Error rate < 1%

2. **Performance**
   - [ ] API response time < 500ms (p95)
   - [ ] Frontend load time < 3s
   - [ ] Memory usage < 500MB

3. **Functionality**
   - [ ] All core features work
   - [ ] Authentication works
   - [ ] Real-time updates work
   - [ ] Data persists correctly

4. **User Experience**
   - [ ] No JavaScript errors
   - [ ] UI responds smoothly
   - [ ] Mobile responsive
   - [ ] Error messages are clear

5. **Security**
   - [ ] Authentication required
   - [ ] CORS configured correctly
   - [ ] No SQL injection vulnerabilities
   - [ ] Secrets not exposed

---

## Next Steps After Validation

1. ✅ **All tests pass** → Ready for production!
2. ⚠️ **Some tests fail** → Review [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. ❌ **Many tests fail** → Contact support with results

**Happy Testing! 🚀**
