#!/bin/bash

# Stats HQ - Setup Helper Script
# This script helps you set up the BigQuery connection for Stats HQ

set -e

echo "🚀 Stats HQ Setup Helper"
echo "========================"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Do you want to overwrite it? (y/n)"
    read -r response
    if [[ "$response" != "y" ]]; then
        echo "Skipping .env creation."
    else
        create_env=true
    fi
else
    create_env=true
fi

if [ "$create_env" = true ]; then
    echo "📝 Creating .env file..."
    
    echo "Enter your Google Cloud Project ID:"
    read -r project_id
    
    echo "Enter the path to your service account key file (default: ./server/gcp-key.json):"
    read -r creds_path
    creds_path=${creds_path:-./server/gcp-key.json}
    
    cat > .env << EOF
GCP_PROJECT_ID=${project_id}
GOOGLE_APPLICATION_CREDENTIALS=${creds_path}
PORT=8080
FRONTEND_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:8080/api
EOF
    
    echo "✅ .env file created!"
fi

echo ""
echo "📦 Installing dependencies..."

# Install backend dependencies
if [ -d "server" ]; then
    echo "Installing backend dependencies..."
    cd server
    npm install
    cd ..
    echo "✅ Backend dependencies installed!"
else
    echo "⚠️  Server directory not found. Skipping backend installation."
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
npm install
echo "✅ Frontend dependencies installed!"

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Make sure your BigQuery dataset and tables are created (see SETUP_GUIDE.md)"
echo "2. Place your service account key file at: ${creds_path}"
echo "3. Start the backend: cd server && npm run dev"
echo "4. Start the frontend (in a new terminal): npm run dev"
echo ""
echo "📖 For detailed instructions, read SETUP_GUIDE.md"
echo ""
