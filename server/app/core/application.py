"""
Application orchestration layer - coordinates startup, shutdown, and dependency wiring.
Follows SOLID principles and dependency injection patterns.
"""
from typing import Dict, Optional
import time
from fastapi import FastAPI
from app.core.logging import setup_logging
from app.core.config import get_settings
from app.middleware.core_middleware import (
    HealthCheckService,
    RequestLoggingMiddleware,
    RateLimitMiddleware,
    create_request_logging_middleware,
    create_rate_limit_middleware
)

logger = setup_logging()


class ApplicationState:
    """
    Centralized application state management.
    Single Responsibility: State storage and retrieval.
    """
    
    def __init__(self):
        self.startup_time: float = 0
        self.health_checks: Dict[str, str] = {}
        self.health_check_service: Optional[HealthCheckService] = None
    
    def set_startup_time(self, timestamp: float) -> None:
        """Record application startup timestamp."""
        self.startup_time = timestamp
    
    def get_uptime_seconds(self) -> float:
        """Calculate application uptime in seconds."""
        if self.startup_time == 0:
            return 0
        return time.time() - self.startup_time
    
    def update_health_checks(self, checks: Dict[str, str]) -> None:
        """Update health check results."""
        self.health_checks = checks
    
    def get_health_summary(self) -> Dict:
        """Get comprehensive health summary."""
        return {
            "uptime_seconds": round(self.get_uptime_seconds()),
            "startup_checks": self.health_checks,
            "status": self._determine_overall_status()
        }
    
    def _determine_overall_status(self) -> str:
        """Determine overall system status from health checks."""
        if not self.health_checks:
            return "unknown"
        
        # Check for critical failures
        for check_name, result in self.health_checks.items():
            if check_name in ["database", "env_vars"] and "[ERROR]" in result:
                return "critical"
        
        # Check for warnings
        for result in self.health_checks.values():
            if "[WARN]" in result or "[ERROR]" in result:
                return "degraded"
        
        return "healthy"


class ApplicationLifecycle:
    """
    Manages application lifecycle events (startup, shutdown).
    Single Responsibility: Lifecycle orchestration.
    """
    
    def __init__(self, app_state: ApplicationState):
        self.app_state = app_state
        self.logger = logger
    
    async def startup(self) -> None:
        """
        Execute all startup procedures in proper order.
        Implements startup sequence with error handling.
        """
        self.logger.info("Starting EvaraTech Backend...")
        self.app_state.set_startup_time(time.time())
        
        # Initialize health check service
        self.app_state.health_check_service = HealthCheckService()
        
        # Run startup health checks
        await self._run_startup_health_checks()
        
        # Initialize database
        await self._initialize_database()
        
        # Seed initial data
        await self._seed_database()
        
        # Start background tasks
        await self._start_background_tasks()
        
        self.logger.info("EvaraTech Backend startup complete")
    
    async def shutdown(self) -> None:
        """
        Execute graceful shutdown procedures.
        Ensures clean resource cleanup.
        """
        self.logger.info("Shutting down EvaraTech Backend...")
        
        try:
            from app.db.session import engine
            await engine.dispose()
            self.logger.info("Database connections closed")
        except Exception as e:
            self.logger.error(f"Database shutdown error: {e}")
        
        self.logger.info("EvaraTech Backend shutdown complete")
    
    async def _run_startup_health_checks(self) -> None:
        """Execute and log startup health checks."""
        if not self.app_state.health_check_service:
            return
        
        checks = await self.app_state.health_check_service.run_all_checks(force=True)
        self.app_state.update_health_checks(checks)
        
        self.logger.info("=== STARTUP HEALTH CHECKS ===")
        for name, status in checks.items():
            self.logger.info(f"  {name}: {status}")
        self.logger.info("=============================")
    
    async def _initialize_database(self) -> None:
        """Initialize database tables and connections."""
        try:
            from app.db.session import create_tables
            await create_tables()
            self.logger.info("Database tables initialized")
        except Exception as e:
            self.logger.error(f"Database initialization failed: {e}")
            raise
    
    async def _seed_database(self) -> None:
        """Seed initial data if needed."""
        try:
            from app.services.seeder import seed_db
            await seed_db()
            self.logger.info("Database seeding complete")
        except Exception as e:
            self.logger.warning(f"Database seeding failed (may be expected): {e}")
    
    async def _start_background_tasks(self) -> None:
        """Start background processing tasks."""
        try:
            from app.core.background import start_background_tasks
            await start_background_tasks()
            self.logger.info("Background tasks started")
        except Exception as e:
            self.logger.error(f"Background task startup failed: {e}")
        
        # Initialize enhanced alert engine
        try:
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                from app.services.alert_engine import AlertEngine
                alert_engine = AlertEngine(db)
                await alert_engine.initialize()
                self.logger.info(f"Alert engine initialized: {alert_engine.active_tracker.size()} active alerts")
        except Exception as e:
            self.logger.error(f"Alert engine initialization failed: {e}")
        
        # Start telemetry batch processor
        try:
            from app.db.session import AsyncSessionLocal
            async with AsyncSessionLocal() as db:
                from app.services.telemetry_processor import TelemetryProcessor
                telemetry_processor = TelemetryProcessor(db)
                await telemetry_processor.start_batch_processor()
                self.logger.info("Telemetry batch processor started")
        except Exception as e:
            self.logger.error(f"Telemetry batch processor startup failed: {e}")


class ApplicationConfigurator:
    """
    Configures FastAPI application with middleware, routes, and settings.
    Single Responsibility: Application configuration.
    """
    
    def __init__(self, app: FastAPI):
        self.app = app
        self.settings = get_settings()
        self.logger = logger
    
    def configure_middleware(self) -> None:
        """Register all middleware in proper order."""
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.middleware.gzip import GZipMiddleware
        from fastapi.middleware.trustedhost import TrustedHostMiddleware
        
        # GZip compression (outermost for responses)
        self.app.add_middleware(GZipMiddleware, minimum_size=1000)
        
        # CORS (must be before other middleware that creates responses)
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=self.settings.cors_origins,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Trusted Host (security)
        allowed_hosts = ["*"]  # TODO: Restrict in production
        self.app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)
        
        # Custom middleware (via @app.middleware decorator is simpler for these)
        self.logger.info("Middleware configured successfully")
    
    def configure_exception_handlers(self) -> None:
        """Register global exception handlers."""
        from fastapi.exceptions import RequestValidationError
        from starlette.exceptions import HTTPException as StarletteHTTPException
        from app.core.errors import (
            http_exception_handler,
            validation_exception_handler,
            general_exception_handler,
            application_error_handler,
            ApplicationError
        )
        
        self.app.add_exception_handler(StarletteHTTPException, http_exception_handler)
        self.app.add_exception_handler(RequestValidationError, validation_exception_handler)
        self.app.add_exception_handler(ApplicationError, application_error_handler)
        self.app.add_exception_handler(Exception, general_exception_handler)
        
        self.logger.info("Exception handlers configured")
    
    def configure_routes(self) -> None:
        """Register API routes."""
        from app.api.api_v1.api import api_router
        
        self.app.include_router(api_router, prefix="/api/v1")
        self.logger.info("Routes configured")


class ApplicationFactory:
    """
    Factory for creating and configuring FastAPI application.
    Implements Factory pattern with dependency injection.
    """
    
    @staticmethod
    def create_app() -> tuple[FastAPI, ApplicationState, ApplicationLifecycle]:
        """
        Create and configure FastAPI application with all dependencies.
        
        Returns:
            Tuple of (FastAPI app, ApplicationState, ApplicationLifecycle)
        """
        # Create FastAPI instance with comprehensive metadata
        app = FastAPI(
            title="EvaraTech IoT Platform API",
            version="2.0.0",
            description="""
## EvaraTech Water Infrastructure Management System

Production-grade API for water distribution monitoring and management.

### Features
- **Device Management**: CRUD operations for IoT nodes (Sensors, Pumps, Tanks)
- **Real-Time Telemetry**: ThingSpeak integration with intelligent caching
- **Analytics Dashboard**: Aggregated statistics and system health
- **Multi-Tenant Administration**: Hierarchical organization management
- **Authentication**: Supabase JWT with RBAC

### Architecture
- **Rate Limiting**: Token bucket algorithm with burst capacity
- **Caching**: Redis-backed distributed cache with fallback
- **Health Monitoring**: Comprehensive system health checks
- **Structured Logging**: JSON logs with correlation IDs

### Authentication
All endpoints require valid Bearer token from Supabase Auth.
            """,
            contact={"name": "EvaraTech Engineering", "email": "dev@evaratech.com"},
            license_info={"name": "Proprietary"},
            openapi_tags=[
                {"name": "auth", "description": "Authentication & User Sync"},
                {"name": "nodes", "description": "Device/Node Management"},
                {"name": "dashboard", "description": "Dashboard Statistics"},
                {"name": "admin", "description": "Administration Panel"},
                {"name": "devices", "description": "Device Configuration"},
                {"name": "health", "description": "System Health Checks"},
                {"name": "websockets", "description": "Real-time WebSocket Events"},
            ]
        )
        
        # Create application state
        app_state = ApplicationState()
        
        # Create lifecycle manager
        lifecycle = ApplicationLifecycle(app_state)
        
        # Configure application
        configurator = ApplicationConfigurator(app)
        configurator.configure_exception_handlers()
        configurator.configure_middleware()
        configurator.configure_routes()
        
        # Register lifecycle events
        @app.on_event("startup")
        async def startup_event():
            await lifecycle.startup()
        
        @app.on_event("shutdown")
        async def shutdown_event():
            await lifecycle.shutdown()
        
        # Store state in app for access in endpoints
        app.state.app_state = app_state
        
        logger.info("Application factory completed")
        
        return app, app_state, lifecycle
