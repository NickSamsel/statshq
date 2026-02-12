# GitHub Codespaces Setup Guide

## Quick Start with Codespaces

### 1. Configure Secrets

Go to your repository on GitHub:
1. Click **Settings** → **Secrets and variables** → **Codespaces**
2. Click **New repository secret**
3. Add these secrets:

#### Required Secrets:

**`GCP_PROJECT_ID`**
- Value: Your Google Cloud project ID (e.g., `statshq-prod-12345`)

**`GCP_SERVICE_ACCOUNT_KEY`**
- Value: Copy the **entire contents** of your service account JSON key file
- To get this:
  ```bash
  cat key.json
  ```
- Copy everything from `{` to `}` including the braces

### 2. Create Service Account (One-Time Setup)

```bash
# Set your project
export PROJECT_ID="your-project-id"

# Create read-only service account
gcloud iam service-accounts create statshq-dashboard \
    --project=$PROJECT_ID \
    --display-name="Stats HQ Dashboard"

# Grant BigQuery read permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:statshq-dashboard@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/bigquery.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:statshq-dashboard@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataViewer"

# Download key
gcloud iam service-accounts keys create key.json \
    --iam-account=statshq-dashboard@${PROJECT_ID}.iam.gserviceaccount.com

# View key contents (copy this to GCP_SERVICE_ACCOUNT_KEY secret)
cat key.json

# Clean up (key is now in Codespaces secrets)
rm key.json
```

### 3. Launch Codespace

1. Go to your repository on GitHub
2. Click **Code** → **Codespaces** → **Create codespace on main**
3. Wait for the container to build and setup to complete

The `.devcontainer/postCreateCommand.sh` script will automatically:
- Create the service account key file from your secret
- Configure environment variables
- Install all dependencies

### 4. Start the Application

Once the Codespace is ready:

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The ports (5173 and 8080) will automatically forward, and you'll get links to access your app.

---

## What Happens Automatically

When you launch the Codespace:

1. ✅ Service account key is created from `GCP_SERVICE_ACCOUNT_KEY` secret
2. ✅ `.env` file is generated with your `GCP_PROJECT_ID`
3. ✅ All dependencies are installed
4. ✅ Ports 5173 (frontend) and 8080 (backend) are forwarded

---

## Service Account Permissions Explained

Your service account has **read-only** access:

| Role | What It Does | Why Needed |
|------|-------------|------------|
| `bigquery.user` | Run queries and list jobs | Execute SELECT queries |
| `bigquery.dataViewer` | Read table data | Access your sports statistics tables |

**Cannot do:** Create/delete tables, insert/update data, modify datasets

---

## Security Best Practices

✅ **DO:**
- Use Codespaces secrets (never commit keys)
- Use separate service account from your ETL pipeline
- Rotate keys every 90 days
- Use read-only permissions for dashboard

❌ **DON'T:**
- Commit `gcp-key.json` or `.env` files (already in .gitignore)
- Share service account keys in chat or email
- Use admin/owner service accounts
- Reuse service accounts across projects

---

## Troubleshooting

### Issue: "GCP_SERVICE_ACCOUNT_KEY secret not found"

**Solution:** Make sure you added the secret to **Codespaces** (not Actions):
- Go to Settings → Secrets and variables → **Codespaces** (not Actions)
- Rebuild the Codespace after adding secrets

### Issue: "Permission denied" when querying BigQuery

**Solution:** Verify service account has correct permissions:
```bash
gcloud projects get-iam-policy YOUR_PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:*statshq-dashboard*"
```

### Issue: Secrets not loading

**Solution:** Rebuild the Codespace:
- Click the Codespaces menu (bottom-left)
- Select "Rebuild Container"

---

## Update SQL Queries

Edit `server/index.js` to match your BigQuery table structure:

```javascript
const query = `
  SELECT 
    team_name as name,
    wins as value
  FROM \`${process.env.GCP_PROJECT_ID}.your_dataset.your_table\`
  ORDER BY wins DESC
  LIMIT 10
`;
```

---

## Environment Variables Summary

These are automatically configured from your Codespaces secrets:

| Variable | Source | Used By |
|----------|--------|---------|
| `GCP_PROJECT_ID` | Codespaces secret | Backend (BigQuery client) |
| `GCP_SERVICE_ACCOUNT_KEY` | Codespaces secret | Converted to `server/gcp-key.json` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Auto-generated | Backend (points to key file) |
| `VITE_API_BASE_URL` | Auto-generated | Frontend (API endpoint) |
| `PORT` | Auto-generated | Backend (server port) |

---

## Next Steps

1. Configure your Codespaces secrets (see above)
2. Update SQL queries in `server/index.js`
3. Launch your Codespace
4. Start both backend and frontend
5. Access your dashboard at the forwarded port URL

That's it! Your BigQuery data will automatically connect to your React dashboards.
