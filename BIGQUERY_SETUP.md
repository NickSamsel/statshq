# Connecting BigQuery to React - MLB Stats Dashboard

## ✅ What's Working

Your MLB BigQuery tables are now fully connected to your React frontend! Here's what's available:

### 📊 **API Endpoints**

All endpoints are live at `http://localhost:8080/api/mlb/`

1. **`/api/mlb/teams`** - Team standings with win/loss records
2. **`/api/mlb/batting`** - Player batting stats (customizable with `?limit=20&minAtBats=100`)
3. **`/api/mlb/pitching`** - Player pitching stats (customizable with `?limit=20&minInnings=50`)
4. **`/api/mlb/games/recent`** - Recent game scores (customizable with `?limit=50`)
5. **`/api/mlb/statcast/exit-velocity`** - Statcast batted ball data (customizable with `?limit=100`)

### 🎨 **Frontend Features**

The MLB Stats page now has 5 interactive tabs:
- **Teams** - Bar chart and table of team standings
- **Batting** - Top hitters ranked by OPS
- **Pitching** - Top pitchers ranked by ERA  
- **Recent Games** - Latest game scores
- **Statcast** - Scatter plot of exit velocity vs launch angle

### 🗂️ **BigQuery Tables Used**

```
Dataset: mlb

Dimension Tables:
├── dim_mlb__teams
├── dim_mlb__players
├── dim_mlb__divisions
└── dim_mlb__leagues

Fact Tables:
├── fct_mlb__games
├── fct_mlb__player_batting_stats
├── fct_mlb__player_pitching_stats
└── fct_mlb__statcast_batted_balls
```

## 🚀 **Running the App**

### In GitHub Codespaces (Current Setup):

1. **Setup credentials** (already done):
   ```bash
   ./setup-credentials.sh
   ```

2. **Start the backend**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   Server runs on: `http://localhost:8080`

3. **Start the frontend** (in another terminal):
   ```bash
   npm install
   npm run dev
   ```
   Frontend runs on: `http://localhost:3001`

4. **Access the app**:
   - Open `http://localhost:3001` in your browser
   - Navigate to the MLB Stats page

### Environment Setup

The app automatically detects GitHub Codespaces and uses environment variables:
- `GCP_PROJECT_ID` - Your GCP project ID (set as Codespace secret)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to your service account key

Current configuration:
```bash
GCP_PROJECT_ID=project-7dd4e548-9904-449d-9b7
GOOGLE_APPLICATION_CREDENTIALS=/workspaces/statshq/server/gcp-key.json
```

## 📝 **Schema Notes**

### Key Field Mappings:

| Table | Key Fields | Notes |
|-------|------------|-------|
| **fct_mlb__games** | `home_team_id`, `away_team_id`, `home_score`, `away_score` | No `winner_id` field - calculated dynamically |
| **fct_mlb__player_batting_stats** | `player_id`, `full_name` | Stats like `avg`, `obp`, `ops` are **STRING** type |
| **fct_mlb__player_pitching_stats** | `player_id`, `player_name` | `innings_pitched_decimal` (FLOAT) used for calculations |
| **fct_mlb__statcast_batted_balls** | `batter_id`, `launch_speed`, `launch_angle` | Uses `launch_*` fields (not `exit_*`) |

### Data Already Denormalized

Most fact tables already include denormalized fields like `team_name`, `league_name`, `division_name`, so JOINs to dimension tables are optional.

## 🔧 **Customizing Queries**

Edit `/workspaces/statshq/server/index.js` to:
- Add new endpoints
- Modify query filters
- Change aggregation logic
- Add more Statcast metrics

Example - Add season filter:
```javascript
const { season = 2024 } = req.query;
// Add to WHERE clause:
AND season = ${season}
```

## 🎯 **Next Steps**

1. **Add more visualizations** - Line charts, pie charts, heatmaps
2. **Create player detail pages** - Click a player to see full stats
3. **Add filtering UI** - Dropdowns for season, team, position
4. **Real-time updates** - Webhook or scheduled refreshes
5. **Add other sports** - NFL, NBA, NHL pipelines

## 📚 **Files Modified**

- ✅ `/server/index.js` - Added 5 new MLB endpoints
- ✅ `/src/services/bigqueryService.js` - Added API client functions
- ✅ `/src/components/MLBStats.jsx` - Multi-tab dashboard
- ✅ `/get-schema.js` - Schema inspection tool
- ✅ `/setup-credentials.sh` - Credential setup automation

## 🐛 **Troubleshooting**

### BigQuery errors?
- Verify `server/gcp-key.json` exists and has correct permissions
- Check `GCP_PROJECT_ID` matches your actual project
- Ensure dataset is named `mlb` (not `sports_data`)

### No data showing?
- Check backend logs for SQL errors
- Verify tables have data: Run `get-schema.js`
- Test endpoints directly: `curl http://localhost:8080/api/mlb/teams`

### CORS errors?
- Backend must be running on port 8080
- Check `FRONTEND_URL` in server config

---

**Status**: ✅ Fully Connected & Running
**Frontend**: http://localhost:3001
**Backend**: http://localhost:8080
**Health Check**: http://localhost:8080/health
