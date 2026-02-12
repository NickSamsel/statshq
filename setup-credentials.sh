#!/bin/bash
# Setup script for BigQuery credentials in Codespaces

echo "🔐 Setting up BigQuery credentials..."

# Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
export GOOGLE_APPLICATION_CREDENTIALS=/workspaces/statshq/server/gcp-key.json

# Check if the key file exists
if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo "✅ Credentials file found at: $GOOGLE_APPLICATION_CREDENTIALS"
    
    # Add to .bashrc if not already there
    if ! grep -q "GOOGLE_APPLICATION_CREDENTIALS" ~/.bashrc; then
        echo "" >> ~/.bashrc
        echo "# BigQuery Credentials" >> ~/.bashrc
        echo "export GOOGLE_APPLICATION_CREDENTIALS=/workspaces/statshq/server/gcp-key.json" >> ~/.bashrc
        echo "✅ Added credentials to ~/.bashrc for future sessions"
    else
        echo "ℹ️  Credentials already in ~/.bashrc"
    fi
    
    # Verify GCP_PROJECT_ID is set
    if [ -z "$GCP_PROJECT_ID" ]; then
        echo "⚠️  Warning: GCP_PROJECT_ID environment variable is not set"
        echo "   Add it as a Codespace secret or run: export GCP_PROJECT_ID=your-project-id"
    else
        echo "✅ GCP_PROJECT_ID is set to: $GCP_PROJECT_ID"
    fi
    
    echo ""
    echo "🎉 Setup complete! You can now run:"
    echo "   cd server && npm install && npm run dev"
    echo "   (in another terminal) npm install && npm run dev"
else
    echo "❌ Error: Credentials file not found at $GOOGLE_APPLICATION_CREDENTIALS"
    echo ""
    echo "To fix this:"
    echo "1. Make sure your gcp-key.json file is in /workspaces/statshq/server/"
    echo "2. Or set GOOGLE_APPLICATION_CREDENTIALS to the correct path"
    exit 1
fi
