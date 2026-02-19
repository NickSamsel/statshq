const express = require('express');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
  ...(process.env.GOOGLE_APPLICATION_CREDENTIALS && { keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS })
});
const DATASET = 'mlb_marts';

const columnCache = new Map();

// --- HELPER FUNCTIONS ---

async function runQuery(query, params) {
  const [rows] = await bigquery.query({ query, params, location: 'US' });
  return rows;
}

function parseIntParam(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseLimit(value, fallback = 50, max = 500) {
  const n = parseIntParam(value, fallback);
  return Math.min(Math.max(n, 1), max);
}

function isCareerSeasonParam(value) {
  if (value === undefined || value === null) return true;
  const v = String(value).trim().toLowerCase();
  return v === '' || v === 'career' || v === 'all' || v === 'career_avg' || v === 'career-average';
}

// --- SYSTEM ROUTES ---

app.get('/', (req, res) => {
  res.json({
    name: 'Stats HQ API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mlb: {
        playerSearch: '/api/mlb/players/search?q=playername',
        playerInfo: '/api/mlb/players/:playerId/info',
        rosters: '/api/mlb/teams/:teamId/roster?season=2024',
      }
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/*', (req, res) => res.status(204).end());

// --- TEAM ROUTES (FIXED ORDER: Specific -> Dynamic -> General) ---

app.get('/api/mlb/teams/seasons', async (req, res) => {
  try {
    const query = `SELECT DISTINCT season FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\` ORDER BY season DESC`;
    const data = await runQuery(query);
    res.json(data.map(r => r.season));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/list', async (req, res) => {
  try {
    const seasonParam = req.query.season;
    let season = seasonParam ? parseIntParam(seasonParam, null) : null;
    if (!season) {
      const seasonQuery = `SELECT MAX(season) as season FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\``;
      const seasonRows = await runQuery(seasonQuery);
      season = seasonRows?.[0]?.season;
    }
    const query = `SELECT DISTINCT team_id, team_name, team_abbr, league_name, division_name, season FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\` WHERE season = @season ORDER BY team_name`;
    const data = await runQuery(query, { season });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/standings', async (req, res) => {
  try {
    const season = parseIntParam(req.query.season, 2025);
    const standingsDate = req.query.date ? String(req.query.date) : null;
    let targetDate = standingsDate;
    if (!targetDate) {
      const dateRows = await runQuery(`SELECT MAX(standings_date) as d FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\` WHERE season = @season`, { season });
      targetDate = dateRows?.[0]?.d;
    }
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\` WHERE season = @season AND standings_date = @standings_date ORDER BY league_name, division_name, division_rank, win_pct DESC`;
    const data = await runQuery(query, { season, standings_date: targetDate });
    res.json({ season, standings_date: targetDate, rows: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dynamic Team Sub-Resources
app.get('/api/mlb/teams/:teamId/roster', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);
    const query = `
      WITH batters AS (SELECT DISTINCT player_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` WHERE team_id = @team_id AND season = @season),
      pitchers AS (SELECT DISTINCT player_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_season_stats\` WHERE team_id = @team_id AND season = @season),
      roster_flags AS (SELECT player_id, TRUE AS is_batter, FALSE AS is_pitcher FROM batters UNION ALL SELECT player_id, FALSE, TRUE FROM pitchers),
      roster AS (SELECT player_id, MAX(CAST(is_batter AS INT64)) > 0 AS is_batter, MAX(CAST(is_pitcher AS INT64)) > 0 AS is_pitcher FROM roster_flags GROUP BY player_id)
      SELECT r.player_id, d.full_name AS player_name, d.primary_number, d.primary_position_abbr, d.bat_side_code, d.pitch_hand_code, r.is_batter, r.is_pitcher, @team_id AS team_id, @season AS season
      FROM roster r LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` d ON r.player_id = d.player_id ORDER BY r.is_pitcher DESC, d.primary_position_abbr, d.full_name`;
    const data = await runQuery(query, { team_id: String(teamId), season });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/:teamId/season-stats', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);
    const query = `
      WITH ranked AS (
        SELECT
          t.*,
          RANK() OVER (ORDER BY season_ops DESC) AS ops_rank,
          RANK() OVER (ORDER BY season_era ASC) AS era_rank,
          RANK() OVER (ORDER BY wins DESC) AS wins_rank
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\` t
        WHERE season = @season
      )
      SELECT * FROM ranked WHERE team_id = @team_id LIMIT 1
    `;
    const data = await runQuery(query, { team_id: teamId, season });
    res.json(data?.[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/:teamId/games', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);
    const limit = parseLimit(req.query.limit, 50, 300);
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_game_stats\` WHERE team_id = @team_id AND season = @season ORDER BY game_date DESC LIMIT @limit`;
    const data = await runQuery(query, { team_id: teamId, season, limit });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/:teamId/venues', async (req, res) => {
  try {
    const { teamId } = req.params;
    const seasonVal = req.query.season || 2025;
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__venues\` WHERE season = @season AND primary_home_team_id = @home_team_id`;
    const data = await runQuery(query, { season: parseIntParam(seasonVal, 2025), home_team_id: String(teamId) });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/:teamId/statcast-metrics', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);

    // Aggregate team-level statcast metrics from player batted ball stats
    const query = `
      SELECT
        AVG(avg_exit_velo) AS avg_exit_velocity,
        MAX(max_exit_velo) AS max_exit_velocity,
        AVG(avg_launch_angle) AS avg_launch_angle,
        AVG(hard_hit_rate) AS hard_hit_rate,
        AVG(barrel_rate) AS barrel_rate,
        COUNT(DISTINCT player_id) AS players_count
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batted_ball_season_stats\`
      WHERE season = @season
        AND player_type = 'batter'
    `;

    const data = await runQuery(query, { season });
    res.json(data?.[0] || null);
  } catch (err) {
    console.error('Error fetching team statcast metrics:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mlb/teams/:teamId/standings-history', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);

    // Get historical standings data for the team throughout the season
    const query = `
      SELECT
        team_id,
        team_name,
        season,
        standings_date,
        wins,
        losses,
        win_pct,
        games_back,
        division_rank,
        run_differential
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
      WHERE team_id = @team_id
        AND season = @season
      ORDER BY standings_date ASC
    `;

    const data = await runQuery(query, { team_id: String(teamId), season });
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching team standings history:', err);
    res.status(500).json({ error: err.message });
  }
});

// General Catch-all for Teams
app.get('/api/mlb/teams', async (req, res) => {
  try {
    const season = parseIntParam(req.query.season, 2025);
    const dateRows = await runQuery(`SELECT MAX(standings_date) as d FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\` WHERE season = @season`, { season });
    const latestDate = dateRows?.[0]?.d;
    const data = await runQuery(`SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\` WHERE season = @season AND standings_date = @d ORDER BY win_pct DESC`, { season, d: latestDate });
    res.json({ season, standings_date: latestDate, rows: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STATCAST & PLAYER SEARCH ---

app.get('/api/mlb/statcast/pitch-locations', async (req, res) => {
  try {
    const { playerId, season = 2025, viewType = 'batting' } = req.query;
    const playerType = viewType === 'batting' ? 'batter' : 'pitcher';
    const career = isCareerSeasonParam(season);
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitch_heatmap\` WHERE player_id = @player_id AND player_type = @player_type ${career ? 'AND season IS NULL' : 'AND season = @season'} LIMIT 500`;
    const data = await runQuery(query, { player_id: String(playerId), player_type: playerType, season: parseIntParam(season, 2025) });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/players/search', async (req, res) => {
  try {
    const { q = '', limit = 100 } = req.query;
    const query = `SELECT DISTINCT p.player_id, p.full_name as player_name FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` p WHERE LOWER(p.full_name) LIKE @q LIMIT @l`;
    const data = await runQuery(query, { q: `%${q.toLowerCase()}%`, l: parseInt(limit) });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


app.get('/api/mlb/players/:playerId/info', async (req, res) => {
  try {
    const { playerId } = req.params;
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` WHERE player_id = @player_id LIMIT 1`;
    const data = await runQuery(query, { player_id: String(playerId) });
    res.json(data?.[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/players/:playerId/season-batting-stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` WHERE player_id = @player_id ORDER BY season DESC`;
    const data = await runQuery(query, { player_id: String(playerId) });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/players/:playerId/season-pitching-stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_season_stats\` WHERE player_id = @player_id ORDER BY season DESC`;
    const data = await runQuery(query, { player_id: String(playerId) });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/players/season-stats', async (req, res) => {
  try {
    const { playerId, season } = req.query;
    const query = `SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` WHERE player_id = @player_id AND season = @season LIMIT 1`;
    const data = await runQuery(query, { player_id: String(playerId), season: parseIntParam(season, 2025) });
    res.json(data?.[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/statcast/pitch-zone-outcomes', async (req, res) => {
  try {
    const { playerId, season = 2025, viewType = 'batting' } = req.query;
    const playerType = viewType === 'batting' ? 'batter' : 'pitcher';

    // This aggregates pitch outcomes by zone
    const query = `
      SELECT
        zone,
        COUNT(*) as pitch_count,
        AVG(release_speed) as avg_velocity,
        SUM(CASE WHEN description IN ('hit_into_play', 'foul') THEN 1 ELSE 0 END) as contact_count,
        SUM(CASE WHEN description = 'called_strike' THEN 1 ELSE 0 END) as called_strikes,
        SUM(CASE WHEN description = 'swinging_strike' THEN 1 ELSE 0 END) as swinging_strikes
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__statcast_pitches\`
      WHERE ${playerType}_id = @player_id
        AND season = @season
        AND zone IS NOT NULL
      GROUP BY zone
      ORDER BY zone
    `;

    const data = await runQuery(query, { player_id: String(playerId), season: parseIntParam(season, 2025) });
    res.json(data);
  } catch (err) {
    console.error('Error fetching pitch zone outcomes:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mlb/statcast/batted-ball-stats', async (req, res) => {
  try {
    const { playerId, season = 2025, viewType = 'batting' } = req.query;
    const playerType = viewType === 'batting' ? 'batter' : 'pitcher';

    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batted_ball_season_stats\`
      WHERE player_id = @player_id
        AND season = @season
        AND player_type = @player_type
      LIMIT 1
    `;

    const data = await runQuery(query, {
      player_id: String(playerId),
      season: parseIntParam(season, 2025),
      player_type: playerType
    });
    res.json(data?.[0] || null);
  } catch (err) {
    console.error('Error fetching batted ball stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// Batting Stats Leaderboard
app.get('/api/mlb/batting', async (req, res) => {
  try {
    const { season = 2025, limit = 20 } = req.query;
    const query = `
      SELECT
        player_id,
        team_id,
        avg,
        obp,
        slg,
        ops,
        home_runs,
        rbi,
        stolen_bases
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\`
      WHERE season = @season
      ORDER BY ops DESC
      LIMIT @limit`;

    const data = await runQuery(query, {
      season: parseIntParam(season, 2025),
      limit: parseLimit(limit, 20)
    });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pitching Stats Leaderboard
app.get('/api/mlb/pitching', async (req, res) => {
  try {
    const { season = 2025, limit = 20 } = req.query;
    const query = `
      SELECT
        player_id,
        team_id,
        era,
        strikeouts,
        wins,
        whip
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_season_stats\`
      WHERE season = @season
      ORDER BY strikeouts DESC
      LIMIT @limit`;

    const data = await runQuery(query, {
      season: parseIntParam(season, 2025),
      limit: parseLimit(limit, 20)
    });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Statcast Exit Velocity Leaders
app.get('/api/mlb/statcast/exit-velocity', async (req, res) => {
  try {
    const { season = 2025, limit = 20 } = req.query;
    const query = `
      SELECT 
        player_id, 
        player_type, 
        avg_exit_velo, 
        max_exit_velo, 
        hard_hit_rate
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batted_ball_season_stats\`
      WHERE season = @season
      ORDER BY avg_exit_velo DESC
      LIMIT @limit`;

    const data = await runQuery(query, {
      season: parseIntParam(season, 2025),
      limit: parseLimit(limit, 20)
    });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Recent Games Feed
app.get('/api/mlb/games/recent', async (req, res) => {
  try {
    const query = `
      SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_game_stats\` 
      ORDER BY game_date DESC 
      LIMIT 20`;
    const data = await runQuery(query);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FINAL 404 HANDLER ---
app.use((req, res) => {
  console.log(`404 hit: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found", path: req.url });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend running on port ${PORT}`));