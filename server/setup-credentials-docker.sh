#!/bin/sh
# Setup script for BigQuery credentials in Docker container

echo "🔐 Setting up BigQuery credentials for Docker..."

# Check if the key file exists at the mounted location
if [ -f "/app/credentials/key.json" ]; then
    echo "✅ Credentials file found at: /app/credentials/key.json"
    
    # Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
    export GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/key.json
    echo "✅ GOOGLE_APPLICATION_CREDENTIALS set to: $GOOGLE_APPLICATION_CREDENTIALS"
    
    # Verify GCP_PROJECT_ID is set
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo "⚠️  Warning: GCP_PROJECT_ID environment variable is not set"
        echo "   Make sure to pass GCP_PROJECT_ID in docker-compose.yml"
    else
        echo "✅ GCP_PROJECT_ID is set to: $GCP_PROJECT_ID"
    fi
    
    echo ""
    echo "🎉 Setup complete! Starting server..."
else
    echo "❌ Error: Credentials file not found at /app/credentials/key.json"
    echo ""
    echo "To fix this:"
    echo "1. Make sure your gcp-key.json file exists in ./server/"
    echo "2. Check the volume mount in docker-compose.yml"
    exit 1
fi
