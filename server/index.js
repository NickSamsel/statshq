const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

// Only load .env if not in Codespaces (Codespaces uses secrets)
if (!process.env.CODESPACES) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS for your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));

app.use(express.json());

// Initialize BigQuery client
// In Codespaces, authentication is handled via GOOGLE_APPLICATION_CREDENTIALS secret
// In Cloud Run/GKE, you can use Workload Identity
const bigqueryConfig = {
  projectId: process.env.GCP_PROJECT_ID,
};

// Use keyFilename if GOOGLE_APPLICATION_CREDENTIALS is set
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  bigqueryConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

const bigquery = new BigQuery(bigqueryConfig);
const DATASET = 'mlb'; // Dataset name

// Helper function to run BigQuery queries
async function runQuery(query) {
  const [rows] = await bigquery.query({
    query: query,
    location: 'US',
  });
  return rows;
}

// NHL endpoint
app.get('/api/nhl', async (req, res) => {
  try {
    // Replace with your actual BigQuery table and query
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nhl_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NHL data:', error);
    res.status(500).json({ error: 'Failed to fetch NHL data', message: error.message });
  }
});

// MLB endpoint - Team Standings
app.get('/api/mlb/teams', async (req, res) => {
  try {
    const query = `
      SELECT 
        t.team_id,
        t.team_name,
        t.team_abbr,
        d.division_name,
        d.league_name,
        COUNT(CASE 
          WHEN g.home_team_id = t.team_id AND g.home_score > g.away_score THEN 1
          WHEN g.away_team_id = t.team_id AND g.away_score > g.home_score THEN 1
        END) as wins,
        COUNT(CASE 
          WHEN g.home_team_id = t.team_id AND g.home_score < g.away_score THEN 1
          WHEN g.away_team_id = t.team_id AND g.away_score < g.home_score THEN 1
        END) as losses,
        ROUND(COUNT(CASE 
          WHEN g.home_team_id = t.team_id AND g.home_score > g.away_score THEN 1
          WHEN g.away_team_id = t.team_id AND g.away_score > g.home_score THEN 1
        END) / 
        NULLIF(COUNT(CASE WHEN t.team_id IN (g.home_team_id, g.away_team_id) THEN 1 END), 0), 3) as win_percentage
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__teams\` t
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__divisions\` d 
        ON t.division_id = d.division_id
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__games\` g
        ON t.team_id IN (g.home_team_id, g.away_team_id)
          AND g.status = 'Final'
          AND g.game_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
      GROUP BY t.team_id, t.team_name, t.team_abbr, d.division_name, d.league_name
      HAVING COUNT(g.game_id) > 0
      ORDER BY win_percentage DESC
      LIMIT 30
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB team data:', error);
    res.status(500).json({ error: 'Failed to fetch MLB team data', message: error.message });
  }
});

// MLB Player Batting Stats
app.get('/api/mlb/batting', async (req, res) => {
  try {
    const { limit = 20, minAtBats = 100 } = req.query;
    const query = `
      WITH player_totals AS (
        SELECT 
          player_id,
          ANY_VALUE(full_name) as player_name,
          ANY_VALUE(team_name) as team_name,
          SUM(at_bats) as at_bats,
          SUM(hits) as hits,
          SUM(home_runs) as home_runs,
          SUM(rbi) as rbi,
          SUM(stolen_bases) as stolen_bases,
          SUM(walks) as walks,
          SUM(total_bases) as total_bases
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\`
        WHERE game_status = 'Final'
          AND season = EXTRACT(YEAR FROM CURRENT_DATE())
        GROUP BY player_id
        HAVING SUM(at_bats) >= ${minAtBats}
      )
      SELECT 
        player_id,
        player_name,
        team_name,
        at_bats,
        hits,
        home_runs,
        rbi,
        stolen_bases,
        ROUND(SAFE_DIVIDE(hits, at_bats), 3) as batting_average,
        ROUND(SAFE_DIVIDE(hits + walks, at_bats + walks), 3) as on_base_pct,
        ROUND(SAFE_DIVIDE(total_bases, at_bats), 3) as slugging_pct,
        ROUND(SAFE_DIVIDE(hits + walks, at_bats + walks) + SAFE_DIVIDE(total_bases, at_bats), 3) as ops
      FROM player_totals
      ORDER BY ops DESC
      LIMIT ${limit}
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB batting stats:', error);
    res.status(500).json({ error: 'Failed to fetch MLB batting stats', message: error.message });
  }
});

// MLB Player Pitching Stats
app.get('/api/mlb/pitching', async (req, res) => {
  try {
    const { limit = 20, minInnings = 50 } = req.query;
    const query = `
      WITH pitcher_totals AS (
        SELECT 
          player_id,
          ANY_VALUE(player_name) as player_name,
          ANY_VALUE(team_name) as team_name,
          COUNT(*) as games,
          SUM(innings_pitched_decimal) as innings_pitched,
          SUM(strikeouts) as strikeouts,
          SUM(walks) as walks,
          SUM(earned_runs) as earned_runs,
          SUM(hits) as hits,
          SUM(CASE WHEN is_quality_start THEN 1 ELSE 0 END) as quality_starts
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_stats\`
        WHERE game_status = 'Final'
          AND season = EXTRACT(YEAR FROM CURRENT_DATE())
        GROUP BY player_id
        HAVING SUM(innings_pitched_decimal) >= ${minInnings}
      )
      SELECT 
        player_id,
        player_name,
        team_name,
        games,
        innings_pitched,
        strikeouts,
        walks,
        earned_runs,
        hits,
        quality_starts,
        ROUND(SAFE_DIVIDE(earned_runs * 9, NULLIF(innings_pitched, 0)), 2) as era,
        ROUND(SAFE_DIVIDE(walks + hits, NULLIF(innings_pitched, 0)), 2) as whip,
        ROUND(SAFE_DIVIDE(strikeouts, NULLIF(walks, 0)), 2) as k_bb_ratio
      FROM pitcher_totals
      ORDER BY era ASC
      LIMIT ${limit}
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB pitching stats:', error);
    res.status(500).json({ error: 'Failed to fetch MLB pitching stats', message: error.message });
  }
});

// MLB Recent Games
app.get('/api/mlb/games/recent', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const query = `
      SELECT 
        game_id,
        game_date,
        home_team_name as home_team,
        home_team_abbr,
        away_team_name as away_team,
        away_team_abbr,
        home_score,
        away_score,
        CASE 
          WHEN home_score > away_score THEN home_team_name
          WHEN away_score > home_score THEN away_team_name
          ELSE 'Tie'
        END as winner,
        status,
        game_type
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__games\`
      WHERE status = 'Final'
      ORDER BY game_date DESC, game_id DESC
      LIMIT ${limit}
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB games:', error);
    res.status(500).json({ error: 'Failed to fetch MLB games', message: error.message });
  }
});

// MLB Statcast - Top Exit Velocities
app.get('/api/mlb/statcast/exit-velocity', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const query = `
      SELECT 
        batter_name as player_name,
        home_team_name,
        away_team_name,
        game_date,
        launch_speed as exit_velocity,
        launch_angle,
        launch_distance as hit_distance,
        hit_trajectory as batted_ball_type,
        hit_result as outcome,
        is_barrel,
        is_hard_hit,
        is_home_run
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_batted_balls\`
      WHERE launch_speed IS NOT NULL
        AND season = EXTRACT(YEAR FROM CURRENT_DATE())
      ORDER BY launch_speed DESC
      LIMIT ${limit}
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB Statcast data:', error);
    res.status(500).json({ error: 'Failed to fetch MLB Statcast data', message: error.message });
  }
});

// Legacy MLB endpoint (for backward compatibility)
app.get('/api/mlb', async (req, res) => {
  try {
    // Default to team standings
    const query = `
      SELECT 
        t.team_name as name,
        COUNT(CASE 
          WHEN g.home_team_id = t.team_id AND g.home_score > g.away_score THEN 1
          WHEN g.away_team_id = t.team_id AND g.away_score > g.home_score THEN 1
        END) as value
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__teams\` t
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__games\` g
        ON t.team_id IN (g.home_team_id, g.away_team_id)
          AND g.status = 'Final'
          AND g.game_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY)
      GROUP BY t.team_name
      ORDER BY value DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB data:', error);
    res.status(500).json({ error: 'Failed to fetch MLB data', message: error.message });
  }
});

// NFL endpoint
app.get('/api/nfl', async (req, res) => {
  try {
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nfl_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NFL data:', error);
    res.status(500).json({ error: 'Failed to fetch NFL data', message: error.message });
  }
});

// NBA endpoint
app.get('/api/nba', async (req, res) => {
  try {
    const query = `
      SELECT 
        team_name as name,
        wins as value
      FROM \`${process.env.GCP_PROJECT_ID}.sports_data.nba_teams\`
      ORDER BY wins DESC
      LIMIT 10
    `;
    
    const data = await runQuery(query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBA data:', error);
    res.status(500).json({ error: 'Failed to fetch NBA data', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({
    name: 'Stats HQ API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      nba: '/api/nba',
      nhl: '/api/nhl',
      nfl: '/api/nfl',
      mlb: {
        legacy: '/api/mlb',
        teams: '/api/mlb/teams',
        batting: '/api/mlb/batting?limit=20&minAtBats=100',
        pitching: '/api/mlb/pitching?limit=20&minInnings=50',
        recentGames: '/api/mlb/games/recent?limit=50',
        statcast: '/api/mlb/statcast/exit-velocity?limit=100'
      }
    },
    docs: 'Visit the frontend at http://localhost:5173'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 BigQuery project: ${process.env.GCP_PROJECT_ID}`);
  console.log(`📁 BigQuery dataset: ${DATASET}`);
  console.log(`🔐 Auth: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Using key file' : 'Using default credentials'}`);
  console.log(`☁️  Environment: ${process.env.CODESPACES ? 'GitHub Codespaces' : 'Local'}`);
});
