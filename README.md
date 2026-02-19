# EvaraTech IoT Platform

**Next-Generation Water Quality & Distribution Monitoring System**

Real-time IoT telemetry, AI-driven insights, multi-tenant architecture, and predictive analytics for water management.

---

## 🌟 Features

- **Multi-Tenant Architecture**: Hierarchical organization (Distributors → Communities → Customers → Devices)
- **Real-Time Telemetry**: ThingSpeak integration with background polling (60s intervals)
- **Smart Alerts**: Threshold-based + offline detection with auto-resolution
- **Device Health Scoring**: Anomaly detection using Z-score analysis
- **AI Assistant**: Query device data and get operational insights
- **Role-Based Access Control**: Superadmin, Distributor, and Customer roles with RLS
- **Analytics Dashboard**: Live stats, device status, consumption trends
- **WebSocket Broadcasting**: Real-time UI updates on telemetry events

---

## 🏗️ Tech Stack

### Backend
- **Framework**: Python 3.10+ FastAPI (async/await)
- **ORM**: SQLAlchemy 2.0 (async sessions)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase JWT
- **Background Tasks**: asyncio loops (polling, cleanup, alerts)

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI**: TailwindCSS + shadcn/ui
- **State**: React Query + Context API
- **Maps**: Leaflet

### Infrastructure
- **Hosting**: Render (Docker + Static Site)
- **Database**: Supabase (PostgreSQL + Auth)
- **IoT**: ThingSpeak (sensor data ingestion)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Supabase account (free tier works)
- ThingSpeak account (optional, for IoT devices)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/evaratech.git
cd evaratech
```

### 2. Database Setup
1. Create a Supabase project
2. Go to **SQL Editor** and run:
   ```sql
   -- Copy and paste content from server/migrations/001_backend_excellence.sql
   ```
3. Go to **Authentication → Users** and set passwords for:
   - `ritik@evaratech.com` → `evaratech@1010`
   - `aditya@evaratech.com` → `evaratech@1010`
   - `yasha@evaratech.com` → `evaratech@1010`

### 3. Backend Setup
```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Start server
uvicorn app.main:app --reload
```
API Docs: `http://localhost:8000/docs`

### 4. Frontend Setup
```bash
cd client
npm install

# Configure environment
cp .env.example .env
# Edit .env with your backend URL and Supabase keys

# Start dev server
npm run dev
```
App: `http://localhost:5173`

---

## 📁 Project Structure

```
evaratech/
├── client/                # React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API calls
│   │   ├── context/      # React Context providers
│   │   └── lib/          # Utilities (Supabase, etc.)
│   └── .env.example
├── server/               # Python FastAPI backend
│   ├── app/
│   │   ├── api/          # Endpoints
│   │   ├── core/         # Config, security, background tasks
│   │   ├── db/           # Database session, repository pattern
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   ├── migrations/       # SQL migration scripts
│   │   └── 001_backend_excellence.sql  # ← Run this in Supabase
│   ├── requirements.txt
│   └── .env.example
├── render.yaml           # Render.com deployment config
└── README.md
```

---

## 🔑 Environment Variables

### Backend (`server/.env`)
```bash
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://user:pass@host:6543/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=service_role_key
SUPABASE_JWT_SECRET=jwt_secret
SECRET_KEY=random_secret_key
BACKEND_CORS_ORIGINS=http://localhost:5173
```

### Frontend (`client/.env`)
```bash
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=anon_public_key
```

---

## 🚢 Deployment (Render)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **New → Blueprint**
   - Connect your GitHub repo
   - Render will auto-detect `render.yaml`

3. **Set Environment Variables** (in Render Dashboard)
   - For `evara-backend`:
     - `DATABASE_URL` → Your Supabase connection string
     - `SUPABASE_URL` → Your Supabase project URL
     - `SUPABASE_KEY` → Service role key
     - `SUPABASE_JWT_SECRET` → JWT secret
   - For `evara-frontend`:
     - `VITE_SUPABASE_URL` → Same as backend
     - `VITE_SUPABASE_ANON_KEY` → Anon public key

4. **Deploy** → Render will build and deploy both services

---

## 🎯 Default Login

After running the migration, use these credentials:
- **Email**: `ritik@evaratech.com`
- **Password**: `evaratech@1010`
- **Role**: Superadmin

---

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/auth/sync` | POST | Sync user with Supabase |
| `/api/v1/nodes` | GET/POST | Node CRUD |
| `/api/v1/dashboard/stats` | GET | Dashboard metrics |
| `/api/v1/alerts` | GET | Alert history |
| `/api/v1/ingest/readings` | POST | Sensor data ingestion |

Full docs: `http://localhost:8000/docs`

---

## 🛠️ Development

### Run Tests
```bash
cd server
pytest
```

### Database Migrations
All schema changes are in `server/migrations/001_backend_excellence.sql`.  
Run it manually in Supabase SQL Editor.

### Background Tasks
The server runs 3 background loops:
1. **ThingSpeak Polling** (60s) — Fetches sensor data
2. **Data Cleanup** (24h) — Removes old readings/logs
3. **Alert Evaluation** — Checks thresholds after each poll

---

## 📝 License

[MIT License](LICENSE)

---

## 👥 Team

- **Ritik** - ritik@evaratech.com
- **Aditya** - aditya@evaratech.com
- **Yasha** - yasha@evaratech.com

---

## 🐛 Troubleshooting

**Backend won't start:**
- Check `DATABASE_URL` format (must be `postgresql+asyncpg://...`)
- Verify Supabase credentials
- Run `pip install -r requirements.txt`

**Frontend can't connect:**
- Check `VITE_API_URL` in client `.env`
- Ensure backend is running on port 8000
- Check browser console for CORS errors

**No data in dashboard:**
- Verify migration ran successfully in Supabase
- Check user is assigned to nodes (superadmin sees all)
- Inspect network tab for API errors

# Supabase
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_KEY="your-anon-key"
SUPABASE_JWT_SECRET="your-jwt-secret"

# ThingSpeak
THINGSPEAK_API_KEY="your-api-key"

# Logging
LOG_LEVEL="INFO"
```

## 📦 Deployment (Render)

The project is configured for Render.com via `render.yaml`.
1.  Connect your GitHub repository to Render.
2.  Select "Blueprints" and pick this repo.
3.  Render will automatically deploy the Backend (Docker) and Frontend (Static Site).

## 🔒 Security

*   **RBAC**: Strict role enforcement (Super Admin, Region Admin, Community Admin).
*   **RLS**: Row-Level Security logic implemented in API layer.
*   **Audit Logs**: All critical actions are logged.
*   **Rate Limiting**: Public endpoints are protected.

---
© 2024 EvaraTech. All Rights Reserved.
