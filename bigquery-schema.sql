-- Stats HQ BigQuery Schema
-- Run these queries in Google BigQuery to create your sports data tables
-- Replace 'your-project-id' with your actual GCP project ID

-- Create the dataset
CREATE SCHEMA IF NOT EXISTS `your-project-id.sports_data`
OPTIONS(
  location="US",
  description="Sports statistics data for Stats HQ"
);

-- ============================================================================
-- NBA TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `your-project-id.sports_data.nba_teams` (
  team_id STRING,
  team_name STRING,
  wins INT64,
  losses INT64,
  points_per_game FLOAT64,
  rebounds_per_game FLOAT64,
  assists_per_game FLOAT64,
  season STRING,
  last_updated TIMESTAMP,
  conference STRING,
  division STRING
) PARTITION BY DATE(last_updated);

-- Sample NBA data
INSERT INTO `your-project-id.sports_data.nba_teams` VALUES
('LAL', 'Lakers', 48, 34, 115.2, 44.5, 25.8, '2023-24', CURRENT_TIMESTAMP(), 'West', 'Pacific'),
('BOS', 'Celtics', 52, 30, 118.5, 46.2, 27.1, '2023-24', CURRENT_TIMESTAMP(), 'East', 'Atlantic'),
('GSW', 'Warriors', 45, 37, 116.8, 43.8, 26.5, '2023-24', CURRENT_TIMESTAMP(), 'West', 'Pacific'),
('MIA', 'Heat', 50, 32, 112.4, 44.1, 25.3, '2023-24', CURRENT_TIMESTAMP(), 'East', 'Southeast'),
('DEN', 'Nuggets', 53, 29, 114.7, 45.6, 27.8, '2023-24', CURRENT_TIMESTAMP(), 'West', 'Northwest'),
('MIL', 'Bucks', 49, 33, 117.2, 45.9, 26.2, '2023-24', CURRENT_TIMESTAMP(), 'East', 'Central');

-- ============================================================================
-- NHL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `your-project-id.sports_data.nhl_teams` (
  team_id STRING,
  team_name STRING,
  wins INT64,
  losses INT64,
  overtime_losses INT64,
  goals_for INT64,
  goals_against INT64,
  season STRING,
  last_updated TIMESTAMP,
  conference STRING,
  division STRING
) PARTITION BY DATE(last_updated);

-- Sample NHL data
INSERT INTO `your-project-id.sports_data.nhl_teams` VALUES
('BOS', 'Boston Bruins', 47, 20, 5, 245, 178, '2023-24', CURRENT_TIMESTAMP(), 'East', 'Atlantic'),
('CAR', 'Carolina Hurricanes', 45, 22, 5, 238, 195, '2023-24', CURRENT_TIMESTAMP(), 'East', 'Metropolitan'),
('COL', 'Colorado Avalanche', 50, 19, 6, 272, 201, '2023-24', CURRENT_TIMESTAMP(), 'West', 'Central'),
('VGK', 'Vegas Golden Knights', 42, 26, 6, 226, 215, '2023-24', CURRENT_TIMESTAMP(), 'West', 'Pacific'),
('NYR', 'New York Rangers', 48, 21, 4, 241, 189, '2023-24', CURRENT_TIMESTAMP(), 'East', 'Metropolitan'),
('DAL', 'Dallas Stars', 44, 22, 8, 235, 198, '2023-24', CURRENT_TIMESTAMP(), 'West', 'Central');

-- ============================================================================
-- MLB TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `your-project-id.sports_data.mlb_teams` (
  team_id STRING,
  team_name STRING,
  wins INT64,
  losses INT64,
  runs_scored INT64,
  runs_allowed INT64,
  batting_avg FLOAT64,
  era FLOAT64,
  season STRING,
  last_updated TIMESTAMP,
  league STRING,
  division STRING
) PARTITION BY DATE(last_updated);

-- Sample MLB data
INSERT INTO `your-project-id.sports_data.mlb_teams` VALUES
('ATL', 'Atlanta Braves', 104, 58, 947, 664, 0.271, 3.85, '2023', CURRENT_TIMESTAMP(), 'NL', 'East'),
('LAD', 'Los Angeles Dodgers', 100, 62, 906, 682, 0.265, 4.02, '2023', CURRENT_TIMESTAMP(), 'NL', 'West'),
('BAL', 'Baltimore Orioles', 101, 61, 807, 682, 0.257, 4.22, '2023', CURRENT_TIMESTAMP(), 'AL', 'East'),
('TB', 'Tampa Bay Rays', 99, 63, 785, 641, 0.256, 3.82, '2023', CURRENT_TIMESTAMP(), 'AL', 'East'),
('HOU', 'Houston Astros', 90, 72, 832, 712, 0.265, 4.15, '2023', CURRENT_TIMESTAMP(), 'AL', 'West'),
('TEX', 'Texas Rangers', 90, 72, 881, 750, 0.262, 4.35, '2023', CURRENT_TIMESTAMP(), 'AL', 'West');

-- ============================================================================
-- NFL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS `your-project-id.sports_data.nfl_teams` (
  team_id STRING,
  team_name STRING,
  wins INT64,
  losses INT64,
  ties INT64,
  points_for INT64,
  points_against INT64,
  yards_per_game FLOAT64,
  season STRING,
  last_updated TIMESTAMP,
  conference STRING,
  division STRING
) PARTITION BY DATE(last_updated);

-- Sample NFL data
INSERT INTO `your-project-id.sports_data.nfl_teams` VALUES
('SF', 'San Francisco 49ers', 12, 5, 0, 492, 298, 389.4, '2023', CURRENT_TIMESTAMP(), 'NFC', 'West'),
('BAL', 'Baltimore Ravens', 13, 4, 0, 528, 325, 402.1, '2023', CURRENT_TIMESTAMP(), 'AFC', 'North'),
('DET', 'Detroit Lions', 12, 5, 0, 457, 371, 379.2, '2023', CURRENT_TIMESTAMP(), 'NFC', 'North'),
('DAL', 'Dallas Cowboys', 12, 5, 0, 509, 342, 385.6, '2023', CURRENT_TIMESTAMP(), 'NFC', 'East'),
('BUF', 'Buffalo Bills', 11, 6, 0, 451, 344, 371.8, '2023', CURRENT_TIMESTAMP(), 'AFC', 'East'),
('KC', 'Kansas City Chiefs', 11, 6, 0, 398, 284, 348.9, '2023', CURRENT_TIMESTAMP(), 'AFC', 'West');

-- ============================================================================
-- ANALYTICS VIEWS (Optional but helpful)
-- ============================================================================

-- NBA Team Rankings View
CREATE OR REPLACE VIEW `your-project-id.sports_data.nba_rankings` AS
SELECT 
  team_name,
  wins,
  losses,
  ROUND(wins / (wins + losses), 3) as win_percentage,
  points_per_game,
  season,
  RANK() OVER (PARTITION BY season ORDER BY wins DESC) as ranking
FROM `your-project-id.sports_data.nba_teams`
WHERE season = '2023-24';

-- NHL Team Rankings View
CREATE OR REPLACE VIEW `your-project-id.sports_data.nhl_rankings` AS
SELECT 
  team_name,
  wins,
  losses,
  overtime_losses,
  (wins * 2 + overtime_losses) as points,
  goals_for,
  goals_against,
  (goals_for - goals_against) as goal_differential,
  season,
  RANK() OVER (PARTITION BY season ORDER BY (wins * 2 + overtime_losses) DESC) as ranking
FROM `your-project-id.sports_data.nhl_teams`
WHERE season = '2023-24';

-- ============================================================================
-- USEFUL QUERIES
-- ============================================================================

-- Query 1: Get top 10 NBA teams by wins
SELECT team_name, wins, losses, points_per_game
FROM `your-project-id.sports_data.nba_teams`
WHERE season = '2023-24'
ORDER BY wins DESC
LIMIT 10;

-- Query 2: Get NHL teams with best goal differential
SELECT team_name, goals_for, goals_against, 
       (goals_for - goals_against) as goal_diff
FROM `your-project-id.sports_data.nhl_teams`
WHERE season = '2023-24'
ORDER BY goal_diff DESC
LIMIT 10;

-- Query 3: Get MLB teams with highest run production
SELECT team_name, runs_scored, batting_avg, era
FROM `your-project-id.sports_data.mlb_teams`
WHERE season = '2023'
ORDER BY runs_scored DESC
LIMIT 10;

-- Query 4: Get NFL teams with best point differential
SELECT team_name, wins, losses, points_for, points_against,
       (points_for - points_against) as point_diff
FROM `your-project-id.sports_data.nfl_teams`
WHERE season = '2023'
ORDER BY point_diff DESC
LIMIT 10;
