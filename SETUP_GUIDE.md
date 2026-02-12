# 🚀 Quick Start Guide: Connecting BigQuery to Stats HQ

This guide will help you connect your Google BigQuery data to your React dashboards.

## 📋 Prerequisites

1. **Google Cloud Platform Account** with BigQuery enabled
2. **BigQuery Dataset** with your sports statistics data
3. **Service Account** with BigQuery permissions

---

## 🔧 Step-by-Step Setup

### Step 1: Set Up Google Cloud BigQuery

#### 1.1 Create a GCP Project (if you don't have one)
```bash
# Install gcloud CLI if not already installed
# Visit: https://cloud.google.com/sdk/docs/install

# Create a new project
gcloud projects create your-project-id --name="Stats HQ"

# Set as active project
gcloud config set project your-project-id
```

#### 1.2 Enable BigQuery API
```bash
gcloud services enable bigquery.googleapis.com
```

#### 1.3 Create a Service Account
```bash
# Create service account
gcloud iam service-accounts create statshq-bigquery \
    --description="Service account for Stats HQ BigQuery access" \
    --display-name="Stats HQ BigQuery"

# Grant BigQuery permissions
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:statshq-bigquery@your-project-id.iam.gserviceaccount.com" \
    --role="roles/bigquery.user"

gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:statshq-bigquery@your-project-id.iam.gserviceaccount.com" \
    --role="roles/bigquery.dataViewer"

# Download the key file
gcloud iam service-accounts keys create server/gcp-key.json \
    --iam-account=statshq-bigquery@your-project-id.iam.gserviceaccount.com
```

### Step 2: Set Up Your BigQuery Dataset and Tables

#### 2.1 Create Dataset
```bash
bq mk --dataset --location=US your-project-id:sports_data
```

#### 2.2 Create Tables (Example Schema)

```sql
-- NBA Teams Table
CREATE TABLE `your-project-id.sports_data.nba_teams` (
  team_name STRING,
  wins INT64,
  losses INT64,
  points_per_game FLOAT64,
  season STRING,
  last_updated TIMESTAMP
);

-- NHL Teams Table
CREATE TABLE `your-project-id.sports_data.nhl_teams` (
  team_name STRING,
  wins INT64,
  losses INT64,
  goals_for INT64,
  goals_against INT64,
  season STRING,
  last_updated TIMESTAMP
);

-- MLB Teams Table
CREATE TABLE `your-project-id.sports_data.mlb_teams` (
  team_name STRING,
  wins INT64,
  losses INT64,
  runs_scored INT64,
  runs_allowed INT64,
  season STRING,
  last_updated TIMESTAMP
);

-- NFL Teams Table
CREATE TABLE `your-project-id.sports_data.nfl_teams` (
  team_name STRING,
  wins INT64,
  losses INT64,
  points_for INT64,
  points_against INT64,
  season STRING,
  last_updated TIMESTAMP
);
```

#### 2.3 Load Sample Data

```sql
-- Insert sample NBA data
INSERT INTO `your-project-id.sports_data.nba_teams` VALUES
('Lakers', 48, 34, 115.2, '2023-24', CURRENT_TIMESTAMP()),
('Celtics', 52, 30, 118.5, '2023-24', CURRENT_TIMESTAMP()),
('Warriors', 45, 37, 116.8, '2023-24', CURRENT_TIMESTAMP()),
('Heat', 50, 32, 112.4, '2023-24', CURRENT_TIMESTAMP());

-- Do similar for other sports...
```

### Step 3: Configure Your Application

#### 3.1 Create Environment File
```bash
# Copy the example file
cp env.example .env

# Edit with your values
nano .env
```

Update `.env`:
```env
GCP_PROJECT_ID=your-actual-project-id
GOOGLE_APPLICATION_CREDENTIALS=./server/gcp-key.json
PORT=8080
FRONTEND_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8080/api
```

#### 3.2 Update BigQuery Queries

Edit [server/index.js](server/index.js) to match your table structure:

```javascript
// Example: Update the NBA query to match your schema
app.get('/api/nba', async (req, res) => {
  try {
    const query = `
      SELECT 
        team_name as name,
        wins as value,
        points_per_game as ppg
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nba_teams\`
      WHERE season = '2023-24'
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBA data:', error);
    res.status(500).json({ error: 'Failed to fetch NBA data' });
  }
});
```

### Step 4: Install Dependencies and Run

#### 4.1 Install Backend Dependencies
```bash
cd server
npm install
cd ..
```

#### 4.2 Install Frontend Dependencies
```bash
npm install
```

#### 4.3 Run in Development Mode

**Terminal 1 - Backend API:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Your app will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8080
- Health Check: http://localhost:8080/health

### Step 5: Run with Docker (Production)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🎯 Testing Your Connection

### Test the Backend API

```bash
# Health check
curl http://localhost:8080/health

# Test NBA endpoint
curl http://localhost:8080/api/nba

# Test other endpoints
curl http://localhost:8080/api/nhl
curl http://localhost:8080/api/mlb
curl http://localhost:8080/api/nfl
```

### Test the Frontend

1. Open http://localhost:5173
2. Navigate to different sports tabs (NBA, NHL, MLB, NFL)
3. You should see data visualizations with your BigQuery data

---

## 🔍 Troubleshooting

### Issue: "Permission denied" or "Access denied"
**Solution:** Verify your service account has the correct permissions:
```bash
gcloud projects get-iam-policy your-project-id \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:statshq-bigquery@*"
```

### Issue: "Table not found"
**Solution:** Verify your table exists and query is correct:
```bash
bq ls your-project-id:sports_data
bq show your-project-id:sports_data.nba_teams
```

### Issue: Backend returns 500 errors
**Solution:** Check backend logs:
```bash
cd server
npm run dev
# Look for error messages in the console
```

### Issue: Frontend shows "Loading..." indefinitely
**Solution:**
1. Check if backend is running: `curl http://localhost:8080/health`
2. Check browser console for CORS errors
3. Verify `VITE_API_BASE_URL` in `.env`

---

## 📊 Customizing Your Queries

The SQL queries in `server/index.js` are templates. Customize them based on:

1. **Your Table Schema**: Match column names to your actual tables
2. **Data Filtering**: Add WHERE clauses for specific seasons, teams, etc.
3. **Aggregations**: Use GROUP BY for statistics
4. **Joins**: Combine multiple tables if needed

Example advanced query:
```sql
SELECT 
  t.team_name as name,
  t.wins as value,
  ROUND(AVG(p.points), 1) as avg_points,
  COUNT(p.player_id) as player_count
FROM `your-project-id.sports_data.nba_teams` t
LEFT JOIN `your-project-id.sports_data.nba_players` p
  ON t.team_name = p.team_name
WHERE t.season = '2023-24'
GROUP BY t.team_name, t.wins
ORDER BY t.wins DESC
LIMIT 10
```

---

## 🔒 Security Best Practices

1. ✅ **Never commit** `.env` or `gcp-key.json` files
2. ✅ Use **environment variables** for all sensitive data
3. ✅ Enable **CORS** only for your frontend domain in production
4. ✅ Use **IAM roles** with minimum required permissions
5. ✅ In production, use **Workload Identity** (for GKE) or **Application Default Credentials** instead of key files
6. ✅ Rotate service account keys regularly

---

## 🚀 Next Steps

1. **Add Authentication**: Implement user authentication in your backend
2. **Add Caching**: Use Redis to cache BigQuery results
3. **Add Monitoring**: Set up logging and monitoring (Cloud Logging, Datadog, etc.)
4. **Optimize Queries**: Create materialized views in BigQuery for complex queries
5. **Add More Visualizations**: Expand your React components with more chart types

---

## 📚 Additional Resources

- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [BigQuery Node.js Client](https://googleapis.dev/nodejs/bigquery/latest/)
- [React Recharts Documentation](https://recharts.org/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)

---

Need help? Check the logs or create an issue!
