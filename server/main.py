from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.api.api_v1.api import api_router
from app.core.logging import setup_logging
from app.db.session import create_tables
from app.core.background import start_background_tasks
from app.services.seeder import seed_db

app = FastAPI(title="EvaraTech Backend", version="1.0.0")

# Configure CORS to allow requests from the React Frontend
origins = [
    "http://localhost:8080",
    "http://localhost:5173",
    "https://evara-dashboard.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"]) # In prod, restrict this!

app.include_router(api_router, prefix="/api/v1")

# Setup logging
logger = setup_logging()

@app.on_event("startup")
async def startup_event():
    logger.info("Starting EvaraTech Backend...")
    # Initialize database tables
    await create_tables()
    # Auto-seed if database is new/empty
    await seed_db()
    await start_background_tasks()
    logger.info("Background tasks started.")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "EvaraTech Backend"}

@app.get("/")
async def root():
    return {"message": "Welcome to EvaraTech Backend API. Docs at /docs"}
