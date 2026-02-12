const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 8080;

// --- 1. GLOBAL MIDDLEWARE (MUST BE FIRST) ---
// Development-friendly CORS: Allow any origin to rule out CSP/CORS blockers
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  ...(process.env.GOOGLE_APPLICATION_CREDENTIALS && { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS })
});
const DATASET = 'mlb';

async function runQuery(query) {
  const [rows] = await bigquery.query({ query, location: 'US' });
  return rows;
}

// --- 2. ACTUAL API ROUTES ---

// Root route - API info
app.get('/', (req, res) => {
  res.json({
    name: 'Stats HQ API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mlb: {
        pitchLocations: '/api/mlb/statcast/pitch-locations?playerId=XXX&season=2025',
        seasonStats: '/api/mlb/players/season-stats?playerId=XXX&season=2025',
        batting: '/api/mlb/batting?season=2025&limit=20'
      }
    }
  });
});

// Health check (Verify this at http://localhost:8080/health)
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Silently handle common browser requests
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/*', (req, res) => res.status(204).end());

// New: 3D Pitch Locations
app.get('/api/mlb/statcast/pitch-locations', async (req, res) => {
  try {
    const { playerId, season = 2025 } = req.query;
    const query = `
      SELECT plate_x, plate_z, release_speed as velocity, count_description as outcome
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_pitches\`
      WHERE batter_id = '${playerId}' AND season = ${season}
      LIMIT 60`;
    const data = await runQuery(query);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// New: Season Percentiles
app.get('/api/mlb/players/season-stats', async (req, res) => {
  try {
    const { playerId, season = 2025 } = req.query;
    const query = `
      SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\`
      WHERE player_id = '${playerId}' AND season = ${season} LIMIT 1`;
    const data = await runQuery(query);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Existing Batting Stats
app.get('/api/mlb/batting', async (req, res) => {
  try {
    const { season = 2025, limit = 20 } = req.query;
    const query = `
      SELECT player_id, full_name as player_name, team_name, home_runs,
      ROUND(SAFE_DIVIDE(hits, at_bats), 3) as batting_average
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\`
      WHERE season = ${season} ORDER BY home_runs DESC LIMIT ${limit}`;
    const data = await runQuery(query);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 3. THE 404 HANDLER (MUST BE LAST) ---
app.use((req, res) => {
  console.log(`404 hit: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found", path: req.url });
});

app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));