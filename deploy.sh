#!/bin/bash

echo "🚀 Starting deployment process..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

echo "🔧 Deploying backend to Railway..."
cd backend
railway login
railway init --name keye-spreadsheet-backend
railway up

echo "🔧 Deploying frontend to Vercel..."
cd ../frontend
vercel --prod

echo "✅ Deployment complete!"
echo "📝 Don't forget to update the NEXT_PUBLIC_API_URL in your Vercel environment variables" 