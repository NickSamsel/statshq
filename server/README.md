# Stats HQ Backend Server

This backend server connects to Google BigQuery and serves sports statistics data to the React frontend.

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Google Cloud Credentials

#### Option A: Service Account Key (Recommended for Development)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "IAM & Admin" > "Service Accounts"
3. Create a service account or use an existing one
4. Create and download a JSON key file
5. Place the key file in the `server/` directory (e.g., `server/gcp-key.json`)
6. Update `.env` with the path to your key file

#### Option B: Application Default Credentials
If running on Google Cloud (Cloud Run, GKE, etc.), use default credentials:
```bash
gcloud auth application-default login
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your values:
```
GCP_PROJECT_ID=your-actual-project-id
GOOGLE_APPLICATION_CREDENTIALS=./server/gcp-key.json
PORT=8080
FRONTEND_URL=http://localhost:5173
```

### 4. Create BigQuery Tables

Make sure your BigQuery database has the following structure:

**Dataset**: `sports_data`

**Tables**:
- `nhl_teams` (columns: team_name, wins, losses, etc.)
- `mlb_teams` (columns: team_name, wins, losses, etc.)
- `nfl_teams` (columns: team_name, wins, losses, etc.)
- `nba_teams` (columns: team_name, wins, losses, etc.)

Example query to create a table:
```sql
CREATE TABLE `your-project.sports_data.nba_teams` (
  team_name STRING,
  wins INT64,
  losses INT64,
  season STRING
);
```

### 5. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:8080`

## Endpoints

- `GET /api/nhl` - Fetch NHL statistics
- `GET /api/mlb` - Fetch MLB statistics
- `GET /api/nfl` - Fetch NFL statistics
- `GET /api/nba` - Fetch NBA statistics
- `GET /health` - Health check endpoint

## Customize Your Queries

Edit the SQL queries in `server/index.js` to match your BigQuery table structure and data needs. The current queries are templates that you should modify based on your actual database schema.

## Security Notes

- **Never commit** your `.env` file or service account keys to version control
- Add `gcp-key.json` and `.env` to `.gitignore`
- Use environment variables for all sensitive configuration
- In production, use Google Cloud's built-in authentication instead of key files
