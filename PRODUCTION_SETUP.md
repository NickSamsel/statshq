# Production Setup Guide

Since you already have your GCP project and BigQuery infrastructure built, follow this streamlined setup.

## Prerequisites ✅

You already have:
- ✅ Google Cloud Project with BigQuery enabled
- ✅ BigQuery dataset and tables created
- ✅ Data infrastructure in place

You need:
- Service account key file for BigQuery access

---

## Quick Production Setup

### 1. Get Your Service Account Key

If you already have a service account:

```bash
# List existing service accounts
gcloud iam service-accounts list --project=YOUR_PROJECT_ID

# Create a new key for existing service account
gcloud iam service-accounts keys create server/gcp-key.json \
    --iam-account=SERVICE_ACCOUNT_EMAIL
```

If you need to create a new service account:

```bash
# Create service account
gcloud iam service-accounts create statshq-api \
    --display-name="Stats HQ API"

# Grant BigQuery permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:statshq-api@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:statshq-api@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataViewer"

# Download key
gcloud iam service-accounts keys create server/gcp-key.json \
    --iam-account=statshq-api@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### 2. Configure Environment

Create `.env` file:

```bash
cat > .env << EOF
GCP_PROJECT_ID=your-actual-project-id
GOOGLE_APPLICATION_CREDENTIALS=./server/gcp-key.json
PORT=8080
FRONTEND_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8080/api
EOF
```

### 3. Update SQL Queries

Edit `server/index.js` to match your actual BigQuery tables:

```javascript
// Example: Update with your actual dataset and table names
const query = `
  SELECT 
    team_name as name,
    wins as value
  FROM \`${process.env.GCP_PROJECT_ID}.your_dataset.your_table\`
  WHERE season = '2024'
  ORDER BY wins DESC
  LIMIT 10
`;
```

### 4. Run with Docker

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Check health
curl http://localhost:8080/health

# Test API
curl http://localhost:8080/api/nba
```

### 5. Deploy to Production

#### Option A: Google Cloud Run (Recommended)

```bash
# Build and push backend
cd server
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/statshq-api
gcloud run deploy statshq-api \
  --image gcr.io/YOUR_PROJECT_ID/statshq-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID

# Build and push frontend
cd ..
docker build -t gcr.io/YOUR_PROJECT_ID/statshq-frontend .
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/statshq-frontend
gcloud run deploy statshq-frontend \
  --image gcr.io/YOUR_PROJECT_ID/statshq-frontend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars VITE_API_BASE_URL=https://statshq-api-xxx.run.app/api
```

**Note**: When deploying to Cloud Run, you **don't need** the service account key file. Cloud Run uses Workload Identity:

```javascript
// In server/index.js for Cloud Run, just use:
const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID
  // No keyFilename needed - uses default credentials
});
```

#### Option B: Google Kubernetes Engine (GKE)

Use Workload Identity instead of key files:

```bash
# Create GKE cluster
gcloud container clusters create statshq-cluster \
  --workload-pool=YOUR_PROJECT_ID.svc.id.goog

# Enable Workload Identity
gcloud iam service-accounts add-iam-policy-binding \
  statshq-api@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:YOUR_PROJECT_ID.svc.id.goog[default/statshq-api]"
```

#### Option C: VM or Traditional Server

Keep the service account key file approach as configured.

---

## Security Best Practices for Production

### ✅ DO:
1. **Use Workload Identity** on Cloud Run/GKE (no key files needed)
2. **Rotate keys regularly** if using key files (every 90 days)
3. **Use Secret Manager** for storing keys:
   ```bash
   # Store key in Secret Manager
   gcloud secrets create statshq-key --data-file=server/gcp-key.json
   ```
4. **Set up monitoring** with Cloud Logging
5. **Enable CORS** only for your production domain
6. **Use environment-specific configs**

### ❌ DON'T:
1. Commit key files to Git (already in .gitignore)
2. Use over-permissioned service accounts
3. Expose API without rate limiting in production
4. Use the same key for dev and prod

---

## Testing Your Setup

```bash
# Test backend health
curl http://localhost:8080/health

# Test each endpoint
curl http://localhost:8080/api/nba
curl http://localhost:8080/api/nhl
curl http://localhost:8080/api/mlb
curl http://localhost:8080/api/nfl

# Test frontend
open http://localhost:5173
```

---

## Troubleshooting

### Issue: "Permission denied" errors
**Solution**: Verify your service account has the correct roles:
```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:YOUR_SERVICE_ACCOUNT"
```

### Issue: "Table not found"
**Solution**: Check your table names in BigQuery Console, then update queries in `server/index.js`

### Issue: Docker container can't access key file
**Solution**: Make sure the key file exists at `server/gcp-key.json` and is readable:
```bash
ls -la server/gcp-key.json
```

---

## Monitoring & Maintenance

### View Logs
```bash
# Docker logs
docker-compose logs -f api

# Cloud Run logs
gcloud run services logs tail statshq-api
```

### Monitor BigQuery Usage
```bash
# View queries in last 24 hours
bq ls -j -a -n 100
```

### Set Up Alerts
Configure Cloud Monitoring alerts for:
- API error rates
- BigQuery quota usage
- Response time degradation

---

## Next Steps

1. **Add caching** (Redis) to reduce BigQuery queries
2. **Implement authentication** for API endpoints
3. **Add rate limiting** using express-rate-limit
4. **Set up CI/CD** with GitHub Actions
5. **Configure custom domain** for production deployment
