from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.api.api_v1.api import api_router
from app.core.logging import setup_logging
from app.db.session import create_tables
from app.core.background import start_background_tasks
from app.services.seeder import seed_db
from app.core.security_supabase import get_current_user_token

from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title="EvaraTech Backend", version="1.0.0")

# Configure CORS to allow requests from the React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"]) # In prod, restrict this!

@app.middleware("http")
async def log_requests(request, call_next):
    from fastapi import Request
    import time
    start_time = time.time()
    
    path = request.url.path
    method = request.method
    auth = request.headers.get("Authorization", "No Auth")
    
    response = await call_next(request)
    
    process_time = (time.time() - start_time) * 1000
    print(f"REQUEST: {method} {path} | Auth: {auth[:20]}... | Status: {response.status_code} | Time: {process_time:.2f}ms")
    
    return response

app.include_router(api_router, prefix="/api/v1")

# Setup logging
logger = setup_logging()

@app.on_event("startup")
async def startup_event():
    logger.info("Starting EvaraTech Backend...")
    try:
        # Initialize database tables
        await create_tables()
        # Auto-seed if database is new/empty
        await seed_db()
        await start_background_tasks()
        logger.info("Background tasks started.")
    except Exception as e:
        logger.error(f"Startup task failed (DB might be unreachable): {e}")

@app.get("/health")
async def health_check():
    from sqlalchemy import text
    from app.db.session import engine
    import asyncio
    db_status = "ok"
    try:
        # 2s timeout for health check ping
        async with asyncio.timeout(2):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "unreachable"
        
    return {
        "status": "ok", 
        "service": "EvaraTech Backend",
        "database": db_status
    }

@app.get("/")
async def root():
    return {"message": "Welcome to EvaraTech Backend API. Docs at /docs"}
