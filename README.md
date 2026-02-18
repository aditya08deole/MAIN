# EvaraTech IoT Platform

Next-Gen Water Management System with AI-driven insights, multi-tenant architecture, and real-time telemetry.

## 🌟 System Overview

EvaraTech is a comprehensive IoT platform designed for monitoring and managing water distribution networks. It features a robust backend for handling device telemetry, a modern React frontend for visualization, and an AI assistant for operational support.

### Key Features
*   **Multi-Tenancy**: Hierarchical data model (Organization -> Region -> Community -> Customer).
*   **Real-Time Telemetry**: Integation with ThingSpeak for live sensor data.
*   **AI Analytics**: Predictive maintenance (days to empty) and anomaly detection.
*   **Smart Alerts**: Customizable alert rules with multi-channel notifications.
*   **Device Twin**: Digital twin capability with desired vs. reported state synchronization.
*   **Secure Access**: Role-Based Access Control (RBAC) via Supabase Auth.

## 🏗️ Architecture

*   **Frontend**: React, Vite, TailwindCSS (located in `client/`)
*   **Backend**: Python, FastAPI, SQLAlchemy (located in `server/`)
*   **Database**: PostgreSQL (Supabase)
*   **Auth**: Supabase Auth (JWT)
*   **IoT Broker**: ThingSpeak
*   **Deployment**: Render (Dockerized Backend + Static Frontend)

## 🚀 Getting Started

### Prerequisites
*   Node.js v18+
*   Python 3.10+
*   PostgreSQL
*   Supabase Account
*   ThingSpeak Account

### Local Development

1.  **Clone the Repository**
    ```bash
    git clone <repo-url>
    cd evara-platform
    ```

2.  **Backend Setup**
    ```bash
    cd server
    python -m venv venv
    source venv/bin/activate  # or venv\Scripts\activate on Windows
    pip install -r requirements.txt
    
    # Configure Environment
    cp .env.example .env
    # Edit .env with your credentials
    
    # Run Server
    uvicorn main:app --reload
    ```
    API Docs available at: `http://localhost:8000/docs`

3.  **Frontend Setup**
    ```bash
    cd client
    npm install
    
    # Run Client
    npm run dev
    ```
    App available at: `http://localhost:5173`

## ⚙️ Environment Variables

Create a `.env` file in `server/` with the following:

```ini
# Core
PROJECT_NAME="EvaraTech IoT"
API_V1_STR="/api/v1"
SECRET_KEY="your-super-secret-key"

# Database
DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db"

# Supabase
SUPABASE_URL="https://xyz.supabase.co"
SUPABASE_KEY="your-anon-key"
SUPABASE_JWT_SECRET="your-jwt-secret"

# ThingSpeak
THINGSPEAK_API_KEY="your-api-key"

# Logging
LOG_LEVEL="INFO"
```

## 📦 Deployment (Render)

The project is configured for Render.com via `render.yaml`.
1.  Connect your GitHub repository to Render.
2.  Select "Blueprints" and pick this repo.
3.  Render will automatically deploy the Backend (Docker) and Frontend (Static Site).

## 🔒 Security

*   **RBAC**: Strict role enforcement (Super Admin, Region Admin, Community Admin).
*   **RLS**: Row-Level Security logic implemented in API layer.
*   **Audit Logs**: All critical actions are logged.
*   **Rate Limiting**: Public endpoints are protected.

---
© 2024 EvaraTech. All Rights Reserved.
