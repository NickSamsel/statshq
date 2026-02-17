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
const DATASET = 'mlb';

const columnCache = new Map();

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

async function getTableColumnsLower(tableName) {
  if (!tableName) return new Map();
  const cacheKey = `cols:${tableName}`;
  if (columnCache.has(cacheKey)) return columnCache.get(cacheKey);

  const query = `
    SELECT column_name
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
    WHERE table_name = @table_name`;

  const rows = await runQuery(query, { table_name: tableName });
  const map = new Map();
  for (const r of rows) {
    if (r?.column_name) map.set(String(r.column_name).toLowerCase(), String(r.column_name));
  }
  columnCache.set(cacheKey, map);
  return map;
}

async function getFirstExistingColumn(tableName, candidateNames = []) {
  const candidates = (candidateNames || []).map((c) => String(c).toLowerCase());
  const cacheKey = `firstcol:${tableName}:${candidates.join('|')}`;
  if (columnCache.has(cacheKey)) return columnCache.get(cacheKey);

  const cols = await getTableColumnsLower(tableName);
  const found = candidates.find((c) => cols.has(c)) || null;
  const resolved = found ? cols.get(found) : null;
  columnCache.set(cacheKey, resolved);
  return resolved;
}

app.get('/', (req, res) => {
  res.json({
    name: 'Stats HQ API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      mlb: {
        playerSearch: '/api/mlb/players/search?q=playername',
        playerInfo: '/api/mlb/players/:playerId/info',
        playerSeasons: '/api/mlb/players/:playerId/seasons',
        pitchLocations: '/api/mlb/statcast/pitch-locations?playerId=XXX&season=2024&viewType=batting',
        battedBallStats: '/api/mlb/statcast/batted-ball-stats?playerId=XXX&season=2024&viewType=batting',
        seasonBattingStats: '/api/mlb/players/season-batting-stats?playerId=XXX&season=2024',
        seasonPitchingStats: '/api/mlb/players/season-pitching-stats?playerId=XXX&season=2024',
        batting: '/api/mlb/batting?season=2024&limit=20',
        venues: '/api/mlb/venues',
        rosters: '/api/mlb/teams/:teamId/roster?season=2024',
      }
    }
  });
});

// Health check (Verify this at http://localhost:8080/health)
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Silently handle common browser requests
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/*', (req, res) => res.status(204).end());

// Seasons available for team tables
app.get('/api/mlb/teams/seasons', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT season
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\`
      ORDER BY season DESC`;
    const data = await runQuery(query);
    res.json(data.map(r => r.season));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List teams for a season (defaults to most recent season)
app.get('/api/mlb/teams/list', async (req, res) => {
  try {
    const seasonParam = req.query.season;
    let season = seasonParam ? parseIntParam(seasonParam, null) : null;

    if (!season) {
      const seasonQuery = `
        SELECT MAX(season) as season
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\``;
      const seasonRows = await runQuery(seasonQuery);
      season = seasonRows?.[0]?.season;
    }

    const query = `
      SELECT DISTINCT
        team_id,
        team_name,
        team_abbr,
        league_id,
        league_name,
        league_abbr,
        division_id,
        division_name,
        division_abbr,
        season
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\`
      WHERE season = @season
      ORDER BY team_name`;

    const data = await runQuery(query, { season });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Standings for a season/date (defaults to most recent standings date for that season)
app.get('/api/mlb/teams/standings', async (req, res) => {
  try {
    const season = parseIntParam(req.query.season, 2025);
    const standingsDate = req.query.date ? String(req.query.date) : null;

    if (!standingsDate) {
      const dateQuery = `
        SELECT MAX(standings_date) as standings_date
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
        WHERE season = @season`;
      const dateRows = await runQuery(dateQuery, { season });
      const latestDate = dateRows?.[0]?.standings_date;

      const query = `
        SELECT *
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
        WHERE season = @season AND standings_date = @standings_date
        ORDER BY league_name, division_name, division_rank, win_pct DESC`;
      const data = await runQuery(query, { season, standings_date: latestDate });
      return res.json({ season, standings_date: latestDate, rows: data });
    }

    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
      WHERE season = @season AND standings_date = @standings_date
      ORDER BY league_name, division_name, division_rank, win_pct DESC`;
    const data = await runQuery(query, { season, standings_date: standingsDate });
    res.json({ season, standings_date: standingsDate, rows: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Back-compat: /api/mlb/teams returns standings
app.get('/api/mlb/teams', async (req, res) => {
  try {
    const season = parseIntParam(req.query.season, 2025);

    const dateQuery = `
      SELECT MAX(standings_date) as standings_date
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
      WHERE season = @season`;
    const dateRows = await runQuery(dateQuery, { season });
    const latestDate = dateRows?.[0]?.standings_date;

    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
      WHERE season = @season AND standings_date = @standings_date
      ORDER BY league_name, division_name, division_rank, win_pct DESC`;
    const data = await runQuery(query, { season, standings_date: latestDate });
    res.json({ season, standings_date: latestDate, rows: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team season rollup
app.get('/api/mlb/teams/:teamId/season-stats', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);

    // Compute league ranks for "major" team stats using window functions.
    // (Higher is better unless noted: runs allowed / ERA / WHIP / BB/9 lower is better.)
    const query = `
      WITH ranked AS (
        SELECT
          t.*,
          RANK() OVER (ORDER BY wins DESC) AS wins_rank,
          RANK() OVER (ORDER BY win_pct DESC) AS win_pct_rank,
          RANK() OVER (ORDER BY total_run_differential DESC) AS run_diff_rank,
          RANK() OVER (ORDER BY total_runs_scored DESC) AS runs_scored_rank,
          RANK() OVER (ORDER BY total_runs_allowed ASC) AS runs_allowed_rank,
          RANK() OVER (ORDER BY season_ops DESC) AS ops_rank,
          RANK() OVER (ORDER BY season_batting_avg DESC) AS avg_rank,
          RANK() OVER (ORDER BY season_obp DESC) AS obp_rank,
          RANK() OVER (ORDER BY season_slg DESC) AS slg_rank,
          RANK() OVER (ORDER BY season_era ASC) AS era_rank,
          RANK() OVER (ORDER BY season_whip ASC) AS whip_rank,
          RANK() OVER (ORDER BY season_k_per_nine DESC) AS k9_rank,
          RANK() OVER (ORDER BY season_bb_per_nine ASC) AS bb9_rank
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\` t
        WHERE season = @season
      )
      SELECT *
      FROM ranked
      WHERE team_id = @team_id
      LIMIT 1`;
    const data = await runQuery(query, { team_id: teamId, season });
    res.json(data?.[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team statcast rollup
app.get('/api/mlb/teams/:teamId/statcast-metrics', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);

    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_statcast_metrics\`
      WHERE team_id = @team_id AND season = @season
      LIMIT 1`;
    const data = await runQuery(query, { team_id: teamId, season });
    res.json(data?.[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team game log (latest first)
app.get('/api/mlb/teams/:teamId/games', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);
    const limit = parseLimit(req.query.limit, 50, 300);

    const query = `
      SELECT *
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_game_stats\`
      WHERE team_id = @team_id AND season = @season
      ORDER BY game_date DESC
      LIMIT @limit`;
    const data = await runQuery(query, { team_id: teamId, season, limit });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Team roster for a season (derived from season stat tables)
// Returns players who appeared for the team in either batting or pitching season stats.
app.get('/api/mlb/teams/:teamId/roster', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);

    const query = `
      WITH batters AS (
        SELECT DISTINCT player_id
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\`
        WHERE team_id = @team_id AND season = @season
      ),
      pitchers AS (
        SELECT DISTINCT player_id
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_season_stats\`
        WHERE team_id = @team_id AND season = @season
      ),
      roster_flags AS (
        SELECT player_id, TRUE AS is_batter, FALSE AS is_pitcher FROM batters
        UNION ALL
        SELECT player_id, FALSE AS is_batter, TRUE AS is_pitcher FROM pitchers
      ),
      roster AS (
        SELECT
          player_id,
          MAX(CAST(is_batter AS INT64)) > 0 AS is_batter,
          MAX(CAST(is_pitcher AS INT64)) > 0 AS is_pitcher
        FROM roster_flags
        GROUP BY player_id
      )
      SELECT
        r.player_id,
        d.full_name AS player_name,
        d.primary_number,
        d.primary_position_abbr,
        d.bat_side_code,
        d.pitch_hand_code,
        r.is_batter,
        r.is_pitcher,
        @team_id AS team_id,
        @season AS season
      FROM roster r
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` d
        ON r.player_id = d.player_id
      ORDER BY
        r.is_pitcher DESC,
        d.primary_position_abbr,
        d.full_name`;

    const data = await runQuery(query, { team_id: String(teamId), season });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Team standings history (daily)
app.get('/api/mlb/teams/:teamId/standings-history', async (req, res) => {
  try {
    const { teamId } = req.params;
    const season = parseIntParam(req.query.season, 2025);

    const query = `
      SELECT
        standings_date,
        season,
        team_id,
        team_name,
        team_abbr,
        league_name,
        division_name,
        division_rank,
        wins,
        losses,
        games_played,
        win_pct,
        games_back,
        wildcard_games_back,
        run_differential,
        pythagorean_win_pct,
        luck_factor,
        streak,
        last_ten_record
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__standings\`
      WHERE team_id = @team_id AND season = @season
      ORDER BY standings_date`;

    const data = await runQuery(query, { team_id: teamId, season });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pitch zone outcomes (aggregated) for improved heatmap
app.get('/api/mlb/statcast/pitch-zone-outcomes', async (req, res) => {
  try {
    const { playerId, season = 2024, viewType = 'batting' } = req.query;
    const playerType = viewType === 'pitching' ? 'pitcher' : 'batter';

    const career = isCareerSeasonParam(season);

    if (career) {
      const query = `
        SELECT
          @player_id as player_id,
          @player_type as player_type,
          NULL as season,
          zone,
          ANY_VALUE(in_strike_zone) as in_strike_zone,
          SUM(total_pitches) as total_pitches,
          SUM(called_strikes) as called_strikes,
          SUM(swinging_strikes) as swinging_strikes,
          SUM(balls) as balls,
          SUM(fouls) as fouls,
          SUM(in_play) as in_play,
          SUM(success_count) as success_count,
          SAFE_DIVIDE(SUM(called_strikes), SUM(total_pitches)) * 100 as called_strike_rate,
          SAFE_DIVIDE(SUM(swinging_strikes), SUM(total_pitches)) * 100 as swinging_strike_rate,
          SAFE_DIVIDE(SUM(balls), SUM(total_pitches)) * 100 as ball_rate,
          SAFE_DIVIDE(SUM(fouls), SUM(total_pitches)) * 100 as foul_rate,
          SAFE_DIVIDE(SUM(in_play), SUM(total_pitches)) * 100 as in_play_rate,
          SAFE_DIVIDE(SUM(success_count), SUM(total_pitches)) * 100 as success_rate,
          SAFE_DIVIDE(SUM(called_strikes) + SUM(swinging_strikes) + SUM(fouls) + SUM(in_play), SUM(total_pitches)) * 100 as strike_rate,
          SAFE_DIVIDE(SUM(avg_plate_x * total_pitches), SUM(total_pitches)) as avg_plate_x,
          SAFE_DIVIDE(SUM(avg_plate_z * total_pitches), SUM(total_pitches)) as avg_plate_z,
          SAFE_DIVIDE(SUM(avg_velocity * total_pitches), SUM(total_pitches)) as avg_velocity,
          SAFE_DIVIDE(SUM(avg_spin_rate * total_pitches), SUM(total_pitches)) as avg_spin_rate,
          ANY_VALUE(primary_pitch_type) as primary_pitch_type,
          ANY_VALUE(primary_pitch_description) as primary_pitch_description
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__pitch_zone_outcomes\`
        WHERE player_id = @player_id
          AND player_type = @player_type
        GROUP BY zone
        ORDER BY zone`;

      const data = await runQuery(query, {
        player_id: String(playerId),
        player_type: playerType
      });
      res.json(data);
      return;
    }

    const query = `
      SELECT
        player_id,
        player_type,
        season,
        zone,
        in_strike_zone,
        total_pitches,
        called_strikes,
        swinging_strikes,
        balls,
        fouls,
        in_play,
        success_count,
        called_strike_rate,
        swinging_strike_rate,
        ball_rate,
        foul_rate,
        in_play_rate,
        success_rate,
        strike_rate,
        avg_plate_x,
        avg_plate_z,
        avg_velocity,
        avg_spin_rate,
        primary_pitch_type,
        primary_pitch_description
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__pitch_zone_outcomes\`
      WHERE player_id = @player_id
        AND player_type = @player_type
        AND season = @season
      ORDER BY zone`;

    const data = await runQuery(query, {
      player_id: String(playerId),
      player_type: playerType,
      season: parseIntParam(season, 2024)
    });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// New: 3D Pitch Locations (Optimized - uses pre-aggregated heatmap)
app.get('/api/mlb/statcast/pitch-locations', async (req, res) => {
  try {
    const { playerId, season = 2025, viewType = 'batting' } = req.query;
    const playerType = viewType === 'batting' ? 'batter' : 'pitcher';
    const career = isCareerSeasonParam(season);

    // Use the new pre-aggregated heatmap mart (95% cost reduction)
    const query = `
      SELECT
        player_id,
        player_type,
        season,
        plate_x_bin as plate_x,
        plate_z_bin as plate_z,
        pitch_type,
        pitch_type_description,
        zone,
        in_strike_zone,
        pitch_count,
        avg_velocity as release_speed,
        avg_spin_rate as release_spin_rate,
        pitch_result_category,
        called_strike_rate,
        swinging_strike_rate,
        ball_rate,
        foul_rate,
        in_play_rate,
        strike_rate,
        latest_game_date
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitch_heatmap\`
      WHERE player_id = @player_id
        AND player_type = @player_type
        ${career ? 'AND season IS NULL' : 'AND season = @season'}
      ORDER BY pitch_count DESC
      LIMIT 500`;

    const params = {
      player_id: String(playerId),
      player_type: playerType
    };
    if (!career) {
      params.season = parseIntParam(season, 2025);
    }

    const data = await runQuery(query, params);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// New: Batted Ball Statistics (Optimized - uses pre-aggregated stats)
app.get('/api/mlb/statcast/batted-ball-stats', async (req, res) => {
  try {
    const { playerId, season = 2024, viewType = 'batting' } = req.query;
    const playerType = viewType === 'batting' ? 'batter' : 'pitcher';
    const career = isCareerSeasonParam(season);

    // Use the new pre-aggregated mart (80% cost reduction)
    const query = `
      SELECT
        player_id,
        player_type,
        season,
        total_batted_balls,
        avg_exit_velo,
        max_exit_velo,
        avg_launch_angle,
        avg_distance,
        max_distance,
        avg_sprint_speed,
        barrels,
        hard_hits,
        home_runs,
        hits,
        barrel_rate,
        hard_hit_rate,
        hit_rate,
        elite_velo_count,
        great_velo_count,
        good_velo_count,
        avg_velo_count,
        below_avg_velo_count,
        weak_velo_count,
        line_drives,
        fly_balls,
        ground_balls,
        pop_ups,
        line_drive_rate,
        fly_ball_rate,
        ground_ball_rate,
        latest_game_date
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batted_ball_season_stats\`
      WHERE player_id = @player_id
        AND player_type = @player_type
        ${career ? 'AND season IS NULL' : 'AND season = @season'}
      LIMIT 1`;

    const params = {
      player_id: String(playerId),
      player_type: playerType
    };
    if (!career) {
      params.season = parseIntParam(season, 2024);
    }

    const data = await runQuery(query, params);
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
      WITH player_seasons AS (
        SELECT
          player_id,
          season,
          ANY_VALUE(team_name) as team_name
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\`
        WHERE player_id = '${playerId}'
        GROUP BY player_id, season

        UNION ALL

        SELECT
          player_id,
          season,
          ANY_VALUE(team_name) as team_name
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_stats\`
        WHERE player_id = '${playerId}'
        GROUP BY player_id, season
      )
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
        lt.team_name as current_team_name,
        lt.season as current_team_season,
        -- All career stats from fct_mlb__players
        f.*
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__players\` d
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__players\` f
        ON d.player_id = f.player_id
      LEFT JOIN (
        SELECT
          season,
          team_name
        FROM player_seasons
        ORDER BY season DESC
        LIMIT 1
      ) lt ON TRUE
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
app.get('/api/mlb/players/:playerId/season-batting-stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    // Pivot to season-level player table (schema provided by user). We compute percentiles
    // per season with window functions so tooltips always have values.
    const query = `
      WITH base AS (
        SELECT
          s.player_id,
          s.team_id,
          s.season,
          SAFE_CAST(s.games_played AS INT64) AS games,
          SAFE_CAST(s.plate_appearances AS INT64) AS plate_appearances,
          SAFE_CAST(s.at_bats AS INT64) AS at_bats,
          SAFE_CAST(s.runs AS INT64) AS runs,
          SAFE_CAST(s.hits AS INT64) AS hits,
          SAFE_CAST(s.doubles AS INT64) AS doubles,
          SAFE_CAST(s.triples AS INT64) AS triples,
          SAFE_CAST(s.home_runs_traditional AS INT64) AS home_runs,
          SAFE_CAST(s.rbi AS INT64) AS rbi,
          SAFE_CAST(s.stolen_bases AS INT64) AS stolen_bases,
          SAFE_CAST(s.walks AS INT64) AS walks,
          SAFE_CAST(s.strikeouts AS INT64) AS strikeouts,
          SAFE_CAST(s.batting_average AS FLOAT64) AS avg,
          SAFE_CAST(s.on_base_percentage AS FLOAT64) AS obp,
          SAFE_CAST(s.slugging_percentage AS FLOAT64) AS slg,
          SAFE_CAST(s.ops AS FLOAT64) AS ops,
          SAFE_CAST(s.simplified_offensive_war AS FLOAT64) AS war
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` s
      ),
      with_team AS (
        SELECT
          b.*,
          ts.team_name AS team_name
        FROM base b
        LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\` ts
          ON ts.team_id = b.team_id AND ts.season = b.season
      ),
      ranked AS (
        SELECT
          wt.*,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY runs), 100) AS runs_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY hits), 100) AS hits_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY home_runs), 100) AS home_runs_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY rbi), 100) AS rbi_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY stolen_bases), 100) AS stolen_bases_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY walks), 100) AS walks_percentile,
          SAFE_MULTIPLY(1 - PERCENT_RANK() OVER (PARTITION BY season ORDER BY strikeouts), 100) AS strikeouts_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY avg), 100) AS avg_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY obp), 100) AS obp_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY slg), 100) AS slg_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY ops), 100) AS ops_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY war), 100) AS war_percentile
        FROM with_team wt
      )
      SELECT *
      FROM ranked
      WHERE player_id = @player_id
      ORDER BY season DESC`;

    const data = await runQuery(query, { player_id: String(playerId) });
    
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
      war: row.war === null || row.war === undefined ? null : Number(row.war),
      runs_percentile: row.runs_percentile ?? null,
      hits_percentile: row.hits_percentile ?? null,
      home_runs_percentile: row.home_runs_percentile ?? null,
      rbi_percentile: row.rbi_percentile ?? null,
      stolen_bases_percentile: row.stolen_bases_percentile ?? null,
      walks_percentile: row.walks_percentile ?? null,
      strikeouts_percentile: row.strikeouts_percentile ?? null,
      avg_percentile: row.avg_percentile ?? null,
      obp_percentile: row.obp_percentile ?? null,
      slg_percentile: row.slg_percentile ?? null,
      ops_percentile: row.ops_percentile ?? null,
      war_percentile: row.war_percentile ?? null
    }));
    
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Player Season History - pitching stats by season (aggregated from game-level data)
app.get('/api/mlb/players/:playerId/season-pitching-stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    // Pivot to season-level pitching table (schema provided by user). Use stored percentiles
    // when available and compute missing ones so tooltips always have values.
    const query = `
      WITH base AS (
        SELECT
          p.player_id,
          p.team_id,
          p.season,
          SAFE_CAST(p.games_pitched AS INT64) AS games,
          SAFE_CAST(p.innings_pitched AS FLOAT64) AS innings_pitched,
          SAFE_CAST(p.hits_allowed AS INT64) AS hits,
          SAFE_CAST(p.runs_allowed AS INT64) AS runs,
          SAFE_CAST(p.walks_allowed AS INT64) AS walks,
          SAFE_CAST(p.strikeouts AS INT64) AS strikeouts,
          SAFE_CAST(p.era AS FLOAT64) AS era,
          SAFE_CAST(p.whip AS FLOAT64) AS whip,
          SAFE_CAST(p.k_percentage AS FLOAT64) AS k_percentage,
          SAFE_CAST(p.strike_pct AS FLOAT64) AS strike_percentage,
          SAFE_CAST(p.avg_pitch_velocity AS FLOAT64) AS avg_pitch_velocity,
          SAFE_CAST(p.max_pitch_velocity AS FLOAT64) AS max_pitch_velocity,
          SAFE_CAST(p.quality_starts AS INT64) AS quality_starts,
          SAFE_CAST(p.simplified_pitching_war AS FLOAT64) AS war,
          SAFE_CAST(p.era_percentile AS FLOAT64) AS era_percentile,
          SAFE_CAST(p.whip_percentile AS FLOAT64) AS whip_percentile,
          SAFE_CAST(p.k_percentage_percentile AS FLOAT64) AS k_percentage_percentile,
          SAFE_CAST(p.velocity_percentile AS FLOAT64) AS avg_pitch_velocity_percentile
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_season_stats\` p
      ),
      with_team AS (
        SELECT
          b.*,
          ts.team_name AS team_name
        FROM base b
        LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__team_season_stats\` ts
          ON ts.team_id = b.team_id AND ts.season = b.season
      ),
      ranked AS (
        SELECT
          wt.*,
          -- Prefer stored percentiles when present; otherwise compute (0-100).
          COALESCE(wt.era_percentile, SAFE_MULTIPLY(1 - PERCENT_RANK() OVER (PARTITION BY season ORDER BY era), 100)) AS era_percentile_final,
          COALESCE(wt.whip_percentile, SAFE_MULTIPLY(1 - PERCENT_RANK() OVER (PARTITION BY season ORDER BY whip), 100)) AS whip_percentile_final,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY innings_pitched), 100) AS innings_pitched_percentile,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY strikeouts), 100) AS strikeouts_percentile,
          SAFE_MULTIPLY(1 - PERCENT_RANK() OVER (PARTITION BY season ORDER BY walks), 100) AS walks_percentile,
          COALESCE(wt.k_percentage_percentile, SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY k_percentage), 100)) AS k_percentage_percentile_final,
          COALESCE(wt.avg_pitch_velocity_percentile, SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY avg_pitch_velocity), 100)) AS avg_pitch_velocity_percentile_final,
          SAFE_MULTIPLY(PERCENT_RANK() OVER (PARTITION BY season ORDER BY war), 100) AS war_percentile
        FROM with_team wt
      )
      SELECT
        player_id,
        team_id,
        team_name,
        season,
        games,
        innings_pitched,
        hits,
        runs,
        walks,
        strikeouts,
        era,
        whip,
        k_percentage,
        strike_percentage,
        avg_pitch_velocity,
        max_pitch_velocity,
        quality_starts,
        war,
        era_percentile_final AS era_percentile,
        whip_percentile_final AS whip_percentile,
        innings_pitched_percentile,
        strikeouts_percentile,
        walks_percentile,
        k_percentage_percentile_final AS k_percentage_percentile,
        avg_pitch_velocity_percentile_final AS avg_pitch_velocity_percentile,
        war_percentile
      FROM ranked
      WHERE player_id = @player_id
      ORDER BY season DESC`;

    const data = await runQuery(query, { player_id: String(playerId) });
    
    // Format response with proper types (caught_stealing, hit_by_pitch, sacrifice_flies, war not in schema)
    const formatted = data.map(row => ({
      season: row.season,
      team_name: row.team_name,
      games: row.games || 0,
      innings_pitched: row.innings_pitched_decimal || 0,
      walks: row.walks || 0,
      strikeouts: row.strikeouts || 0,
      hits: row.hits || 0,
      runs: row.runs || 0,
      era: row.era || 0,
      strike_percentage: row.strike_percentage || 0,
      k_percentage: row.k_percentage || 0,
      whip: row.whip || 0,
      avg_pitch_velocity: row.avg_pitch_velocity || 0,
      max_pitch_velocity: row.max_pitch_velocity || 0,
      statcast_primary_pitch: row.statcast_primary_pitch || null,
      quality_starts: row.quality_starts || 0,
      war: row.war === null || row.war === undefined ? null : Number(row.war),
      era_percentile: row.era_percentile ?? null,
      whip_percentile: row.whip_percentile ?? null,
      innings_pitched_percentile: row.innings_pitched_percentile ?? null,
      strikeouts_percentile: row.strikeouts_percentile ?? null,
      walks_percentile: row.walks_percentile ?? null,
      k_percentage_percentile: row.k_percentage_percentile ?? null,
      strike_percentage_percentile: row.strike_percentage_percentile ?? null,
      avg_pitch_velocity_percentile: row.avg_pitch_velocity_percentile ?? null,
      war_percentile: row.war_percentile ?? null
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

// Venue Information
app.get('/api/mlb/teams/:teamId/venues', async (req, res) => {
  try {
    const { teamId } = req.params; 
    const seasonVal = req.query.season || req.query.seasonParam;

    const query = `
      SELECT 
        venue_name,
        season,
        active,
        city,
        state,
        country,
        capacity,
        turf_type,
        roof_type,
        left_line,
        right_line,
        center,
        left_distance,
        right_distance,
        left_center,
        right_center,
        primary_home_team_id,
        primary_home_team_name
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.dim_mlb__venues\`
      WHERE season = @season 
      AND primary_home_team_id = @home_team_id`;

    const queryParams = {
      season: parseIntParam(seasonVal, 2025),
      home_team_id: String(teamId)
    };

    const data = await runQuery(query, queryParams);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
    

// --- 3. THE 404 HANDLER (MUST BE LAST) ---
app.use((req, res) => {
  console.log(`404 hit: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found", path: req.url });
});

app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));