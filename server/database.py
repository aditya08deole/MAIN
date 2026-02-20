"""
Database connection and session management.
Simple async PostgreSQL connection with proper SSL configuration for Supabase.
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
if "supabase.co" in db_url:
    if ":5432/" in db_url:
        print("[WARNING] DATABASE_URL uses port 5432 (direct connection)")
        print("          Supabase requires port 6543 (connection pooler) for external access")
    elif ":6543/" in db_url:
        print("[OK] Using Supabase connection pooler (port 6543)")

# Configure SSL for Supabase
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Create async engine
engine = create_async_engine(
    db_url,
    echo=False,  # Set to True for SQL query logging
    pool_size=5,
    max_overflow=2,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=300,  # Recycle connections every 5 minutes
    connect_args={
        "ssl": ssl_context,
        "server_settings": {"application_name": "evara_backend_simple"},
        "timeout": 30,  # Connection timeout (30 seconds)
        "command_timeout": 60,  # Query timeout (60 seconds)
    },
    pool_timeout=30  # How long to wait for a connection from the pool
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
