#!/bin/bash

echo "🚀 Pokemon GO Data Server - Deployment Script"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
# Check Node.js version
echo "🔍 Checking Node.js version..."
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi
echo "✅ Node.js version $(node --version) is compatible"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run linting
echo "🔍 Running ESLint..."
npm run lint

# Build the project
echo "🔨 Building project..."
npm run build

# Create public directory if it doesn't exist
echo "📁 Creating public directory..."
mkdir -p public/data

# Run the test
echo "🧪 Running test..."
node test-simple.js

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Deploy to Vercel: vercel --prod"
echo "2. Test the API endpoints"
echo "3. Integrate with your frontend application"
echo ""
echo "API Endpoints:"
echo "- GET /api/data?type=all"
echo "- GET /api/data?type=events"
echo "- GET /api/data?type=raid-bosses"
echo "- GET /api/data?type=game-master"
echo "- GET /api/status"
echo "- POST /api/trigger" 