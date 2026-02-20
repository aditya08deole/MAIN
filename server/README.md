# EvaraTech Backend - Simplified & Production-Ready

**Clean, maintainable FastAPI backend focused on core functionality.**

## 🎯 Features

### ✅ Core Functionality
- **Supabase Authentication** - JWT-based user authentication
- **Device Registry** - Complete CRUD operations for IoT devices
- **ThingSpeak Integration** - Fetch real-time and historical telemetry data
- **Health Monitoring** - Comprehensive system health checks

### 🚀 Performance & Robustness
- **Connection Pooling** - Optimized database connections
- **Caching** - ThingSpeak data cached for 30 seconds
- **Rate Limiting** - ThingSpeak API rate limiting (4 req/sec)
- **Retry Logic** - Database initialization with exponential backoff
- **Error Handling** - Comprehensive exception handling
- **Request Logging** - All requests logged with timing

## 📁 Project Structure

```
server/
├── main.py              # FastAPI app + all routes (430 lines)
├── config.py            # Environment configuration
├── database.py          # Database connection & session
├── models.py            # SQLAlchemy models (User, Device)
├── schemas.py           # Pydantic request/response schemas
├── supabase_auth.py     # JWT authentication
├── thingspeak.py        # ThingSpeak API client
├── requirements.txt     # Dependencies (9 packages)
├── Dockerfile           # Container configuration
└── .env.example         # Environment variables template
```

**Total: 8 files, ~800 lines of code**

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Locally

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Access API

- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **ReDoc**: http://localhost:8000/redoc

## 📚 API Endpoints

### Authentication
- `POST /auth/sync` - Sync Supabase user to database
- `GET /auth/me` - Get current user profile

### Devices
- `GET /devices` - List all user devices
- `POST /devices` - Create new device
- `GET /devices/{id}` - Get device details
- `PUT /devices/{id}` - Update device
- `DELETE /devices/{id}` - Delete device

### Telemetry
- `GET /devices/{id}/telemetry/latest` - Get latest ThingSpeak data
- `GET /devices/{id}/telemetry/history` - Get historical data

### System
- `GET /health` - System health check
- `GET /` - API information

## 🔧 Configuration

### Required Environment Variables

```env
# Database (Supabase)
DATABASE_URL=postgresql+asyncpg://user:pass@host:6543/db

# Supabase Auth
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret

# CORS
CORS_ORIGINS=http://localhost:5173,https://your-frontend.com
```

### Database Connection

**CRITICAL**: Use port **6543** (connection pooler) not 5432 (direct).

Supabase requires external connections to use the connection pooler:
- ✅ Correct: `...@db.xxx.supabase.co:6543/postgres`
- ❌ Wrong: `...@db.xxx.supabase.co:5432/postgres`

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t evaratech-backend .
```

### Run Container

```bash
docker run -p 8000:8000 \
  -e DATABASE_URL="your-database-url" \
  -e SUPABASE_URL="your-supabase-url" \
  -e SUPABASE_JWT_SECRET="your-jwt-secret" \
  evaratech-backend
```

## ☁️ Render Deployment

### Using render.yaml (Automated)

1. Push to GitHub
2. Connect Render to your repository
3. Render auto-deploys from `render.yaml`

### Manual Deployment

1. Create new **Web Service** on Render
2. Connect GitHub repository
3. Set **Root Directory**: `server`
4. Set **Build Command**: `pip install -r requirements.txt`
5. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables from `.env.example`

## 🧪 Testing

### Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "ok",
  "timestamp": "2024-01-01T12:00:00"
}
```

### Create Device (with auth)

```bash
curl -X POST http://localhost:8000/devices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "node_key": "TANK001",
    "label": "Main Water Tank",
    "category": "Tank",
    "thingspeak_channel_id": "123456"
  }'
```

## 📊 Performance Features

### Database
- **Connection Pooling**: 5 connections + 2 overflow
- **Pre-ping**: Validates connections before use
- **Pool Recycle**: Recycles connections every 5 minutes
- **Retry Logic**: 3 attempts with exponential backoff

### ThingSpeak
- **Caching**: 30-second TTL for latest data
- **Rate Limiting**: 250ms between requests (4 req/sec max)
- **Timeout**: 10-second request timeout
- **Error Handling**: Graceful degradation on failures

### Request Handling
- **Logging**: All requests logged with timing
- **Exception Handling**: Global exception handler
- **CORS**: Configurable origins
- **Process Time Header**: X-Process-Time header on all responses

## 🔒 Security

- **JWT Validation**: Comprehensive Supabase JWT verification
- **Token Expiration**: Automatic expiry checking
- **Required Claims**: Validates sub, email fields
- **Error Messages**: Secure, non-revealing error messages
- **SQL Injection**: Protected by SQLAlchemy ORM
- **CORS**: Strict origin validation

## 🐛 Troubleshooting

### Database Connection Error

**Error**: `[Errno 101] Network is unreachable`

**Solutions**:
1. Verify DATABASE_URL uses port **6543** (not 5432)
2. Check Supabase connection pooler is enabled
3. Verify network/firewall allows outbound connections
4. Try using Render PostgreSQL instead of Supabase

### Authentication Error

**Error**: `Invalid authentication token`

**Solutions**:
1. Verify SUPABASE_JWT_SECRET matches Supabase dashboard
2. Check token is not expired
3. Ensure token is sent in Authorization header: `Bearer <token>`

### ThingSpeak Error

**Error**: `Failed to fetch data from ThingSpeak`

**Solutions**:
1. Verify channel_id is correct
2. Check read_key if channel is private
3. Verify ThingSpeak API is accessible
4. Check rate limiting (max 4 requests/second)

## 📈 Monitoring

### Health Endpoint

Returns detailed system status:
- Database connection status
- Database response time
- Connection pool statistics

### Logs

All requests are logged with:
- HTTP method
- URL path
- Status code
- Processing time in milliseconds

Example:
```
[200] GET /devices - 45.23ms
[201] POST /devices - 123.45ms
[ERROR] GET /devices/invalid - 12.34ms
```

## 🔄 Migration from Complex Backend

The new backend maintains API compatibility:
- ✅ Same endpoints
- ✅ Same request/response formats
- ✅ Same authentication flow
- ✅ Frontend works without changes

**Changes**:
- Removed: AI, analytics, alerts, websockets, background tasks
- Simplified: Single file architecture
- Improved: Error handling, caching, logging

## 📦 Dependencies

Only 9 packages (vs 25+ in complex backend):

- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `sqlalchemy` - ORM
- `asyncpg` - PostgreSQL driver
- `pydantic` - Data validation
- `pydantic-settings` - Config management
- `python-jose` - JWT handling
- `httpx` - HTTP client
- `python-dotenv` - Environment variables

## 🎯 Design Principles

1. **Simplicity** - Everything in one place, easy to understand
2. **Performance** - Caching, connection pooling, efficient queries
3. **Robustness** - Retry logic, error handling, graceful degradation
4. **Security** - Comprehensive auth validation, secure defaults
5. **Maintainability** - Clear code, good comments, minimal dependencies

## 📞 Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify environment variables are set correctly
3. Test database connection separately
4. Review the [BACKEND_REMAKE_PLAN.md](../BACKEND_REMAKE_PLAN.md)

---

**Built with ❤️ for EvaraTech IoT Platform**
