#!/bin/bash

# Create a read-only service account for Stats HQ dashboard
# This is separate from your ETL service account (which needs write permissions)

set -e

echo "🔐 Creating Stats HQ Service Account (Read-Only)"
echo "================================================"
echo ""

# Prompt for project ID
read -p "Enter your GCP Project ID: " PROJECT_ID

if [ -z "$PROJECT_ID" ]; then
    echo "❌ Project ID is required"
    exit 1
fi

# Set the project
gcloud config set project "$PROJECT_ID"

echo ""
echo "📝 Creating service account: statshq-dashboard..."

# Create the service account
gcloud iam service-accounts create statshq-dashboard \
    --display-name="Stats HQ Dashboard (Read-Only)" \
    --description="Read-only access to BigQuery for Stats HQ dashboard"

SERVICE_ACCOUNT_EMAIL="statshq-dashboard@${PROJECT_ID}.iam.gserviceaccount.com"

echo "✅ Service account created: $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "🔑 Granting BigQuery READ-ONLY permissions..."

# Grant ONLY read permissions (NOT write)
# BigQuery User - allows running queries
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/bigquery.user"

# BigQuery Data Viewer - allows reading table data
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/bigquery.dataViewer"

echo "✅ Read-only permissions granted"
echo ""
echo "📥 Downloading service account key..."

# Create the server directory if it doesn't exist
mkdir -p server

# Download the key file
gcloud iam service-accounts keys create server/gcp-key.json \
    --iam-account="$SERVICE_ACCOUNT_EMAIL"

echo "✅ Key downloaded to: server/gcp-key.json"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "================================================"
echo "Summary:"
echo "================================================"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Permissions: READ-ONLY (bigquery.user + bigquery.dataViewer)"
echo "Key File: server/gcp-key.json"
echo ""
echo "⚠️  IMPORTANT:"
echo "- This service account can ONLY READ data from BigQuery"
echo "- It CANNOT create, modify, or delete tables"
echo "- Keep your ETL service account separate (with write permissions)"
echo "- Never commit server/gcp-key.json to Git"
echo ""
echo "Next steps:"
echo "1. Update your .env file with GCP_PROJECT_ID=$PROJECT_ID"
echo "2. Update SQL queries in server/index.js to match your tables"
echo "3. Run: docker-compose up -d"
echo ""
