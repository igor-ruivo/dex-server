#!/bin/bash

# Pokemon GO Data Aggregation Server Deployment Script

echo "🚀 Starting deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run linting
echo "🔍 Running linting..."
npm run lint

# Run tests
echo "🧪 Running tests..."
npm test

# Build the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully"
else
    echo "❌ Build failed"
    exit 1
fi

# Deploy to Vercel (if vercel CLI is installed)
if command -v vercel &> /dev/null; then
    echo "🚀 Deploying to Vercel..."
    vercel --prod
else
    echo "⚠️  Vercel CLI not found. Please install it with: npm i -g vercel"
    echo "📋 Manual deployment steps:"
    echo "1. Push your code to GitHub"
    echo "2. Connect your repository to Vercel"
    echo "3. Deploy from the Vercel dashboard"
fi

echo "🎉 Deployment process completed!" 