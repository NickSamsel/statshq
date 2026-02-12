#!/bin/bash

# Setup script for GitHub Codespaces
# This script runs automatically when the Codespace starts

set -e

echo "🚀 Setting up Stats HQ in Codespaces..."

# Create server directory if it doesn't exist
mkdir -p server

# Check if GCP secrets are available
if [ -n "$GCP_SERVICE_ACCOUNT_KEY" ]; then
    echo "✅ Found GCP_SERVICE_ACCOUNT_KEY secret"
    echo "$GCP_SERVICE_ACCOUNT_KEY" > server/gcp-key.json
    chmod 600 server/gcp-key.json
    echo "✅ Service account key configured"
else
    echo "⚠️  Warning: GCP_SERVICE_ACCOUNT_KEY secret not found"
    echo "Please configure it in your repository Codespaces secrets"
fi

# Create .env file from Codespaces secrets
if [ -n "$GCP_PROJECT_ID" ]; then
    cat > .env << EOF
GCP_PROJECT_ID=$GCP_PROJECT_ID
GOOGLE_APPLICATION_CREDENTIALS=/workspaces/statshq/server/gcp-key.json
PORT=8080
FRONTEND_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8080/api
EOF
    echo "✅ Environment variables configured"
else
    echo "⚠️  Warning: GCP_PROJECT_ID secret not found"
fi

# Install dependencies
if [ -d "server" ]; then
    echo "📦 Installing backend dependencies..."
    cd server
    npm install
    cd ..
fi

echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the application:"
echo "  Terminal 1: cd server && npm run dev"
echo "  Terminal 2: npm run dev"
echo ""
