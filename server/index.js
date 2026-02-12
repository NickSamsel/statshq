const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Load .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

const bigqueryConfig = {
  projectId: process.env.GCP_PROJECT_ID,
};

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  bigqueryConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const bigquery = new BigQuery(bigqueryConfig);
const DATASET = 'mlb';

async function runQuery(query) {
  const [rows] = await bigquery.query({
    query: query,
    location: 'US',
  });
  return rows;
}

/** * NEW: Player Spotlight & 3D Analytics Endpoints
 */

// Fetches 3D Coordinate data for the PitchVisualizer
app.get('/api/mlb/statcast/pitch-locations', async (req, res) => {
  try {
    const { playerId, season = 2025, limit = 60 } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

    const query = `
      SELECT 
        SAFE.CAST(plate_x AS FLOAT64) as plate_x, 
        SAFE.CAST(plate_z AS FLOAT64) as plate_z, 
        release_speed as velocity,
        pitch_type_description as type,
        count_description as outcome
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_pitches\`
      WHERE batter_id = '${playerId}'
        AND season = ${season}
        AND plate_x IS NOT NULL 
        AND plate_z IS NOT NULL
      ORDER BY game_date DESC, pitch_number DESC
      LIMIT ${limit}
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('BQ Pitch Error:', error);
    res.status(500).json({ error: 'Failed to fetch pitch locations' });
  }
});

// Fetches Season Percentiles for the Spotlight Sidebar
app.get('/api/mlb/players/season-stats', async (req, res) => {
  try {
    const { playerId, season = 2025 } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\`
      WHERE player_id = '${playerId}'
        AND season = ${season}
      LIMIT 1
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('BQ Season Stats Error:', error);
    res.status(500).json({ error: 'Failed to fetch season rankings' });
  }
});

/** * EXISTING: MLB Utility Endpoints
 */

app.get('/api/mlb/teams/list', async (req, res) => {
  try {
    const { season = 2025 } = req.query;
    const query = `
      SELECT DISTINCT team_id, team_name, team_abbr, season
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__teams\`
      WHERE season = ${season}
      ORDER BY team_name
    `;
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams list' });
  }
});

app.get('/api/mlb/batting', async (req, res) => {
  try {
    const { limit = 20, season = 2025, teamId } = req.query;
    const teamFilter = teamId ? `AND team_id = '${teamId}'` : '';
    const query = `
      SELECT 
        player_id, player_name, team_name, at_bats, hits, home_runs,
        ROUND(SAFE_DIVIDE(hits, at_bats), 3) as batting_average,
        ROUND(SAFE_DIVIDE(hits + walks, at_bats + walks) + SAFE_DIVIDE(total_bases, at_bats), 3) as ops
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\`
      WHERE season = ${season} ${teamFilter}
      ORDER BY ops DESC
      LIMIT ${limit}
    `;
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch batting stats' });
  }
});

app.get('/api/mlb/statcast/exit-velocity', async (req, res) => {
  try {
    const { limit = 100, season = 2025, minExitVelo = 95 } = req.query;
    const query = `
      SELECT 
        batter_name as player_name, batter_id as player_id, launch_speed as exit_velocity,
        launch_angle, hit_result as outcome, game_date
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_batted_balls\`
      WHERE launch_speed >= ${minExitVelo} AND season = ${season}
      ORDER BY launch_speed DESC
      LIMIT ${limit}
    `;
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Statcast data' });
  }
});

/**
 * PLACEHOLDER ENDPOINTS (NBA, NFL, NHL)
 */
app.get('/api/nhl', async (req, res) => { res.json({ message: "NHL data logic goes here" }); });
app.get('/api/nba', async (req, res) => { res.json({ message: "NBA data logic goes here" }); });
app.get('/api/nfl', async (req, res) => { res.json({ message: "NFL data logic goes here" }); });

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Stats HQ Backend running on port ${PORT}`);
});