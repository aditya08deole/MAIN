"""
Database connection and session management.
Production-ready PostgreSQL connection for Supabase.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from config import get_settings
import ssl
import uuid
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# Fix URL for asyncpg driver
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://") and "+asyncpg" not in db_url:
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Remove URL query parameters — asyncpg requires SSL to be passed via connect_args,
# not as URL query strings like ?ssl=require or ?sslmode=require.
# SSL IS still enforced below via connect_args={"ssl": ssl_context}.
if "?" in db_url:
    db_url = db_url.split("?")[0]
    logger.debug("Stripped URL query parameters (e.g. ?ssl=require). SSL enforced via connect_args.")

# Verify Supabase connection pooler usage
if "supabase.co" in db_url or "pooler.supabase.com" in db_url:
    if ":5432/" in db_url:
        logger.warning("DATABASE_URL uses port 5432 (direct). Supabase requires port 6543 (pooler) for external access.")
    elif ":6543/" in db_url:
        logger.debug("Using Supabase connection pooler (port 6543)")

# Configure SSL for Supabase (required for all connections)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

from sqlalchemy.pool import NullPool

# Create PostgreSQL engine optimized for Supabase PgBouncer Transaction Mode
engine = create_async_engine(
    db_url,
    echo=False,
    # Use NullPool because PgBouncer handles the pooling already
    poolclass=NullPool,
    connect_args={
        "ssl": ssl_context,
        "timeout": 30,
        "command_timeout": 60,
        # Disable prepared statement cache for PgBouncer transaction mode.
        # Both keys cover different asyncpg versions.
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
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
            async def _create_tables():
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
            await asyncio.wait_for(_create_tables(), timeout=30)
            print("[OK] Database tables initialized")
            return
        except asyncio.TimeoutError:
            print(f"[ERROR] Database initialization timeout (attempt {attempt}/{max_retries})")
            if attempt < max_retries:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
        except Exception as e:
            print(f"[ERROR] Database initialization error (attempt {attempt}/{max_retries}): {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
            else:
                print("[INFO] Database may already be initialized or will be created on first use")
