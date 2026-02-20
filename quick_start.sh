#!/bin/bash
# Quick Start Script for EvaraTech Platform
# This script helps you get the platform running quickly

echo "🚀 EvaraTech Platform Quick Start"
echo "=================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.10 or higher."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

echo "✅ Python and Node.js found"
echo ""

# Setup Backend
echo "📦 Setting up backend..."
cd server || exit

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit server/.env with your Supabase credentials!"
    else
        echo "❌ No .env.example found. Please create .env manually."
    fi
fi

cd ..

# Setup Frontend
echo ""
echo "📦 Setting up frontend..."
cd client || exit

npm install

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "📝 Please edit client/.env with your configuration!"
    else
        echo "❌ No .env.example found. Please create .env manually."
    fi
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit server/.env with your Supabase credentials"
echo "2. Edit client/.env with your API URL"
echo "3. Run the health check: cd server && python health_check.py"
echo "4. Start backend: cd server && uvicorn app.main:app --reload"
echo "5. Start frontend: cd client && npm run dev"
echo ""
echo "🌐 Access the app at http://localhost:5173"
