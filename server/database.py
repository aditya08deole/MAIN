"""
Database connection and session management.
Production-ready PostgreSQL connection for Supabase.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from config import get_settings
import ssl

settings = get_settings()

# Fix URL for asyncpg driver
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Remove any URL query parameters (asyncpg doesn't support sslmode in URL)
if "?" in db_url:
    db_url = db_url.split("?")[0]
    print("[INFO] Cleaned URL query parameters (SSL configured in connect_args)")

# Verify Supabase connection pooler usage
if "supabase.co" in db_url or "pooler.supabase.com" in db_url:
    if ":5432/" in db_url:
        print("[WARNING] DATABASE_URL uses port 5432 (direct connection)")
        print("          Supabase requires port 6543 (connection pooler) for external access")
    elif ":6543/" in db_url:
        print("[OK] Using Supabase connection pooler (port 6543)")
        
        # Detect region from URL
        if "aws-1-ap-northeast-2" in db_url:
            print("[OK] Region: Seoul (ap-northeast-2)")
        elif "aws-0-ap-south-1" in db_url:
            print("[OK] Region: Mumbai (ap-south-1)")

# Configure SSL for Supabase (required for all connections)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Create PostgreSQL engine with optimal settings
engine = create_async_engine(
    db_url,
    echo=False,
    pool_size=5,
    max_overflow=2,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "ssl": ssl_context,
        "server_settings": {"application_name": "evara_backend_simple"},
        "timeout": 30,
        "command_timeout": 60,
    },
    pool_timeout=30
)

# Create session factory
SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

# Base class for models
Base = declarative_base()


async def get_db():
    """
    Database session dependency for FastAPI.
    Usage: db: AsyncSession = Depends(get_db)
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables with retry logic."""
    import asyncio
    
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(1, max_retries + 1):
        try:
            async with asyncio.timeout(10):  # 10 second timeout
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
            print("[OK] Database tables initialized")
            return
        except asyncio.TimeoutError:
            print(f"[WARN] Database initialization timeout (attempt {attempt}/{max_retries})")
            if attempt < max_retries:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
        except Exception as e:
            print(f"[WARN] Database initialization error (attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
            else:
                print("[INFO] Database may already be initialized or will be created on first use")
