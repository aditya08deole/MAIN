# 🚂 COMPLETE RAILWAY DEPLOYMENT GUIDE

**Platform:** Railway.app  
**Application:** EvaraTech IoT Platform Backend (FastAPI + Supabase)  
**Estimated Time:** 15 minutes  
**Difficulty:** ⭐⭐ (Easy)

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before you start, make sure you have:

- ✅ GitHub account (with MAIN repository)
- ✅ All changes committed and pushed to GitHub
- ✅ Supabase credentials ready (from `.env.railway` file)
- ✅ Credit/debit card (for Railway verification - free $5 credit)

---

## 🚀 STEP-BY-STEP DEPLOYMENT GUIDE

### **PHASE 1: Setup Railway Account** (3 minutes)

#### Step 1.1: Sign Up for Railway
1. Go to: **https://railway.app**
2. Click **"Start a New Project"**
3. Click **"Login with GitHub"**
4. Authorize Railway to access your GitHub account
5. Verify your account with email

#### Step 1.2: Add Payment Method (Required for Free Tier)
1. Click your profile (top right)
2. Go to **"Account Settings"**
3. Click **"Billing"**
4. Add a credit/debit card
   - **Note:** You get **$5 free credit/month** (enough for ~550 hours)
   - You won't be charged unless you exceed free tier
5. Confirm and save

---

### **PHASE 2: Deploy Backend from GitHub** (5 minutes)

#### Step 2.1: Create New Project
1. On Railway dashboard, click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose repository: **`aditya08deole/MAIN`**
4. Railway will scan your repository

#### Step 2.2: Configure Service Settings
1. Railway auto-detects Python
2. Click **"Add variables"** before deploying
3. Click **"Settings"** in the sidebar

#### Step 2.3: Configure Build Settings
1. In **Settings** → **Root Directory**, set:
   ```
   server
   ```
   
2. In **Settings** → **Start Command**, Railway should auto-detect:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
   
3. If not set, click **"Edit"** and paste the command above

4. In **Settings** → **Build Command**, set:
   ```
   pip install -r requirements.txt
   ```

---

### **PHASE 3: Configure Environment Variables** (5 minutes)

#### Step 3.1: Add All Environment Variables

Click **"Variables"** tab, then click **"New Variable"** for each:

**Copy and paste these one by one:**

```bash
# 1. Environment
ENVIRONMENT=production

# 2. Database URL (CRITICAL!)
DATABASE_URL=postgresql+asyncpg://postgres.tihrvotigvaozizlcxse:evaratech%401010@db.tihrvotigvaozizlcxse.supabase.co:6543/postgres

# 3. Supabase URL
SUPABASE_URL=https://tihrvotigvaozizlcxse.supabase.co

# 4. Supabase Service Role Key
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHJ2b3RpZ3Zhb3ppemxjeHNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMwOTUyNywiZXhwIjoyMDg2ODg1NTI3fQ.zTcjoRCoo8AQHd0X8CFGuHh-WUHwXPDfeQeQKts3JJI

# 5. Supabase JWT Secret
SUPABASE_JWT_SECRET=fzxLrpyummk6rZjWJbrC63jZmwrgThygVoHF3K0jdJE2F3sUhuVxH7HUGUk5r67NWsjtYCb4x9iEJdKikyhS4A==

# 6. Secret Key (GENERATE A NEW ONE!)
SECRET_KEY=<PASTE_YOUR_GENERATED_SECRET_KEY>

# 7. CORS Origins (add Railway URL after deployment)
BACKEND_CORS_ORIGINS=http://localhost:5173,http://localhost:8080

# 8. Log Level
LOG_LEVEL=INFO
```

#### Step 3.2: Generate SECRET_KEY

**Option A: Using PowerShell**
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Option B: Using Online Generator**
Go to: https://generate-secret.vercel.app/32
Copy the generated key

**Paste the generated key** as the value for `SECRET_KEY`

---

### **PHASE 4: Deploy!** (2 minutes)

#### Step 4.1: Start Deployment
1. Click **"Deploy"** button (top right)
2. Railway will:
   - Clone your GitHub repo
   - Install Python 3.12
   - Install dependencies from `requirements.txt`
   - Start your FastAPI application
   
3. Watch the **build logs** in real-time

#### Step 4.2: Monitor Deployment
Look for these success messages:
```
✅ [INFO] Using Supabase connection pooler (port 6543)
✅ [START] STARTING EVARATECH BACKEND
✅ [OK] Database connection test successful
✅ [OK] EVARATECH BACKEND STARTUP COMPLETE
   Health Check: /health
   API Docs: /docs
```

**Deployment typically takes 2-3 minutes**

---

### **PHASE 5: Get Your Railway URL** (1 minute)

#### Step 5.1: Generate Public URL
1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. Railway creates a URL like:
   ```
   https://your-app-name-production.up.railway.app
   ```
5. Copy this URL

#### Step 5.2: Test Your Backend
Open your browser or use curl:

```bash
# Test health endpoint
curl https://your-app-name-production.up.railway.app/health

# Expected response:
{
  "status": "ok",
  "version": "2.0.0",
  "services": {
    "database": "ok",
    "thingspeak": "ok"
  }
}
```

---

### **PHASE 6: Update CORS and Frontend** (2 minutes)

#### Step 6.1: Add Railway URL to CORS
1. Go back to **"Variables"** tab
2. Find **`BACKEND_CORS_ORIGINS`**
3. Click **"Edit"**
4. Add your Railway URL:
   ```
   https://your-app-name-production.up.railway.app,http://localhost:5173,http://localhost:8080
   ```
5. Click **"Update"** (Railway will auto-redeploy)

#### Step 6.2: Update Frontend Configuration

**If using Render for frontend:**
1. Go to Render dashboard
2. Find your frontend service
3. Update environment variable:
   ```
   VITE_API_URL=https://your-app-name-production.up.railway.app/api/v1
   ```
4. Trigger redeploy

**If deploying frontend to Railway too:**
1. Create another Railway service for frontend
2. Set `VITE_API_URL` to your backend Railway URL

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify everything works:

### Backend Health Tests:

```bash
# 1. Health check
curl https://your-app.up.railway.app/health
# ✅ Should return: {"status": "ok"}

# 2. API Documentation
# Open in browser: https://your-app.up.railway.app/docs
# ✅ Should show Swagger UI

# 3. Debug routes
curl https://your-app.up.railway.app/api/v1/debug/routes
# ✅ Should return list of all routes

# 4. Database status
curl https://your-app.up.railway.app/api/v1/debug/db-status
# ✅ Should show tables and counts
```

### Frontend Integration Test:
1. Open your frontend URL
2. Login with Supabase credentials
3. Check "System Health" widget → Should show "HEALTHY"
4. Navigate to "All Nodes" → Should load node list
5. Check browser console → No errors

---

## 🔧 TROUBLESHOOTING

### Issue: Build Failed

**Solution:**
1. Check **Logs** tab for error messages
2. Common fixes:
   - Verify `requirements.txt` has all dependencies
   - Check Python version in `runtime.txt` (should be `3.12`)
   - Ensure **Root Directory** is set to `server`

### Issue: Database Connection Error

**Error:** `"database": "error"`

**Solution:**
1. Verify `DATABASE_URL` in Variables:
   - Must use port **6543** (not 5432)
   - Must include password encoding (`%40` for `@`)
   - Format: `postgresql+asyncpg://user:pass@host:6543/db`

2. Check Supabase:
   - Go to Supabase Dashboard
   - Settings → Database
   - Verify connection pooler is enabled

### Issue: Application Crashed

**Error:** `Application failed to start`

**Solution:**
1. Check **Logs** tab for Python errors
2. Verify environment variables are set correctly
3. Check **Start Command** is:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

### Issue: CORS Errors in Frontend

**Error:** `Access-Control-Allow-Origin blocked`

**Solution:**
1. Add frontend URL to `BACKEND_CORS_ORIGINS`:
   ```
   BACKEND_CORS_ORIGINS=https://your-frontend.com,https://your-backend.up.railway.app
   ```
2. Update variable in Railway
3. Wait for auto-redeploy

---

## 📊 MONITORING YOUR DEPLOYMENT

### Railway Dashboard Features:

1. **Logs:** Real-time application logs
   - View startup logs
   - Debug errors
   - Monitor requests

2. **Metrics:** Resource usage
   - CPU usage
   - Memory consumption
   - Network traffic

3. **Variables:** Environment management
   - Edit variables
   - Add new variables
   - Variable versioning

4. **Settings:** Service configuration
   - Deploy settings
   - Build configuration
   - Networking options

---

## 💰 COST MANAGEMENT

### Free Tier Limits:
- **$5/month credit** = ~550 hours of runtime
- For a continuously running service:
  - 24/7 = 730 hours/month
  - Cost: ~$0.80/month (after free credit)

### Tips to Stay in Free Tier:
1. Use sleep mode for development deployments
2. Monitor usage in Railway dashboard
3. Set up billing alerts

### Expected Monthly Cost:
- **Development:** Free (with $5 credit)
- **Production 24/7:** ~$3-5/month
- **High traffic:** $10-20/month

---

## 🔄 UPDATING YOUR DEPLOYMENT

### Automatic Deployments:

Railway auto-deploys when you push to GitHub:

```bash
# Make changes locally
git add .
git commit -m "your changes"
git push origin main

# Railway automatically:
# 1. Detects the push
# 2. Rebuilds your app
# 3. Deploys new version
# 4. Zero-downtime deployment
```

### Manual Deployment:
1. Go to Railway dashboard
2. Click **"Deploy"** → **"Redeploy"**
3. Confirm

---

## 🚀 ADVANCED CONFIGURATION

### Add Custom Domain:

1. Go to **Settings** → **Networking**
2. Click **"Custom Domain"**
3. Enter your domain (e.g., `api.evaratech.com`)
4. Add DNS records (Railway provides instructions):
   ```
   Type: CNAME
   Name: api
   Value: your-app.up.railway.app
   ```
5. Wait for DNS propagation (5-30 minutes)
6. SSL certificate auto-generates

### Scale Your Service:

1. Go to **Settings** → **Resources**
2. Adjust:
   - **CPU:** Up to 8 vCPU
   - **Memory:** Up to 8GB RAM
   - **Replicas:** Multiple instances for load balancing

### Add Railway PostgreSQL:

If you want to migrate from Supabase to Railway's PostgreSQL:

1. Click **"New"** → **"Database"** → **"PostgreSQL"**
2. Railway provisions a database
3. Update `DATABASE_URL` to Railway's PostgreSQL URL
4. Redeploy

---

## 📚 USEFUL RAILWAY COMMANDS (Optional)

### Install Railway CLI:

```bash
# Using npm
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# View logs locally
railway logs

# Run commands in Railway environment
railway run python manage.py migrate

# Open dashboard
railway open
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

After successful deployment:

- [ ] Backend health check returns `{"status": "ok"}`
- [ ] API docs accessible at `/docs`
- [ ] Database connection verified
- [ ] Frontend can reach backend
- [ ] CORS configured properly
- [ ] Environment variables secured
- [ ] Custom domain configured (optional)
- [ ] Monitoring set up
- [ ] Billing alerts configured
- [ ] GitHub auto-deploy working

---

## 🎉 SUCCESS!

Your EvaraTech backend is now live on Railway!

### Your URLs:
- **Backend API:** `https://your-app.up.railway.app`
- **API Docs:** `https://your-app.up.railway.app/docs`
- **Health Check:** `https://your-app.up.railway.app/health`

### Next Steps:
1. Update frontend to use Railway backend URL
2. Test all functionality
3. Monitor logs for any issues
4. Set up alerts for uptime monitoring
5. Consider adding custom domain

---

## 🆘 NEED HELP?

### Railway Support:
- **Discord:** https://discord.gg/railway
- **Docs:** https://docs.railway.app
- **Status:** https://status.railway.app

### Common Questions:

**Q: Can I deploy frontend and backend on Railway?**  
A: Yes! Create two separate services in the same project.

**Q: How do I rollback a deployment?**  
A: Go to Deployments tab → Click previous deployment → Click "Redeploy"

**Q: Can I use Railway with Docker?**  
A: Yes! Railway auto-detects Dockerfile and uses it.

**Q: Is Railway suitable for production?**  
A: Absolutely! Many companies use Railway for production workloads.

---

## 📞 QUICK REFERENCE

### Key Files Created:
- ✅ `server/railway.json` - Railway configuration
- ✅ `server/Procfile` - Start command
- ✅ `server/nixpacks.toml` - Build configuration
- ✅ `server/runtime.txt` - Python version
- ✅ `server/.env.railway` - Environment variables template

### Important URLs:
- Railway Dashboard: https://railway.app/dashboard
- Your Project: https://railway.app/project/your-project-id
- Billing: https://railway.app/account/billing

### Key Commands:
```bash
# View logs
railway logs

# Link project
railway link

# Deploy manually
railway up

# SSH into service
railway shell
```

---

**🎊 CONGRATULATIONS! You're now deployed on Railway!** 🚂

Your backend is production-ready with:
- ✅ Automatic deployments from GitHub
- ✅ Zero-downtime updates
- ✅ Built-in SSL/HTTPS
- ✅ Comprehensive logging
- ✅ Easy scaling
- ✅ Great performance

**Need help? I'm here! Just ask.** 🚀
