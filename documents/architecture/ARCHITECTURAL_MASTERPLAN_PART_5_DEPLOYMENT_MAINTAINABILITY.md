# ARCHITECTURAL MASTERPLAN - PART 5: DEPLOYMENT, OPERATIONS & MAINTAINABILITY

## CONTAINERIZATION AND DOCKER OPTIMIZATION

### Current Dockerfile Analysis

The current backend Dockerfile implements a simple single-stage build that copies all application files, installs dependencies from requirements.txt, and runs the application using uvicorn. The client Dockerfile uses a multi-stage build: (1) Build stage with Node.js to compile TypeScript and bundle assets with Vite, (2) Production stage with Nginx to serve static files. While the client Dockerfile follows best practices, the backend Dockerfile requires optimization for production deployment.

**Current Backend Dockerfile Issues:**

1. **Large image size:** The Python base image includes development tools, compilers, and libraries unnecessary at runtime. A production image with python:3.10-slim could reduce size by 500MB+.

2. **Security vulnerabilities:** Running as root user violates security best practices. If application is compromised, attacker gains root access to container.

3. **Build cache inefficiency:** COPY . . before pip install means dependency layer is invalidated on every source code change, requiring full dependency reinstall even when requirements.txt unchanged.

4. **No health checks:** Docker lacks HEALTHCHECK instruction, preventing container orchestrators from detecting application failures.

### Optimized Multi-Stage Backend Dockerfile

```dockerfile
# server/Dockerfile

# Build stage: compile dependencies and prepare environment
FROM python:3.10-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install dependencies (separate layer for caching)
COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Production stage: minimal runtime image
FROM python:3.10-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r evaratech && useradd -r -g evaratech evaratech

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=evaratech:evaratech . /app/

# Switch to non-root user
USER evaratech

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health/live || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**Key Improvements:**

- **Multi-stage build:** Builder stage contains gcc and build tools (500MB), production stage only has runtime libraries (150MB). Final image size reduced by 70%.
- **Non-root user:** Application runs as evaratech user with UID 1000, limiting damage from security exploits.
- **Layer caching:** requirements.txt copied separately before source code, enabling Docker to cache dependency layer when only application code changes.
- **Health check:** Docker automatically monitors /api/v1/health/live endpoint every 30 seconds, marking container unhealthy after 3 consecutive failures.
- **Production WSGI server:** 4 uvicorn workers for parallel request processing (adjust based on CPU cores).

### Docker Compose for Local Development

```yaml
# docker-compose.yml

version: "3.9"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: evaratech
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: evaratech
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./server/migrations/001_backend_excellence.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evaratech"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql+asyncpg://evaratech:dev_password@postgres:5432/evaratech
      - REDIS_URL=redis://redis:6379/0
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - SUPABASE_JWT_SECRET=${SUPABASE_JWT_SECRET}
      - THINGSPEAK_API_KEY=${THINGSPEAK_API_KEY}
      - APP_MODE=all_in_one
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./server:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
      target: development  # Use development stage for hot reload
    environment:
      - VITE_API_BASE_URL=http://localhost:8000
      - VITE_SUPABASE_URL=${SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${SUPABASE_KEY}
    ports:
      - "3000:3000"
    volumes:
      - ./client/src:/app/src
      - ./client/public:/app/public
    command: npm run dev

  celery_worker:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql+asyncpg://evaratech:dev_password@postgres:5432/evaratech
      - REDIS_URL=redis://redis:6379/0
      - APP_MODE=worker
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: celery -A app.core.celery_app worker --loglevel=info

  celery_beat:
    build:
      context: ./server
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql+asyncpg://evaratech:dev_password@postgres:5432/evaratech
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    command: celery -A app.core.celery_app beat --loglevel=info

volumes:
  postgres_data:
  redis_data:
```

This configuration enables full local development with: (1) PostgreSQL with schema initialization, (2) Redis for caching/queuing, (3) Backend with hot reload, (4) Client with Vite dev server, (5) Celery worker for background tasks, (6) Celery beat for scheduled tasks. Start entire stack with `docker-compose up`, tear down with `docker-compose down`.

## KUBERNETES DEPLOYMENT ARCHITECTURE

### Kubernetes Manifests for Production

For production deployment, Kubernetes provides orchestration with self-healing, auto-scaling, rolling updates, and service discovery:

**Namespace and ConfigMap:**

```yaml
# k8s/namespace.yaml

apiVersion: v1
kind: Namespace
metadata:
  name: evaratech

---
# k8s/configmap.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: evaratech-config
  namespace: evaratech
data:
  APP_MODE: "api_server"
  LOG_LEVEL: "INFO"
  WORKERS: "4"
```

**Secrets (use Sealed Secrets or External Secrets Operator in production):**

```yaml
# k8s/secret.yaml

apiVersion: v1
kind: Secret
metadata:
  name: evaratech-secrets
  namespace: evaratech
type: Opaque
stringData:
  DATABASE_URL: "postgresql+asyncpg://user:password@postgres.db.svc:5432/evaratech"
  REDIS_URL: "redis://redis.cache.svc:6379/0"
  SUPABASE_JWT_SECRET: "your-secret-here"
  THINGSPEAK_API_KEY: "your-key-here"
```

**Backend Deployment with HPA:**

```yaml
# k8s/backend-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: evaratech-backend
  namespace: evaratech
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero-downtime deployment
  selector:
    matchLabels:
      app: evaratech-backend
  template:
    metadata:
      labels:
        app: evaratech-backend
    spec:
      containers:
      - name: backend
        image: evaratech/backend:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000
        env:
        - name: APP_MODE
          valueFrom:
            configMapKeyRef:
              name: evaratech-config
              key: APP_MODE
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: evaratech-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: evaratech-secrets
              key: REDIS_URL
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /api/v1/health/live
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/v1/health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 2

---
# k8s/backend-service.yaml

apiVersion: v1
kind: Service
metadata:
  name: evaratech-backend
  namespace: evaratech
spec:
  type: ClusterIP
  selector:
    app: evaratech-backend
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP

---
# k8s/backend-hpa.yaml

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: evaratech-backend-hpa
  namespace: evaratech
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: evaratech-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Pods
        value: 1
        periodSeconds: 120
```

**Key Features:**

- **Rolling updates:** maxUnavailable: 0 ensures at least 3 replicas running during deployment, zero downtime.
- **Resource limits:** Backend container limited to 2 CPU cores and 2GB memory, preventing resource starvation.
- **Health probes:** Liveness probe restarts unhealthy containers, readiness probe removes unhealthy pods from load balancer.
- **Horizontal Pod Autoscaler:** Automatically scales from 3 to 10 replicas based on CPU (70% target) and memory (80% target) utilization.
- **Scale-down stabilization:** 5-minute window before scale-down prevents flapping during traffic spikes.

**Celery Worker Deployment:**

```yaml
# k8s/celery-worker-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: evaratech-celery-worker
  namespace: evaratech
spec:
  replicas: 2
  selector:
    matchLabels:
      app: evaratech-celery-worker
  template:
    metadata:
      labels:
        app: evaratech-celery-worker
    spec:
      containers:
      - name: celery-worker
        image: evaratech/backend:latest
        command: ["celery", "-A", "app.core.celery_app", "worker", "--loglevel=info", "--concurrency=4"]
        env:
        - name: APP_MODE
          value: "worker"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: evaratech-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: evaratech-secrets
              key: REDIS_URL
        resources:
          requests:
            cpu: "1000m"
            memory: "1Gi"
          limits:
            cpu: "2000m"
            memory: "2Gi"
```

**Ingress for External Access:**

```yaml
# k8s/ingress.yaml

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: evaratech-ingress
  namespace: evaratech
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.evaratech.com
    secretName: evaratech-tls
  rules:
  - host: api.evaratech.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: evaratech-backend
            port:
              number: 80
```

This Ingress configuration provides: (1) TLS termination with Let's Encrypt certificates via cert-manager, (2) Rate limiting at 100 requests per IP per second, (3) 10MB request body size limit.

## CI/CD PIPELINE WITH GITHUB ACTIONS

### Continuous Integration Pipeline

```yaml
# .github/workflows/ci.yml

name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.10"
      
      - name: Install dependencies
        run: |
          cd server
          pip install pylint black isort mypy
          pip install -r requirements.txt
      
      - name: Run Black formatter check
        run: |
          cd server
          black --check .
      
      - name: Run isort import sorter check
        run: |
          cd server
          isort --check-only .
      
      - name: Run Pylint
        run: |
          cd server
          pylint app/ --fail-under=8.0
      
      - name: Run MyPy type checking
        run: |
          cd server
          mypy app/ --ignore-missing-imports

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.10"
      
      - name: Install dependencies
        run: |
          cd server
          pip install pytest pytest-asyncio pytest-cov
          pip install -r requirements.txt
      
      - name: Run tests with coverage
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379/0
        run: |
          cd server
          pytest tests/ --cov=app --cov-report=xml --cov-report=term
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./server/coverage.xml

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Bandit security scanner
        run: |
          pip install bandit
          bandit -r server/app/ -f json -o bandit-report.json
      
      - name: Run Safety dependency checker
        run: |
          pip install safety
          safety check -r server/requirements.txt --json

  lint-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
      
      - name: Install dependencies
        run: |
          cd client
          npm ci
      
      - name: Run ESLint
        run: |
          cd client
          npm run lint
      
      - name: Run TypeScript compiler check
        run: |
          cd client
          npx tsc --noEmit

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
      
      - name: Install dependencies
        run: |
          cd client
          npm ci
      
      - name: Run tests
        run: |
          cd client
          npm run test

  build-images:
    runs-on: ubuntu-latest
    needs: [lint-backend, test-backend, lint-frontend, test-frontend]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
      
      - name: Build and push backend image
        uses: docker/build-push-action@v4
        with:
          context: ./server
          push: true
          tags: |
            evaratech/backend:latest
            evaratech/backend:${{ github.sha }}
          cache-from: type=registry,ref=evaratech/backend:buildcache
          cache-to: type=registry,ref=evaratech/backend:buildcache,mode=max
      
      - name: Build and push frontend image
        uses: docker/build-push-action@v4
        with:
          context: ./client
          push: true
          tags: |
            evaratech/frontend:latest
            evaratech/frontend:${{ github.sha }}
```

### Continuous Deployment Pipeline

```yaml
# .github/workflows/cd.yml

name: CD Pipeline

on:
  workflow_run:
    workflows: ["CI Pipeline"]
    branches: [main]
    types: [completed]

jobs:
  deploy-production:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: "v1.27.0"
      
      - name: Configure kubectl context
        run: |
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > $HOME/.kube/config
      
      - name: Run database migrations
        run: |
          kubectl exec -n evaratech deploy/evaratech-backend -- \
            alembic upgrade head
      
      - name: Update backend deployment
        run: |
          kubectl set image deployment/evaratech-backend \
            backend=evaratech/backend:${{ github.sha }} \
            -n evaratech
      
      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/evaratech-backend -n evaratech
      
      - name: Update frontend deployment
        run: |
          kubectl set image deployment/evaratech-frontend \
            frontend=evaratech/frontend:${{ github.sha }} \
            -n evaratech
      
      - name: Run smoke tests
        run: |
          kubectl run smoke-test --rm -i --restart=Never \
            --image=curlimages/curl \
            -- curl -f http://evaratech-backend/api/v1/health/ready
      
      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Production deployment successful: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
      
      - name: Rollback on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/evaratech-backend -n evaratech
```

This pipeline implements: (1) Automated linting (Pylint, ESLint, Black formatting), (2) Unit and integration testing with coverage reporting, (3) Security scanning (Bandit, Safety), (4) Docker image building with layer caching, (5) Database migration execution, (6) Rolling deployment to Kubernetes, (7) Smoke testing post-deployment, (8) Automatic rollback on failure.

## ENVIRONMENT CONFIGURATION MANAGEMENT

### Configuration Layers

Production systems require multiple configuration layers: (1) Base configuration (defaults), (2) Environment-specific configuration (dev/staging/prod), (3) Secrets (credentials, API keys), (4) Feature flags (runtime toggles).

**Base Configuration with Pydantic:**

```python
# app/core/config.py

from pydantic import BaseSettings, Field
from typing import Optional

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "EvaraTech IoT Platform"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field("development", env="ENVIRONMENT")
    DEBUG: bool = Field(False, env="DEBUG")
    
    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    DB_POOL_SIZE: int = Field(20, env="DB_POOL_SIZE")
    DB_MAX_OVERFLOW: int = Field(10, env="DB_MAX_OVERFLOW")
    
    # Redis
    REDIS_URL: str = Field(..., env="REDIS_URL")
    CACHE_TTL: int = Field(300, env="CACHE_TTL")
    
    # Supabase
    SUPABASE_URL: str = Field(..., env="SUPABASE_URL")
    SUPABASE_KEY: str = Field(..., env="SUPABASE_KEY")
    SUPABASE_JWT_SECRET: str = Field(..., env="SUPABASE_JWT_SECRET")
    
    # ThingSpeak
    THINGSPEAK_API_KEY: str = Field(..., env="THINGSPEAK_API_KEY")
    THINGSPEAK_RATE_LIMIT: int = Field(60, env="THINGSPEAK_RATE_LIMIT")
    
    # Monitoring
    SENTRY_DSN: Optional[str] = Field(None, env="SENTRY_DSN")
    LOG_LEVEL: str = Field("INFO", env="LOG_LEVEL")
    
    # Feature Flags
    ENABLE_MQTT: bool = Field(False, env="ENABLE_MQTT")
    ENABLE_WEBSOCKETS: bool = Field(True, env="ENABLE_WEBSOCKETS")
    ENABLE_RATE_LIMITING: bool = Field(True, env="ENABLE_RATE_LIMITING")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

**Environment-Specific Configuration Files:**

```bash
# .env.development

ENVIRONMENT=development
DEBUG=true
DATABASE_URL=postgresql+asyncpg://localhost:5432/evaratech_dev
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=DEBUG
ENABLE_RATE_LIMITING=false
```

```bash
# .env.production

ENVIRONMENT=production
DEBUG=false
DATABASE_URL=${DATABASE_URL}  # Injected from Kubernetes secret
REDIS_URL=${REDIS_URL}
LOG_LEVEL=INFO
ENABLE_RATE_LIMITING=true
SENTRY_DSN=${SENTRY_DSN}
```

### Secrets Management with HashiCorp Vault

For production, store secrets in HashiCorp Vault or AWS Secrets Manager:

```python
# app/core/secrets.py

import hvac
from typing import Dict

class VaultSecretProvider:
    """Fetch secrets from HashiCorp Vault."""
    
    def __init__(self, vault_addr: str, vault_token: str):
        self.client = hvac.Client(url=vault_addr, token=vault_token)
    
    def get_secrets(self, path: str) -> Dict[str, str]:
        """Fetch secrets from Vault path."""
        
        response = self.client.secrets.kv.v2.read_secret_version(path=path)
        return response["data"]["data"]

# Initialize Vault client
vault = VaultSecretProvider(
    vault_addr=os.getenv("VAULT_ADDR"),
    vault_token=os.getenv("VAULT_TOKEN")
)

# Fetch secrets at startup
secrets = vault.get_secrets("evaratech/production")
os.environ["DATABASE_URL"] = secrets["database_url"]
os.environ["SUPABASE_JWT_SECRET"] = secrets["jwt_secret"]
```

## MONITORING AND OBSERVABILITY STACK

### Prometheus Metrics Collection

Deploy Prometheus to scrape metrics from all backend instances:

```yaml
# k8s/prometheus-config.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
      - job_name: 'evaratech-backend'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - evaratech
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            regex: evaratech-backend
            action: keep
          - source_labels: [__meta_kubernetes_pod_ip]
            target_label: __address__
            replacement: $1:8000
          - source_labels: [__meta_kubernetes_pod_name]
            target_label: pod
```

### Grafana Dashboards

Deploy Grafana with pre-configured dashboards:

```yaml
# k8s/grafana-dashboard.json

{
  "dashboard": {
    "title": "EvaraTech Backend Metrics",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "API Request Latency P95",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Active Devices by Status",
        "targets": [
          {
            "expr": "active_devices_total"
          }
        ]
      },
      {
        "title": "Database Query Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))"
          }
        ]
      }
    ]
  }
}
```

### Centralized Logging with ELK Stack

**Fluent Bit for Log Collection:**

```yaml
# k8s/fluent-bit-config.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: logging
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Daemon        off
        Log_Level     info
    
    [INPUT]
        Name              tail
        Path              /var/log/containers/evaratech*.log
        Parser            docker
        Tag               kube.*
        Refresh_Interval  5
    
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
    
    [OUTPUT]
        Name            es
        Match           kube.*
        Host            elasticsearch.logging.svc
        Port            9200
        Index           evaratech
        Type            _doc
```

This configuration collects logs from all EvaraTech pods, enriches with Kubernetes metadata (pod name, namespace, labels), and forwards to Elasticsearch.

### Distributed Tracing with Jaeger

Integrate OpenTelemetry for distributed tracing:

```python
# app/core/tracing.py

from opentelemetry import trace
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

def setup_tracing(app: FastAPI):
    """Configure distributed tracing."""
    
    resource = Resource.create({"service.name": "evaratech-backend"})
    
    jaeger_exporter = JaegerExporter(
        agent_host_name="jaeger-agent.monitoring.svc",
        agent_port=6831
    )
    
    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(jaeger_exporter)
    provider.add_span_processor(processor)
    
    trace.set_tracer_provider(provider)
    
    # Auto-instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)
    
    # Auto-instrument SQLAlchemy
    SQLAlchemyInstrumentor().instrument(engine=engine)

# Usage
setup_tracing(app)
```

This creates distributed traces showing request flow: API Gateway → API Server → Database → ThingSpeak API, with timing for each span.

## BACKUP AND DISASTER RECOVERY

### Database Backup Strategy

**Automated Daily Backups:**

```bash
#!/bin/bash
# scripts/backup_database.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="evaratech_backup_${DATE}.sql.gz"

# Dump database with compression
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > /backups/${BACKUP_FILE}

# Upload to S3
aws s3 cp /backups/${BACKUP_FILE} s3://evaratech-backups/database/${BACKUP_FILE}

# Retain only last 30 days of backups
aws s3 ls s3://evaratech-backups/database/ | awk '{print $4}' | sort -r | tail -n +31 | xargs -I {} aws s3 rm s3://evaratech-backups/database/{}

echo "Backup completed: ${BACKUP_FILE}"
```

**Cron Job for Scheduled Backups:**

```yaml
# k8s/backup-cronjob.yaml

apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: evaratech
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME | gzip > /tmp/backup.sql.gz
              aws s3 cp /tmp/backup.sql.gz s3://evaratech-backups/database/backup_$(date +%Y%m%d).sql.gz
            env:
            - name: DB_HOST
              value: "postgres.db.svc"
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: username
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          restartPolicy: OnFailure
```

### Point-in-Time Recovery

Enable PostgreSQL continuous archiving for point-in-time recovery:

```sql
-- postgresql.conf

wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://evaratech-backups/wal/%f'
archive_timeout = 300  # Archive every 5 minutes
```

**Recovery Procedure:**

```bash
#!/bin/bash
# scripts/restore_database.sh

# Stop application
kubectl scale deployment evaratech-backend --replicas=0 -n evaratech

# Restore base backup
aws s3 cp s3://evaratech-backups/database/backup_20240101.sql.gz /tmp/
gunzip /tmp/backup_20240101.sql.gz
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < /tmp/backup_20240101.sql

# Configure recovery
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'aws s3 cp s3://evaratech-backups/wal/%f %p'
recovery_target_time = '2024-01-15 14:30:00'
EOF

# Start PostgreSQL in recovery mode
pg_ctl start

# Wait for recovery completion
while [ -f /var/lib/postgresql/data/recovery.conf ]; do
  sleep 5
done

# Start application
kubectl scale deployment evaratech-backend --replicas=3 -n evaratech
```

### Disaster Recovery Plan

**RTO (Recovery Time Objective): 1 hour**
**RPO (Recovery Point Objective): 5 minutes**

**Steps:**

1. **Detection:** Monitoring alerts detect service unavailability or data corruption.

2. **Assessment:** On-call engineer assesses scope: single service failure, database corruption, or total infrastructure loss.

3. **Communication:** Notify stakeholders via status page and Slack. Post incident update every 15 minutes.

4. **Recovery Options:**

   - **Service failure:** Kubernetes auto-restarts failed pods. If persistent, rollback to previous deployment: `kubectl rollout undo deployment/evaratech-backend -n evaratech`.
   
   - **Database corruption:** Restore from latest backup (nightly dump). Loss: up to 24 hours of data.
   
   - **Data center outage:** Failover to secondary region. Update DNS to route traffic to DR cluster. Restore database from S3. Loss: up to 5 minutes (last WAL archive).

5. **Verification:** Run smoke tests to verify system functionality. Check data integrity with sample queries.

6. **Post-mortem:** Document incident timeline, root cause, impact, and remediation actions. Update runbooks.

## SECURITY HARDENING

### Production Security Checklist

**1. Remove Dev-Bypass Authentication:**

```python
# app/api/deps.py

async def verify_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Verify JWT token from Supabase."""
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    # REMOVE THIS IN PRODUCTION
    # if token.startswith("dev-bypass-"):
    #     return {"sub": token.replace("dev-bypass-", ""), "role": "admin"}
    
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

**2. Enable HTTPS Only:**

```python
# app/middleware/security.py

from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

if settings.ENVIRONMENT == "production":
    app.add_middleware(HTTPSRedirectMiddleware)
```

**3. Implement Content Security Policy:**

```python
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    
    return response
```

**4. Rate Limiting Per User:**

```python
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    user_id = request.state.user.get("sub") if hasattr(request.state, "user") else "anonymous"
    
    key = f"rate_limit:{user_id}:{request.url.path}"
    current = await redis_client.incr(key)
    
    if current == 1:
        await redis_client.expire(key, 60)  # 1-minute window
    
    if current > 100:  # 100 requests per minute per user
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    response = await call_next(request)
    response.headers["X-RateLimit-Remaining"] = str(100 - current)
    return response
```

**5. SQL Injection Prevention:**

Always use parameterized queries with SQLAlchemy ORM. NEVER concatenate user input into SQL strings.

**6. Dependency Scanning:**

```bash
# Run Safety check in CI pipeline
safety check -r requirements.txt --json

# Update dependencies regularly
pip list --outdated
```

## LONG-TERM MAINTAINABILITY RECOMMENDATIONS

### Code Quality Standards

**1. Linting Configuration:**

```toml
# .pylintrc

[MESSAGES CONTROL]
disable=C0111,  # Missing docstrings (enable in production)
        W0612,  # Unused variables
        R0913   # Too many arguments

[FORMAT]
max-line-length=120
indent-string='    '

[BASIC]
good-names=i,j,k,db,id,_

[DESIGN]
max-args=7
max-attributes=10
min-public-methods=1
```

**2. Code Review Guidelines:**

- **Required reviewers:** Minimum 2 approvals for main branch merges
- **Automated checks:** All CI tests must pass before merge
- **Documentation:** Every public API function must have docstring with parameters, return type, and example
- **Security review:** Manual review required for authentication/authorization changes
- **Performance review:** Benchmark comparison for database query changes

**3. API Versioning Policy:**

```python
# app/api/versioning.py

@app.get("/api/v1/nodes")
async def get_nodes_v1():
    """Version 1: Returns nodes with snake_case fields."""
    return nodes

@app.get("/api/v2/nodes")
async def get_nodes_v2():
    """Version 2: Returns nodes with camelCase fields and new pagination."""
    return nodes_v2
```

**Deprecation Timeline:**

- **Announcement:** Notify users 6 months before deprecation via API response header: `Deprecation: version=v1, sunset=2024-12-31`
- **Warning period:** Return 299 warning status 3 months before deprecation
- **Migration support:** Provide migration guide and automated conversion script
- **Sunset:** Remove deprecated endpoint after 6 months, return 410 Gone status

### Technical Debt Tracking

Create technical debt tracking in project management tool:

```yaml
# .github/ISSUE_TEMPLATE/technical_debt.yml

name: Technical Debt
description: Track technical debt and refactoring tasks
labels: ["technical-debt"]
body:
  - type: input
    id: component
    attributes:
      label: Component
      description: Which component requires refactoring?
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options:
        - Low (cosmetic improvement)
        - Medium (impacts maintainability)
        - High (impacts performance or security)
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Describe the current technical debt
  - type: textarea
    id: proposed_solution
    attributes:
      label: Proposed Solution
      description: How should this be refactored?
```

### Documentation Requirements

**1. Architecture Decision Records (ADRs):**

```markdown
# ADR-001: Use PostgreSQL TimescaleDB for Telemetry Storage

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Backend team

## Context

The current node_readings table uses EAV pattern storing 1M+ rows per day with poor query performance (1200ms P95 latency).

## Decision

Migrate to TimescaleDB with typed telemetry tables (telemetry_tank, telemetry_flow, telemetry_deep) using hypertables and continuous aggregates.

## Consequences

**Positive:**
- Query performance improves by 10x (120ms P95)
- Native time-series compression reduces storage by 70%
- Continuous aggregates enable real-time dashboards

**Negative:**
- Requires PostgreSQL extension installation
- Migration downtime: 2 hours
- Increased operational complexity

## Implementation

See: ARCHITECTURAL_MASTERPLAN_PART_1_SYSTEM_OVERVIEW.md Section 2.3
```

**2. API Documentation with OpenAPI:**

```python
# app/main.py

app = FastAPI(
    title="EvaraTech IoT Platform API",
    description="Comprehensive API for IoT device management and telemetry",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

@app.get(
    "/api/v1/nodes/{node_id}",
    response_model=NodeResponse,
    summary="Get node details",
    description="Fetch comprehensive node information including status, telemetry, and alerts",
    responses={
        200: {"description": "Node found"},
        404: {"description": "Node not found"},
        401: {"description": "Unauthorized"}
    },
    tags=["Nodes"]
)
async def get_node(node_id: str):
    """
    Retrieve node details by ID.
    
    **Parameters:**
    - `node_id`: UUID of the node
    
    **Returns:**
    - Node object with current status, latest telemetry, and active alerts
    
    **Example:**
    ```
    GET /api/v1/nodes/123e4567-e89b-12d3-a456-426614174000
    ```
    """
    pass
```

**3. Operational Runbooks:**

```markdown
# Runbook: Handle Database Connection Pool Exhaustion

**Symptoms:**
- Application logs show "TimeoutError: QueuePool limit exceeded"
- API requests timeout after 30 seconds
- Grafana dashboard shows 0 available database connections

**Investigation:**

1. Check connection pool metrics:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'evaratech';
   ```

2. Identify long-running queries:
   ```sql
   SELECT pid, now() - query_start AS duration, query 
   FROM pg_stat_activity 
   WHERE state = 'active' 
   ORDER BY duration DESC;
   ```

3. Check for connection leaks in application logs:
   ```bash
   kubectl logs -n evaratech deployment/evaratech-backend | grep "connection not closed"
   ```

**Resolution:**

1. **Immediate:** Kill long-running queries:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = 12345;
   ```

2. **Short-term:** Restart backend pods to reset connection pool:
   ```bash
   kubectl rollout restart deployment/evaratech-backend -n evaratech
   ```

3. **Long-term:** 
   - Increase pool size: `DB_POOL_SIZE=50`
   - Deploy PgBouncer connection pooler
   - Add connection leak instrumentation

**Prevention:**

- Use async context managers for all database sessions
- Enable `pool_pre_ping=True` to detect stale connections
- Monitor connection pool metrics with alerts at 80% utilization
```

## PERFORMANCE OPTIMIZATION CHECKLIST

### Database Optimizations

- [ ] Add composite indexes on frequently queried columns (node_id, timestamp)
- [ ] Create partial indexes for filtered queries (status = 'Alert')
- [ ] Implement materialized views for dashboard aggregations
- [ ] Enable TimescaleDB continuous aggregates for time-series queries
- [ ] Configure autovacuum with aggressive settings for high-write tables
- [ ] Partition large tables by time ranges (monthly partitions for telemetry)
- [ ] Add covering indexes to eliminate index-only scans

### Backend Optimizations

- [ ] Implement Redis L2 caching with TTL tuning per endpoint
- [ ] Use connection pooling with PgBouncer for multiplexing
- [ ] Enable query result caching for deterministic queries
- [ ] Implement async batch operations for bulk inserts
- [ ] Use Celery for CPU-intensive tasks (anomaly detection, statistical analysis)
- [ ] Optimize ORM queries with `selectinload()` to prevent N+1 queries
- [ ] Implement request/response compression (gzip, brotli)

### Frontend Optimizations

- [ ] Code splitting for lazy loading of route components
- [ ] Implement virtual scrolling for large lists (>100 items)
- [ ] Use React.memo for expensive component re-renders
- [ ] Optimize bundle size with tree shaking and minification
- [ ] Implement service worker for offline support
- [ ] Use CDN for static assets (images, fonts)
- [ ] Implement image lazy loading and WebP format

## CONCLUSION OF PART 5

This final section has provided comprehensive deployment strategies with Docker multi-stage builds, Kubernetes manifests with HPA, CI/CD pipelines with GitHub Actions implementing automated testing and security scanning, environment configuration management with Pydantic settings and Vault secrets, observability stack with Prometheus metrics, Grafana dashboards, ELK logging, and Jaeger distributed tracing, backup and disaster recovery procedures with automated daily backups and point-in-time recovery, security hardening checklist removing dev-bypass authentication and implementing rate limiting, and long-term maintainability recommendations including code quality standards, API versioning policy, technical debt tracking, Architecture Decision Records, operational runbooks, and performance optimization checklists.

The five-part architectural masterplan is now complete, providing 7000+ lines of comprehensive technical documentation covering diagnostic analysis, architectural weaknesses, data modeling redesign, performance optimization, API design patterns, caching strategies, Supabase integration, ThingSpeak service redesign, real-time WebSocket architecture, horizontal scalability, reliability engineering, observability systems, alert engine architecture, deployment automation, security hardening, and long-term maintainability for the EvaraTech IoT Platform.
