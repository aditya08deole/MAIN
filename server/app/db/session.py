from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import get_settings
import ssl

settings = get_settings()

# For PostgreSQL (Supabase), ensure the URL starts with postgresql+asyncpg://
# If settings.DATABASE_URL is just postgres:// or postgresql://, replace it
db_url = settings.DATABASE_URL
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url and db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Clean URL - remove any ssl/sslmode query parameters (asyncpg doesn't support them in URL)
if "?" in db_url:
    base_url = db_url.split("?")[0]
    print("[INFO] Cleaned URL query parameters (SSL configured in connect_args)")
    db_url = base_url

# Verify using port 6543 (pooler) not 5432 (direct)
if db_url and "supabase.co" in db_url:
    if ":5432/" in db_url:
        print("[WARNING] DATABASE_URL uses port 5432 (direct connection)")
        print("   Supabase requires port 6543 (connection pooler) for external access")
    elif ":6543/" in db_url:
        print("[OK] Using Supabase connection pooler (port 6543)")

# Configure SSL context for Supabase
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=5,          # Reduced for Supabase free tier (max ~10 connections)
    max_overflow=3,        # Conservative overflow
    pool_timeout=30,
    pool_recycle=300,      # Recycle connections every 5 min (Supabase may close idle)
    connect_args={
        "ssl": ssl_context,  # SSL configuration for asyncpg
        "server_settings": {"application_name": "evara_backend"},
        "command_timeout": 10,
    }
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def create_tables():
    from app.models.all_models import Base as ModelsBase
    import asyncio
    try:
        # Longer timeout for Supabase connection with better error handling
        async with asyncio.timeout(10):
            async with engine.begin() as conn:
                await conn.run_sync(ModelsBase.metadata.create_all)
        print("[OK] Database tables created/verified successfully")
    except asyncio.TimeoutError:
        print("[WARN] DATABASE CONNECTION TIMEOUT - This is normal if using Supabase with schema already deployed")
    except Exception as e:
        print(f"[WARN] DATABASE SETUP INFO: {e}")
        print("💡 If using Supabase, ensure schema is deployed via Supabase SQL Editor")
        # Don't raise error - allow app to start for development
