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
        playerSearch: '/api/mlb/players/search?q=ohtani',
        playerInfo: '/api/mlb/players/:playerId/info',
        playerSeasons: '/api/mlb/players/:playerId/seasons',
        pitchLocations: '/api/mlb/statcast/pitch-locations?playerId=XXX&season=2024&viewType=batting',
        battedBallStats: '/api/mlb/statcast/batted-ball-stats?playerId=XXX&season=2024&viewType=batting',
        seasonStats: '/api/mlb/players/season-stats?playerId=XXX&season=2024',
        batting: '/api/mlb/batting?season=2024&limit=20'
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
    const { playerId, season = 2024, viewType = 'batting' } = req.query;
    
    // Determine which player ID field to use based on viewType
    const playerField = viewType === 'batting' ? 'batter_id' : 'pitcher_id';
    
    const query = `
      SELECT 
        plate_x, 
        plate_z, 
        release_speed,
        pitch_type,
        pitch_type_description,
        release_spin_rate,
        spin_tier,
        velocity_tier,
        pitch_result,
        pitch_result_category,
        pitch_result_description,
        zone,
        in_strike_zone,
        game_date,
        pitch_number,
        batter_hand,
        pitcher_hand,
        balls,
        strikes
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_pitches\`
      WHERE ${playerField} = '${playerId}' 
        AND season = ${season}
      ORDER BY game_date DESC, pitch_number
      LIMIT 1000`;
    const data = await runQuery(query);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// New: Batted Ball Statistics - aggregated stats from statcast batted balls
app.get('/api/mlb/statcast/batted-ball-stats', async (req, res) => {
  try {
    const { playerId, season = 2024, viewType = 'batting' } = req.query;
    
    // Determine which player ID field to use based on viewType
    const playerField = viewType === 'batting' ? 'batter_id' : 'pitcher_id';
    
    const query = `
      SELECT 
        COUNT(*) as total_batted_balls,
        ROUND(AVG(launch_speed), 1) as avg_exit_velo,
        ROUND(MAX(launch_speed), 1) as max_exit_velo,
        ROUND(AVG(launch_angle), 1) as avg_launch_angle,
        ROUND(AVG(launch_distance), 1) as avg_distance,
        ROUND(MAX(launch_distance), 1) as max_distance,
        ROUND(AVG(sprint_speed), 1) as avg_sprint_speed,
        COUNTIF(is_barrel = true) as barrels,
        COUNTIF(is_hard_hit = true) as hard_hits,
        COUNTIF(is_home_run = true) as home_runs,
        COUNTIF(is_hit = true) as hits,
        ROUND(COUNTIF(is_barrel = true) / COUNT(*) * 100, 1) as barrel_rate,
        ROUND(COUNTIF(is_hard_hit = true) / COUNT(*) * 100, 1) as hard_hit_rate,
        ROUND(COUNTIF(is_hit = true) / COUNT(*) * 100, 1) as hit_rate,
        -- Breakdown by exit velo tier
        COUNTIF(exit_velo_tier = 'Elite (105+)') as elite_velo_count,
        COUNTIF(exit_velo_tier = 'Plus (95-105)') as plus_velo_count,
        COUNTIF(exit_velo_tier = 'Average (85-95)') as avg_velo_count,
        COUNTIF(exit_velo_tier = 'Below Average (<85)') as below_avg_velo_count,
        -- Breakdown by trajectory
        COUNTIF(trajectory_bucket = 'Line Drive') as line_drives,
        COUNTIF(trajectory_bucket = 'Fly Ball') as fly_balls,
        COUNTIF(trajectory_bucket = 'Ground Ball') as ground_balls,
        COUNTIF(trajectory_bucket = 'Pop Up') as pop_ups
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_batted_balls\`
      WHERE ${playerField} = '${playerId}' 
        AND season = ${season}
        AND launch_speed IS NOT NULL
      GROUP BY 1=1`;
    const data = await runQuery(query);
    res.json(data.length > 0 ? data[0] : {});
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

// Player Search - search by name with LIKE query
app.get('/api/mlb/players/search', async (req, res) => {
  try {
    const { q = '', limit = 100 } = req.query;
    const searchTerm = q.toLowerCase();
    const query = `
      WITH LatestSeasons AS (
        SELECT 
          player_id,
          full_name,
          MAX(season) as latest_season
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\`
        GROUP BY player_id, full_name
      )
      SELECT DISTINCT
        p.player_id,
        p.full_name as player_name,
        b.team_name,
        ls.latest_season
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` p
      LEFT JOIN LatestSeasons ls ON p.player_id = ls.player_id
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\` b
        ON p.player_id = b.player_id AND b.season = ls.latest_season
      WHERE LOWER(p.full_name) LIKE '%${searchTerm}%'
      ORDER BY ls.latest_season DESC NULLS LAST, p.full_name
      LIMIT ${limit}`;
    const data = await runQuery(query);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Player Info - detailed player information with career stats
app.get('/api/mlb/players/:playerId/info', async (req, res) => {
  try {
    const { playerId } = req.params;
    // Join fct_mlb__players with dim_mlb__players to get complete player data
    const query = `
      SELECT 
        d.player_id,
        d.full_name,
        d.primary_number,
        d.primary_position_abbr,
        d.birth_date,
        d.height,
        d.weight,
        d.mlb_debut_date,
        d.bat_side_code,
        d.pitch_hand_code,
        -- All career stats from fct_mlb__players
        f.*
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` d
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__players\` f
        ON d.player_id = f.player_id
      WHERE d.player_id = '${playerId}'
      LIMIT 1`;
    const data = await runQuery(query);
    
    if (data && data[0]) {
      res.json(data[0]);
    } else {
      res.json(null);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Player Season History - batting stats by season (aggregated from game-level data)
app.get('/api/mlb/players/:playerId/seasons', async (req, res) => {
  try {
    const { playerId } = req.params;
    // Aggregate game-level data to season totals using BigQuery
    const query = `
      SELECT 
        season,
        MAX(team_name) as team_name,
        COUNT(DISTINCT game_date) as games,
        SUM(plate_appearances) as plate_appearances,
        SUM(at_bats) as at_bats,
        SUM(runs) as runs,
        SUM(hits) as hits,
        SUM(doubles) as doubles,
        SUM(triples) as triples,
        SUM(home_runs) as home_runs,
        SUM(rbi) as rbi,
        SUM(stolen_bases) as stolen_bases,
        SUM(walks) as walks,
        SUM(strikeouts) as strikeouts,
        -- Calculate rate stats from totals
        ROUND(SAFE_DIVIDE(SUM(hits), SUM(at_bats)), 3) as avg,
        ROUND(SAFE_DIVIDE(SUM(hits) + SUM(walks), SUM(at_bats) + SUM(walks)), 3) as obp,
        ROUND(SAFE_DIVIDE(SUM(total_bases), SUM(at_bats)), 3) as slg,
        ROUND(SAFE_DIVIDE(SUM(hits) + SUM(walks), SUM(at_bats) + SUM(walks)) + SAFE_DIVIDE(SUM(total_bases), SUM(at_bats)), 3) as ops
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\`
      WHERE player_id = '${playerId}'
      GROUP BY season
      ORDER BY season DESC`;
    const data = await runQuery(query);
    
    // Format response with proper types (caught_stealing, hit_by_pitch, sacrifice_flies, war not in schema)
    const formatted = data.map(row => ({
      season: row.season,
      team_name: row.team_name,
      games: row.games || 0,
      plate_appearances: row.plate_appearances || 0,
      at_bats: row.at_bats || 0,
      runs: row.runs || 0,
      hits: row.hits || 0,
      doubles: row.doubles || 0,
      triples: row.triples || 0,
      home_runs: row.home_runs || 0,
      rbi: row.rbi || 0,
      stolen_bases: row.stolen_bases || 0,
      caught_stealing: null,
      walks: row.walks || 0,
      strikeouts: row.strikeouts || 0,
      hit_by_pitch: null,
      sacrifice_flies: null,
      avg: row.avg || 0,
      obp: row.obp || 0,
      slg: row.slg || 0,
      ops: row.ops || 0,
      war: null
    }));
    
    res.json(formatted);
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