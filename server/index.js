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
    const season = parseIntParam(req.query.season || 2025, 2025);
    const query = `
      SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__venues\`
      WHERE primary_home_team_id = @home_team_id
      ORDER BY ABS(season - @season) ASC, season DESC
      LIMIT 1
    `;
    const data = await runQuery(query, { home_team_id: String(teamId), season });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/mlb/teams/:teamId/statcast-metrics', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);
    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_statcast_metrics\`
      WHERE team_id = @team_id AND season = @season
      LIMIT 1
    `;
    const data = await runQuery(query, { team_id: String(teamId), season });
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
    // Alias plate_x_bin/plate_z_bin → plate_x/plate_z for frontend compatibility
    // Also alias avg_velocity/avg_spin_rate to release_speed/release_spin_rate
    const query = `
      SELECT
        player_id, player_type, season,
        plate_x_bin AS plate_x,
        plate_z_bin AS plate_z,
        pitch_type, pitch_type_description,
        pitch_result_category, pitch_result_category AS pitch_result_description,
        zone, in_strike_zone, pitch_count,
        avg_velocity AS release_speed,
        avg_spin_rate AS release_spin_rate,
        latest_game_date,
        called_strikes, swinging_strikes, balls, fouls, in_play,
        called_strike_rate, swinging_strike_rate, ball_rate, foul_rate, in_play_rate, strike_rate
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitch_heatmap\`
      WHERE player_id = @player_id AND player_type = @player_type
        ${career ? 'AND season IS NULL' : 'AND season = @season'}
      LIMIT 500
    `;
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
    const pid = String(playerId);

    const [playerRows, batterRows, pitcherRows] = await Promise.all([
      runQuery(`SELECT * FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` WHERE player_id = @player_id LIMIT 1`, { player_id: pid }),
      runQuery(`SELECT player_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` WHERE player_id = @player_id LIMIT 1`, { player_id: pid }),
      runQuery(`SELECT player_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_season_stats\` WHERE player_id = @player_id LIMIT 1`, { player_id: pid })
    ]);

    const player = playerRows?.[0];
    if (!player) return res.json(null);

    const isBatter = batterRows.length > 0;
    const isPitcher = pitcherRows.length > 0;
    player.is_batter = isBatter;
    player.is_pitcher = isPitcher;
    player.is_two_way_player = isBatter && isPitcher;

    res.json(player);
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
    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__pitch_zone_outcomes\`
      WHERE player_id = @player_id
        AND player_type = @player_type
        AND season = @season
      ORDER BY zone
    `;
    const data = await runQuery(query, { player_id: String(playerId), player_type: playerType, season: parseIntParam(season, 2025) });
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

// --- PREDICTIONS ROUTES ---
const PREDICTIONS_DATASET = 'mlb_modeling';

app.get('/api/mlb/predictions/today', async (req, res) => {
  try {
    const { riskProfile = 'balanced', limit = 20 } = req.query;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Batting average thresholds per risk profile
    const thresholds = {
      aggressive: 0.20,
      balanced: 0.25,
      conservative: 0.28,
      very_conservative: 0.30,
      ultra_conservative: 0.33
    };
    const minAvg = thresholds[riskProfile] ?? 0.25;

    // Find the most recent date with data (today if available, otherwise latest)
    const dateRows = await runQuery(
      `SELECT MAX(game_date) as game_date FROM \`${process.env.GCP_PROJECT_ID}.${PREDICTIONS_DATASET}.ml_mlb__daily_predictions\` WHERE game_date <= @today`,
      { today }
    );
    const targetDate = dateRows?.[0]?.game_date?.value || dateRows?.[0]?.game_date || today;

    // Deduplicate: one row per player per game (multiple rows exist per pitcher faced)
    const query = `
      WITH deduped AS (
        SELECT
          player_id,
          ANY_VALUE(game_id) AS game_id,
          game_date,
          MAX(rolling_batting_avg_L30) AS rolling_batting_avg_L30,
          ANY_VALUE(home_vs_away) AS home_vs_away
        FROM \`${process.env.GCP_PROJECT_ID}.${PREDICTIONS_DATASET}.ml_mlb__daily_predictions\`
        WHERE game_date = @target_date
        GROUP BY player_id, game_date
      )
      SELECT
        p.player_id,
        d.full_name AS player_name,
        CASE WHEN p.home_vs_away = 1 THEN g.home_team_abbr ELSE g.away_team_abbr END AS team_id,
        CASE WHEN p.home_vs_away = 1 THEN g.away_team_abbr ELSE g.home_team_abbr END AS opponent_team_id,
        p.game_date,
        NULL AS game_time,
        NULL AS batting_order_position,
        p.rolling_batting_avg_L30 AS hit_probability,
        p.rolling_batting_avg_L30 AS confidence_score,
        ROW_NUMBER() OVER (ORDER BY p.rolling_batting_avg_L30 DESC) AS rank_overall,
        NULL AS prediction_timestamp
      FROM deduped p
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` d ON p.player_id = d.player_id
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__games\` g ON p.game_id = g.game_id
      WHERE p.rolling_batting_avg_L30 >= @min_avg
      ORDER BY p.rolling_batting_avg_L30 DESC
      LIMIT @limit
    `;

    const data = await runQuery(query, {
      target_date: targetDate,
      min_avg: minAvg,
      limit: parseLimit(limit, 20, 100)
    });

    res.json({ success: true, date: targetDate, riskProfile, count: data.length, predictions: data });
  } catch (err) {
    console.error('Error fetching predictions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/mlb/predictions/top', async (req, res) => {
  try {
    const { riskProfile = 'balanced' } = req.query;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    const dateRows = await runQuery(
      `SELECT MAX(game_date) as game_date FROM \`${process.env.GCP_PROJECT_ID}.${PREDICTIONS_DATASET}.ml_mlb__daily_predictions\` WHERE game_date <= @today`,
      { today }
    );
    const targetDate = dateRows?.[0]?.game_date?.value || dateRows?.[0]?.game_date || today;

    const query = `
      WITH deduped AS (
        SELECT
          player_id,
          ANY_VALUE(game_id) AS game_id,
          game_date,
          MAX(rolling_batting_avg_L30) AS rolling_batting_avg_L30,
          ANY_VALUE(home_vs_away) AS home_vs_away
        FROM \`${process.env.GCP_PROJECT_ID}.${PREDICTIONS_DATASET}.ml_mlb__daily_predictions\`
        WHERE game_date = @target_date
          AND rolling_batting_avg_L30 IS NOT NULL
        GROUP BY player_id, game_date
      )
      SELECT
        p.player_id,
        d.full_name AS player_name,
        CASE WHEN p.home_vs_away = 1 THEN g.home_team_abbr ELSE g.away_team_abbr END AS team_id,
        CASE WHEN p.home_vs_away = 1 THEN g.away_team_abbr ELSE g.home_team_abbr END AS opponent_team_id,
        p.game_date,
        p.rolling_batting_avg_L30 AS hit_probability,
        1 AS rank_overall
      FROM deduped p
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` d ON p.player_id = d.player_id
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__games\` g ON p.game_id = g.game_id
      ORDER BY p.rolling_batting_avg_L30 DESC
      LIMIT 1
    `;

    const data = await runQuery(query, { target_date: targetDate });
    res.json({ success: true, riskProfile, topPick: data?.[0] || null });
  } catch (err) {
    console.error('Error fetching top pick:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- FINAL 404 HANDLER ---
app.use((req, res) => {
  console.log(`404 hit: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found", path: req.url });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Backend running on port ${PORT}`));