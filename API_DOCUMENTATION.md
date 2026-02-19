# Stats HQ API Documentation

## Base URL
```
http://localhost:8080/api
```

## System Endpoints

### Health Check
```http
GET /health
```
Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "time": "2024-09-30T12:00:00.000Z"
}
```

---

## MLB Team Endpoints

### Get Team Seasons
```http
GET /api/mlb/teams/seasons
```
Returns list of available seasons in the database.

**Response:**
```json
[2025, 2024, 2023, ...]
```

---

### Get Teams List
```http
GET /api/mlb/teams/list?season={season}
```
Returns list of teams for a specific season.

**Parameters:**
- `season` (optional): Season year (defaults to latest season)

**Response:**
```json
[
  {
    "team_id": "109",
    "team_name": "Arizona Diamondbacks",
    "team_abbr": "AZ",
    "league_name": "National League",
    "division_name": "National League West",
    "season": 2024
  }
]
```

---

### Get Team Season Stats
```http
GET /api/mlb/teams/:teamId/season-stats?season={season}
```
Returns comprehensive season statistics for a team with rankings.

**Parameters:**
- `season` (optional): Season year (defaults to 2025)

**Response:**
```json
{
  "team_id": "109",
  "team_name": "Arizona Diamondbacks",
  "wins": 89,
  "losses": 73,
  "win_pct": 0.549,
  "season_ops": 0.772,
  "season_era": 4.63,
  "ops_rank": 2,
  "era_rank": 27,
  "wins_rank": 5,
  "total_runs_scored": 886,
  "total_runs_allowed": 788,
  ...
}
```

---

### Get Team Games
```http
GET /api/mlb/teams/:teamId/games?season={season}&limit={limit}
```
Returns game-by-game results for a team.

**Parameters:**
- `season` (optional): Season year (defaults to 2025)
- `limit` (optional): Max results (default: 50, max: 300)

**Response:**
```json
[
  {
    "game_id": "746745",
    "game_date": "2024-09-30",
    "opponent_team_name": "San Diego Padres",
    "home_away": "home",
    "runs_scored": 5,
    "runs_allowed": 3,
    "is_win": true,
    "run_differential": 2
  }
]
```

---

### Get Team Statcast Metrics
```http
GET /api/mlb/teams/:teamId/statcast-metrics?season={season}
```
Returns aggregated Statcast metrics for a team (averaged across all players).

**Parameters:**
- `season` (optional): Season year (defaults to 2025)

**Response:**
```json
{
  "avg_exit_velocity": 87.44,
  "max_exit_velocity": 121.5,
  "avg_launch_angle": 12.47,
  "hard_hit_rate": 36.21,
  "barrel_rate": 2.33,
  "players_count": 647
}
```

---

### Get Team Standings History
```http
GET /api/mlb/teams/:teamId/standings-history?season={season}
```
Returns day-by-day standings data for a team throughout the season.

**Parameters:**
- `season` (optional): Season year (defaults to 2025)

**Response:**
```json
[
  {
    "team_id": "109",
    "team_name": "Arizona Diamondbacks",
    "season": 2024,
    "standings_date": "2024-04-03",
    "wins": 4,
    "losses": 3,
    "win_pct": 0.571,
    "games_back": 2,
    "division_rank": 2,
    "run_differential": 21
  }
]
```

---

### Get Team Venues
```http
GET /api/mlb/teams/:teamId/venues?season={season}
```
Returns venue/ballpark information for a team.

**Parameters:**
- `season` (optional): Season year (defaults to 2025)

**Response:**
```json
[
  {
    "venue_id": "15",
    "venue_name": "Chase Field",
    "city": "Phoenix",
    "state": "Arizona",
    "turf_type": "Grass",
    "roof_type": "Retractable",
    "left_line": 330,
    "center": 407,
    "right_line": 335
  }
]
```

---

### Get Team Roster
```http
GET /api/mlb/teams/:teamId/roster?season={season}
```
Returns active roster for a team.

**Parameters:**
- `season` (optional): Season year (defaults to 2025)

**Response:**
```json
[
  {
    "player_id": "660271",
    "player_name": "Ketel Marte",
    "primary_number": "4",
    "primary_position_abbr": "2B",
    "bat_side_code": "S",
    "pitch_hand_code": "R",
    "is_batter": true,
    "is_pitcher": false
  }
]
```

---

### Get Team Standings
```http
GET /api/mlb/teams/standings?season={season}&date={date}
```
Returns league-wide standings for a specific date.

**Parameters:**
- `season` (optional): Season year (defaults to 2025)
- `date` (optional): Date in YYYY-MM-DD format (defaults to latest)

**Response:**
```json
{
  "season": 2024,
  "standings_date": "2024-09-30",
  "rows": [...]
}
```

---

## MLB Player Endpoints

### Search Players
```http
GET /api/mlb/players/search?q={query}&limit={limit}
```
Searches for players by name.

**Parameters:**
- `q`: Search query string
- `limit` (optional): Max results (default: 100)

**Response:**
```json
[
  {
    "player_id": "660271",
    "player_name": "Ketel Marte"
  }
]
```

---

### Get Player Info
```http
GET /api/mlb/players/:playerId/info
```
Returns detailed player information.

**Response:**
```json
{
  "player_id": "660271",
  "full_name": "Ketel Marte",
  "first_name": "Ketel",
  "last_name": "Marte",
  "birth_date": "1993-10-12",
  "birth_city": "Santo Domingo",
  "birth_country": "Dominican Republic",
  "height": "6-1",
  "weight": 165,
  "primary_position_abbr": "2B",
  "bat_side_code": "S",
  "pitch_hand_code": "R"
}
```

---

### Get Player Batting Season Stats
```http
GET /api/mlb/players/:playerId/season-batting-stats
```
Returns all batting season stats for a player (career history).

**Response:**
```json
[
  {
    "player_id": "660271",
    "season": 2024,
    "team_name": "Arizona Diamondbacks",
    "games_played": 136,
    "plate_appearances": 583,
    "at_bats": 507,
    "hits": 156,
    "avg": 0.292,
    "obp": 0.37,
    "slg": 0.56,
    "ops": 0.93,
    "home_runs": 36
  }
]
```

---

### Get Player Pitching Season Stats
```http
GET /api/mlb/players/:playerId/season-pitching-stats
```
Returns all pitching season stats for a player (career history).

**Response:**
```json
[
  {
    "player_id": "543037",
    "season": 2024,
    "team_name": "Arizona Diamondbacks",
    "games_played": 33,
    "wins": 14,
    "losses": 6,
    "era": 3.2,
    "strikeouts": 200,
    "whip": 1.15
  }
]
```

---

### Get Player Season Stats (Single Season)
```http
GET /api/mlb/players/season-stats?playerId={playerId}&season={season}
```
Returns batting stats for a specific player and season.

**Parameters:**
- `playerId`: Player ID
- `season`: Season year

**Response:**
```json
{
  "player_id": "660271",
  "season": 2024,
  "avg": 0.292,
  "ops": 0.93,
  ...
}
```

---

## MLB Statcast Endpoints

### Get Pitch Locations
```http
GET /api/mlb/statcast/pitch-locations?playerId={playerId}&season={season}&viewType={type}
```
Returns pitch location heatmap data.

**Parameters:**
- `playerId`: Player ID
- `season` (optional): Season year or "career" (default: 2025)
- `viewType` (optional): "batting" or "pitching" (default: "batting")

**Response:**
```json
[
  {
    "player_id": "660271",
    "zone": 5,
    "pitch_count": 120,
    "swing_rate": 0.65
  }
]
```

---

### Get Pitch Zone Outcomes
```http
GET /api/mlb/statcast/pitch-zone-outcomes?playerId={playerId}&season={season}&viewType={type}
```
Returns aggregated pitch outcomes by strike zone.

**Parameters:**
- `playerId`: Player ID
- `season` (optional): Season year (default: 2025)
- `viewType` (optional): "batting" or "pitching" (default: "batting")

**Response:**
```json
[
  {
    "zone": 1,
    "pitch_count": 150,
    "avg_velocity": 93.5,
    "contact_count": 80,
    "called_strikes": 30,
    "swinging_strikes": 40
  }
]
```

---

### Get Batted Ball Stats
```http
GET /api/mlb/statcast/batted-ball-stats?playerId={playerId}&season={season}&viewType={type}
```
Returns batted ball metrics for a player.

**Parameters:**
- `playerId`: Player ID
- `season` (optional): Season year (default: 2025)
- `viewType` (optional): "batting" or "pitching" (default: "batting")

**Response:**
```json
{
  "player_id": "660271",
  "season": 2024,
  "player_type": "batter",
  "avg_exit_velo": 89.5,
  "max_exit_velo": 115.2,
  "avg_launch_angle": 14.2,
  "hard_hit_rate": 42.5,
  "barrel_rate": 8.3
}
```

---

### Get Exit Velocity Leaders
```http
GET /api/mlb/statcast/exit-velocity?season={season}&limit={limit}
```
Returns top players by average exit velocity.

**Parameters:**
- `season` (optional): Season year (default: 2025)
- `limit` (optional): Max results (default: 20)

**Response:**
```json
[
  {
    "player_id": "660271",
    "player_type": "batter",
    "avg_exit_velo": 91.2,
    "max_exit_velo": 118.5,
    "hard_hit_rate": 48.3
  }
]
```

---

## MLB Leaderboard Endpoints

### Get Batting Leaders
```http
GET /api/mlb/batting?season={season}&limit={limit}
```
Returns batting leaderboard.

**Parameters:**
- `season` (optional): Season year (default: 2025)
- `limit` (optional): Max results (default: 20)

**Response:**
```json
[
  {
    "player_id": "660271",
    "player_name": "Ketel Marte",
    "team_name": "Arizona Diamondbacks",
    "avg": 0.292,
    "obp": 0.37,
    "slg": 0.56,
    "ops": 0.93,
    "home_runs": 36,
    "rbi": 95,
    "stolen_bases": 10
  }
]
```

---

### Get Pitching Leaders
```http
GET /api/mlb/pitching?season={season}&limit={limit}
```
Returns pitching leaderboard.

**Parameters:**
- `season` (optional): Season year (default: 2025)
- `limit` (optional): Max results (default: 20)

**Response:**
```json
[
  {
    "player_id": "543037",
    "player_name": "Zac Gallen",
    "team_name": "Arizona Diamondbacks",
    "era": 3.2,
    "strikeouts": 200,
    "wins": 14,
    "whip": 1.15
  }
]
```

---

### Get Recent Games
```http
GET /api/mlb/games/recent
```
Returns the 20 most recent games across all teams.

**Response:**
```json
[
  {
    "game_id": "746745",
    "game_date": "2024-09-30",
    "team_id": "109",
    "team_name": "Arizona Diamondbacks",
    "opponent_team_name": "San Diego Padres",
    "runs_scored": 5,
    "runs_allowed": 3,
    "is_win": true
  }
]
```

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `404` - Route not found
- `500` - Server error (usually BigQuery issues)

---

## Notes

### Dataset Structure
- All endpoints query from the `mlb_marts` BigQuery dataset
- Data is pre-aggregated for performance
- Most queries complete in under 1 second

### Season Defaults
- Most endpoints default to season `2025`
- Use the `/api/mlb/teams/seasons` endpoint to see available seasons

### Rate Limiting
- Currently no rate limiting implemented
- BigQuery has monthly quota limits

### Data Freshness
- Data is updated via scheduled BigQuery jobs
- Check the repository documentation for update schedules
