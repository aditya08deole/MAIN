# EvaraTech IoT Platform

**Modern IoT Device Management & Telemetry System**

Clean, production-ready platform for managing IoT devices with real-time telemetry from ThingSpeak.

---

## ✨ Features

- 🔐 **Supabase Authentication** - JWT-based secure user authentication
- 📊 **Device Management** - Full CRUD operations for IoT devices
- 📡 **ThingSpeak Integration** - Real-time telemetry data retrieval
- 🗺️ **Geographic Mapping** - Device location visualization with Leaflet
- ⚡ **Performance** - Connection pooling, retry logic, caching
- 🎯 **RESTful API** - Complete OpenAPI/Swagger documentation
- 🚀 **Production Ready** - Error handling, logging, health checks

---

## 🏗️ Architecture

### Backend - Simplified Structure (8 Files, ~800 Lines)

```
server/
├── config.py          # Environment configuration (Pydantic)
├── database.py        # PostgreSQL connection & pooling
├── models.py          # SQLAlchemy ORM (User, Device)
├── schemas.py         # Pydantic request/response schemas
├── supabase_auth.py   # JWT verification
├── thingspeak.py      # ThingSpeak API client
├── main.py            # FastAPI app + all routes
└── requirements.txt   # 9 dependencies
```

**Stack:**
- FastAPI (async web framework)
- SQLAlchemy 2.0 (async ORM)
- PostgreSQL (Supabase, Seoul region)
- AsyncPG (database adapter)
- Python-JOSE (JWT)

### Frontend

- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui
- Axios (API client with interceptors)
- Leaflet (interactive maps)

### Deployment

- **Backend**: Render Web Service
- **Frontend**: Render Static Site
- **Database**: Supabase (pooler port 6543, SSL enabled)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Supabase account

### 1. Clone Repository

```bash
git clone https://github.com/aditya08deole/MAIN.git
cd MAIN
```

### 2. Backend Setup

```bash
cd server

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Create `server/.env`:**

```env
DATABASE_URL=postgresql+asyncpg://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_JWT_SECRET=your_jwt_secret
SUPABASE_KEY=your_service_role_key
CORS_ORIGINS=http://localhost:5173
ENVIRONMENT=development
```

**Start server:**

```bash
uvicorn main:app --reload --port 8000
```

📚 API Docs: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd client
npm install
```

**Create `client/.env`:**

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Start dev server:**

```bash
npm run dev
```

🌐 App: http://localhost:5173

---

## 📡 API Endpoints

### Public

- `GET /` - API information
- `GET /health` - Health check with DB & ThingSpeak status
- `GET /config-check` - Verify environment variables

### Authentication (JWT Required)

- `POST /api/v1/auth/sync` - Sync Supabase user to database
- `GET /api/v1/auth/me` - Get current user profile

### Devices

- `GET /api/v1/devices` - List user's devices
- `POST /api/v1/devices` - Create device
- `GET /api/v1/devices/{id}` - Get device
- `PUT /api/v1/devices/{id}` - Update device
- `DELETE /api/v1/devices/{id}` - Delete device

### Nodes (Alias for Devices)

- `GET /api/v1/nodes` - List nodes
- `GET /api/v1/nodes/{id}` - Get node
- `POST /api/v1/nodes` - Create node
- `PATCH /api/v1/nodes/{id}` - Update node
- `DELETE /api/v1/nodes/{id}` - Delete node

### Telemetry

- `GET /api/v1/devices/{id}/telemetry/latest` - Latest ThingSpeak data
- `GET /api/v1/devices/{id}/telemetry/history?results=100` - Historical data

### Dashboard

- `GET /api/v1/dashboard/stats` - Total nodes, online count, alerts

---

## 🗄️ Database Schema

### Users

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Devices

```sql
CREATE TABLE devices (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    node_key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'offline',
    lat FLOAT,
    lng FLOAT,
    location_name TEXT,
    thingspeak_channel_id TEXT,
    thingspeak_read_key TEXT,
    field_mapping JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP
);
```

---

## 🚀 Production Deployment

### Backend (Render)

1. **Create Web Service** in Render Dashboard
2. **Connect GitHub repo**
3. **Configure:**
   - Build Command: `pip install -r server/requirements.txt`
   - Start Command: `cd server && uvicorn main:app --host 0.0.0.0 --port $PORT`

4. **Add Environment Variables:**

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres?sslmode=require` |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_JWT_SECRET` | Your JWT secret from Supabase → Settings → API |
| `SUPABASE_KEY` | Your service_role key |
| `CORS_ORIGINS` | `https://your-frontend.onrender.com` |
| `ENVIRONMENT` | `production` |

5. **Deploy** - Auto-deploys on every push to `main`

### Frontend (Render)

1. **Create Static Site** in Render Dashboard
2. **Connect GitHub repo**
3. **Configure:**
   - Build Command: `cd client && npm install && npm run build`
   - Publish Directory: `client/dist`

4. **Add Environment Variables:**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://your-backend.onrender.com/api/v1` |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your anon key |

📋 **Detailed Setup**: See [RENDER_ENV_SETUP.md](RENDER_ENV_SETUP.md)

---

## 🔍 Troubleshooting

### 401 "Not authenticated" Error

**Cause**: Missing `SUPABASE_JWT_SECRET` in Render environment

**Fix**: 
1. Go to Render → Backend Service → Environment
2. Add `SUPABASE_JWT_SECRET` from Supabase → Settings → API
3. Redeploy

### 404 Errors on API Calls

**Cause**: Frontend calling wrong URL

**Fix**: Verify `VITE_API_URL` ends with `/api/v1`

### Database Connection Fails

**Cause**: Wrong connection string or missing SSL

**Fix**: 
- Use pooler URL (port 6543, not 5432)
- Append `?sslmode=require` to DATABASE_URL
- Use `postgresql+asyncpg://` prefix (not just `postgresql://`)

### "DB: Unknown" in Frontend

**Cause**: Backend environment not configured

**Fix**: 
1. Visit `https://your-backend.onrender.com/config-check`
2. Add any missing environment variables
3. Redeploy

---

## 📚 Additional Documentation

See [`documents/`](documents/) folder for:

- **Architecture**: System design docs (historical)
- **Implementation**: Development phase logs
- **Guides**: Testing, security, troubleshooting

---

## 🧪 Development

### Run Backend Tests

```bash
cd server
pytest tests/ -v
```

### Code Quality

```bash
# Backend
cd server
black .
flake8 .

# Frontend
cd client
npm run lint
```

### Local Database

```bash
# Use Supabase directly or set up local PostgreSQL
docker run -d \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15
```

---

## 📝 Project Structure

```
MAIN/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/            # Route pages
│   │   ├── services/         # API client
│   │   ├── context/          # Auth context
│   │   └── lib/              # Supabase client
│   ├── package.json
│   └── vite.config.ts
│
├── server/                    # FastAPI backend
│   ├── config.py             # Settings
│   ├── database.py           # DB connection
│   ├── models.py             # ORM models
│   ├── schemas.py            # Pydantic schemas
│   ├── supabase_auth.py      # JWT auth
│   ├── thingspeak.py         # API client
│   ├── main.py               # FastAPI app
│   ├── requirements.txt      # Dependencies
│   └── tests/                # Test suite
│
├── documents/                 # Documentation
│   ├── architecture/         # Design docs
│   ├── implementation/       # Dev logs
│   └── guides/               # How-tos
│
├── RENDER_ENV_SETUP.md       # Deployment guide
└── README.md                 # This file
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/name`)
3. Commit changes (`git commit -m 'Add feature'`)
4. Push to branch (`git push origin feature/name`)
5. Open Pull Request

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/aditya08deole/MAIN/issues)
- **Documentation**: [documents/](documents/)
- **Deployment**: [RENDER_ENV_SETUP.md](RENDER_ENV_SETUP.md)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

**Built with ❤️ for modern IoT management**
