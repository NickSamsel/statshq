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
        playerSearch: '/api/mlb/players/search?q=ohtani',
        playerInfo: '/api/mlb/players/:playerId/info',
        playerSeasons: '/api/mlb/players/:playerId/seasons',
        pitchLocations: '/api/mlb/statcast/pitch-locations?playerId=XXX&season=2024&viewType=batting',
        battedBallStats: '/api/mlb/statcast/batted-ball-stats?playerId=XXX&season=2024&viewType=batting',
        seasonBattingStats: '/api/mlb/players/season-batting-stats?playerId=XXX&season=2024',
        seasonPitchingStats: '/api/mlb/players/season-pitching-stats?playerId=XXX&season=2024',
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

/**
 * --- MLB Teams ---
 * Uses new team-level tables:
 * - fct_mlb__standings
 * - fct_mlb__team_season_stats
 * - fct_mlb__team_game_stats
 * - fct_mlb__team_statcast_metrics
 */

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

// New: 3D Pitch Locations
app.get('/api/mlb/statcast/pitch-locations', async (req, res) => {
  try {
    const { playerId, season = 2024, viewType = 'batting' } = req.query;
    
    // Determine which player ID field to use based on viewType
    const playerField = viewType === 'batting' ? 'batter_id' : 'pitcher_id';
    
    const career = isCareerSeasonParam(season);
    const seasonFilter = career ? '' : ` AND season = ${parseIntParam(season, 2024)}`;

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
        ${seasonFilter}
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
    
    const career = isCareerSeasonParam(season);
    const seasonFilter = career ? '' : ` AND season = ${parseIntParam(season, 2024)}`;

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
        ${seasonFilter}
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
    let battingWarCol = null;
    try {
      battingWarCol = await getFirstExistingColumn('fct_mlb__player_season_stats', [
        'batting_war',
        'war_batting',
        'position_player_war',
        'offensive_war',
        'war'
      ]);
    } catch {
      battingWarCol = null;
    }

    const battingRankMap = {
      avg_rank: ['avg_rank', 'batting_avg_rank', 'season_batting_avg_rank'],
      obp_rank: ['obp_rank', 'season_obp_rank'],
      slg_rank: ['slg_rank', 'season_slg_rank'],
      ops_rank: ['ops_rank', 'season_ops_rank'],
      home_runs_rank: ['home_runs_rank', 'hr_rank', 'season_home_runs_rank'],
      rbi_rank: ['rbi_rank', 'season_rbi_rank'],
      runs_rank: ['runs_rank', 'season_runs_rank'],
      hits_rank: ['hits_rank', 'season_hits_rank'],
      walks_rank: ['walks_rank', 'bb_rank', 'season_walks_rank'],
      strikeouts_rank: ['strikeouts_rank', 'so_rank', 'season_strikeouts_rank'],
      stolen_bases_rank: ['stolen_bases_rank', 'sb_rank', 'season_stolen_bases_rank'],
      war_rank: ['war_rank', 'batting_war_rank', 'position_player_war_rank']
    };

    let battingRankSelect = '';
    try {
      const rankEntries = await Promise.all(
        Object.entries(battingRankMap).map(async ([alias, candidates]) => {
          const col = await getFirstExistingColumn('fct_mlb__player_season_stats', candidates);
          return col ? { alias, col } : null;
        })
      );

      battingRankSelect = rankEntries
        .filter(Boolean)
        .map(({ alias, col }) => `, MAX(SAFE_CAST(s.${col} AS INT64)) as ${alias}`)
        .join('\n');
    } catch {
      battingRankSelect = '';
    }

    const warSelect = battingWarCol
      ? `MAX(SAFE_CAST(s.${battingWarCol} AS FLOAT64)) as war`
      : `NULL as war`;

    // Aggregate game-level data to season totals using BigQuery
    const query = `
      SELECT 
        b.season as season,
        MAX(team_name) as team_name,
        COUNT(DISTINCT game_id) as games,
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
        ROUND(SAFE_DIVIDE(SUM(hits) + SUM(walks), SUM(at_bats) + SUM(walks)) + SAFE_DIVIDE(SUM(total_bases), SUM(at_bats)), 3) as ops,
        ${warSelect}
        ${battingRankSelect}
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_batting_stats\` b
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` s
        ON s.player_id = b.player_id AND s.season = b.season
      WHERE b.player_id = '${playerId}'
      GROUP BY b.season
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
      war: row.war === null || row.war === undefined ? null : Number(row.war)
      , avg_rank: row.avg_rank ?? null
      , obp_rank: row.obp_rank ?? null
      , slg_rank: row.slg_rank ?? null
      , ops_rank: row.ops_rank ?? null
      , home_runs_rank: row.home_runs_rank ?? null
      , rbi_rank: row.rbi_rank ?? null
      , runs_rank: row.runs_rank ?? null
      , hits_rank: row.hits_rank ?? null
      , walks_rank: row.walks_rank ?? null
      , strikeouts_rank: row.strikeouts_rank ?? null
      , stolen_bases_rank: row.stolen_bases_rank ?? null
      , war_rank: row.war_rank ?? null
    }));
    
    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Player Season History - pitching stats by season (aggregated from game-level data)
app.get('/api/mlb/players/:playerId/season-pitching-stats', async (req, res) => {
  try {
    const { playerId } = req.params;
    let pitchingWarCol = null;
    try {
      pitchingWarCol = await getFirstExistingColumn('fct_mlb__player_season_stats', [
        'pitching_war',
        'war_pitching',
        'pwar',
        'war'
      ]);
    } catch {
      pitchingWarCol = null;
    }

    const pitchingRankMap = {
      era_rank: ['era_rank', 'season_era_rank'],
      whip_rank: ['whip_rank', 'season_whip_rank'],
      innings_pitched_rank: ['innings_pitched_rank', 'ip_rank', 'season_innings_pitched_rank'],
      strikeouts_rank: ['strikeouts_rank', 'so_rank', 'season_strikeouts_rank'],
      walks_rank: ['walks_rank', 'bb_rank', 'season_walks_rank'],
      k_percentage_rank: ['k_percentage_rank', 'season_k_percentage_rank', 'k_pct_rank'],
      strike_percentage_rank: ['strike_percentage_rank', 'season_strike_percentage_rank', 'strike_pct_rank'],
      avg_pitch_velocity_rank: ['avg_pitch_velocity_rank', 'velocity_rank', 'season_avg_pitch_velocity_rank'],
      war_rank: ['war_rank', 'pitching_war_rank', 'pwar_rank']
    };

    let pitchingRankSelect = '';
    try {
      const rankEntries = await Promise.all(
        Object.entries(pitchingRankMap).map(async ([alias, candidates]) => {
          const col = await getFirstExistingColumn('fct_mlb__player_season_stats', candidates);
          return col ? { alias, col } : null;
        })
      );

      pitchingRankSelect = rankEntries
        .filter(Boolean)
        .map(({ alias, col }) => `, MAX(SAFE_CAST(s.${col} AS INT64)) as ${alias}`)
        .join('\n');
    } catch {
      pitchingRankSelect = '';
    }

    const warSelect = pitchingWarCol
      ? `MAX(SAFE_CAST(s.${pitchingWarCol} AS FLOAT64)) as war`
      : `NULL as war`;

    // Aggregate game-level data to season totals using BigQuery
    const query = `
      WITH pitch_counts AS (
        -- Count occurrences of each pitch type per season
        SELECT 
          season,
          statcast_primary_pitch,
          COUNT(*) as pitch_freq,
          ROW_NUMBER() OVER(PARTITION BY season ORDER BY COUNT(*) DESC) as rank
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_stats\`
        WHERE player_id = '${playerId}'
        GROUP BY season, statcast_primary_pitch
      )
      SELECT 
        base.season,
        MAX(base.team_name) as team_name,
        COUNT(DISTINCT base.game_id) as games,
        SUM(CAST(base.innings_pitched_decimal AS FLOAT64)) as innings_pitched_decimal,
        SUM(base.walks) as walks,
        SUM(base.strikeouts) as strikeouts,
        SUM(base.hits) as hits,
        SUM(base.runs) as runs,
        SAFE_DIVIDE(SUM(base.runs) * 9, SUM(CAST(base.innings_pitched_decimal AS FLOAT64))) as era, 
        AVG(base.strike_percentage) as strike_percentage,
        SAFE_DIVIDE(SUM(base.hits) + SUM(base.walks), SUM(CAST(base.innings_pitched_decimal AS FLOAT64))) as whip,
        AVG(base.k_percentage) as k_percentage,
        AVG(base.avg_pitch_velocity) as avg_pitch_velocity,
        MAX(base.max_pitch_velocity) as max_pitch_velocity,
        pc.statcast_primary_pitch,
        COUNT(
          CASE WHEN base.is_quality_start IS TRUE THEN 1 END
        ) as quality_starts
        , ${warSelect}
        ${pitchingRankSelect}
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_pitching_stats\` AS base
      LEFT JOIN pitch_counts pc 
        ON base.season = pc.season AND pc.rank = 1
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET}.fct_mlb__player_season_stats\` s
        ON s.player_id = base.player_id AND s.season = base.season
      WHERE base.player_id = '${playerId}'
      GROUP BY base.season, pc.statcast_primary_pitch
      ORDER BY base.season DESC`;
    const data = await runQuery(query);
    
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
      war: row.war === null || row.war === undefined ? null : Number(row.war)
      , era_rank: row.era_rank ?? null
      , whip_rank: row.whip_rank ?? null
      , innings_pitched_rank: row.innings_pitched_rank ?? null
      , strikeouts_rank: row.strikeouts_rank ?? null
      , walks_rank: row.walks_rank ?? null
      , k_percentage_rank: row.k_percentage_rank ?? null
      , strike_percentage_rank: row.strike_percentage_rank ?? null
      , avg_pitch_velocity_rank: row.avg_pitch_velocity_rank ?? null
      , war_rank: row.war_rank ?? null
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