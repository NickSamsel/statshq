import axios from 'axios';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

/**
 * MLB Spotlight Services
 */

/**
 * Fetches detailed rankings from fct_mlb__player_season_stats
 * Powers the Savant-style sliders in the sidebar
 */
export const fetchMLBPlayerSeasonStats = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/players/season-stats`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB player season stats:', error);
    // Returns mock fallback matching your BigQuery schema
    return getMockPlayerSeasonStats(params.playerId);
  }
};

/**
 * Fetches raw coordinates from fct_mlb__statcast_pitches
 * Powers the 3D Pitch Visualizer markers
 */
export const fetchMLBStatcastData = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/statcast/pitch-locations`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB pitch location data:', error);
    // Returns mock fallback for development
    return getMockPitchData();
  }
};

/**
 * Fetches aggregated batted ball statistics from fct_mlb__statcast_batted_balls
 * Powers the batted ball stats overlay
 */
export const fetchMLBBattedBallStats = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/statcast/batted-ball-stats`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB batted ball stats:', error);
    return getMockBattedBallStats();
  }
};

/**
 * Placeholder Sport Services (NBA, NHL, NFL)
 * Returns a signal that the UI interprets as "Not Created Yet"
 */
export const fetchNHLData = async () => ({ status: 'not_implemented', sport: 'NHL' });
export const fetchNFLData = async () => ({ status: 'not_implemented', sport: 'NFL' });
export const fetchNBAData = async () => ({ status: 'not_implemented', sport: 'NBA' });

/**
 * General MLB Utility Services
 */
export const fetchMLBTeamsList = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/list`, { params });
  return response.data;
};

export const fetchMLBTeams = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams`, { params });
  return response.data;
};

export const fetchMLBBattingStats = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/batting`, { params });
  return response.data;
};

export const fetchMLBPitchingStats = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/pitching`, { params });
  return response.data;
};

export const fetchMLBRecentGames = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/games/recent`, { params });
  return response.data;
};

export const fetchMLBStatcastExitVelocity = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/statcast/exit-velocity`, { params });
  return response.data;
};

/**
 * Player Explorer Services
 */

/**
 * Searches MLB players by name
 */
export const fetchMLBPlayersList = async (searchQuery = '', params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/players/search`, { 
      params: { q: searchQuery, ...params } 
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB players list:', error);
    return getMockPlayersList().filter(p => 
      p.player_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
};

/**
 * Fetches detailed player information
 */
export const fetchMLBPlayerInfo = async (playerId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/players/${playerId}/info`);
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB player info:', error);
    return getMockPlayerInfo(playerId);
  }
};

/**
 * Fetches player's season-by-season history
 */
export const fetchMLBPlayerSeasonHistory = async (playerId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/players/${playerId}/seasons`);
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB player season history:', error);
    return getMockSeasonHistory(playerId);
  }
};

/**
 * --- Development Mock Data Fallbacks ---
 * These match your provided dbt/BigQuery schemas exactly.
 */

const getMockPlayerSeasonStats = (playerId) => [{
  player_id: playerId || '660271',
  player_name: 'Shohei Ohtani',
  max_exit_velocity: 119.2,
  exit_velo_percentile: 99.1,
  barrel_rate: 22.4,
  barrel_rate_percentile: 98.5,
  hard_hit_rate: 54.2,
  hard_hit_rate_percentile: 96.0,
  home_runs_traditional: 44,
  avg_sprint_speed: 28.5,
  sprint_speed_percentile: 75.0,
  bat_side: 'L' // Mapping to hand logic in visualizer
}];

const getMockPitchData = () => Array.from({ length: 40 }, () => ({
  plate_x: (Math.random() - 0.5) * 2.5, // Horizontal position
  plate_z: Math.random() * 3.5 + 1.2,    // Vertical height
  pitch_result: Math.random() > 0.8 ? 'In play, run(s)' : 'StrikeCalled',
  release_speed: parseFloat((Math.random() * 20 + 80).toFixed(1)),
  pitch_type: ['FF', 'SL', 'CH', 'CU', 'SI'][Math.floor(Math.random() * 5)],
  pitch_type_description: 'Fastball',
  release_spin_rate: Math.floor(Math.random() * 1000 + 2000),
  pitch_result_category: ['Strike', 'Ball', 'In Play'][Math.floor(Math.random() * 3)],
  pitch_result_description: ['Called Strike', 'Ball', 'Swinging Strike', 'Foul', 'In play'][Math.floor(Math.random() * 5)],
  zone: Math.floor(Math.random() * 14) + 1,
  in_strike_zone: Math.random() > 0.5,
  game_date: { value: '2024-09-15' }
}));

const getMockBattedBallStats = () => ({
  total_batted_balls: 389,
  avg_exit_velo: 96.2,
  max_exit_velo: 117.5,
  avg_launch_angle: 18.9,
  avg_distance: 219.6,
  max_distance: 477,
  avg_sprint_speed: 28.5,
  barrels: 23,
  hard_hits: 237,
  home_runs: 44,
  hits: 151,
  barrel_rate: 5.9,
  hard_hit_rate: 60.9,
  hit_rate: 38.8,
  elite_velo_count: 45,
  plus_velo_count: 192,
  avg_velo_count: 142,
  below_avg_velo_count: 10,
  line_drives: 98,
  fly_balls: 156,
  ground_balls: 125,
  pop_ups: 10
});

const getMockPlayersList = () => [
  { player_id: '660271', player_name: 'Shohei Ohtani', team_name: 'Los Angeles Dodgers', primary_position: 'DH' },
  { player_id: '545361', player_name: 'Mike Trout', team_name: 'Los Angeles Angels', primary_position: 'CF' },
  { player_id: '592450', player_name: 'Aaron Judge', team_name: 'New York Yankees', primary_position: 'RF' },
  { player_id: '665742', player_name: 'Ronald Acuña Jr.', team_name: 'Atlanta Braves', primary_position: 'CF' },
  { player_id: '608070', player_name: 'Mookie Betts', team_name: 'Los Angeles Dodgers', primary_position: 'RF' },
  { player_id: '592789', player_name: 'Bryce Harper', team_name: 'Philadelphia Phillies', primary_position: '1B' },
  { player_id: '666176', player_name: 'Juan Soto', team_name: 'San Diego Padres', primary_position: 'LF' },
  { player_id: '677649', player_name: 'Gerrit Cole', team_name: 'New York Yankees', primary_position: 'P' },
  { player_id: '621111', player_name: 'Jacob deGrom', team_name: 'Texas Rangers', primary_position: 'P' },
  { player_id: '605141', player_name: 'Max Scherzer', team_name: 'Texas Rangers', primary_position: 'P' }
];

const getMockPlayerInfo = (playerId) => ({
  player_id: playerId,
  player_name: 'Shohei Ohtani',
  primary_number: '17',
  primary_position: 'DH',
  age: 29,
  height: '6\' 4"',
  weight: 210,
  mlb_debut: '2018-03-29',
  bat_side: 'L',
  pitch_hand: 'R',
  team_name: 'Los Angeles Dodgers'
});

const getMockSeasonHistory = (playerId) => [
  {
    season: '2024',
    team_abbrev: 'LAD',
    games: 159,
    plate_appearances: 731,
    at_bats: 636,
    runs: 134,
    hits: 185,
    doubles: 38,
    triples: 7,
    home_runs: 54,
    rbi: 130,
    stolen_bases: 59,
    caught_stealing: 8,
    walks: 81,
    strikeouts: 166,
    hit_by_pitch: 5,
    sacrifice_flies: 6,
    avg: 0.291,
    obp: 0.372,
    slg: 0.646,
    ops: 1.018,
    war: 9.2
  },
  {
    season: '2023',
    team_abbrev: 'LAA',
    games: 135,
    plate_appearances: 599,
    at_bats: 497,
    runs: 102,
    hits: 151,
    doubles: 26,
    triples: 5,
    home_runs: 44,
    rbi: 95,
    stolen_bases: 20,
    caught_stealing: 4,
    walks: 78,
    strikeouts: 131,
    hit_by_pitch: 8,
    sacrifice_flies: 4,
    avg: 0.304,
    obp: 0.412,
    slg: 0.654,
    ops: 1.066,
    war: 10.1
  },
  {
    season: '2022',
    team_abbrev: 'LAA',
    games: 157,
    plate_appearances: 666,
    at_bats: 586,
    runs: 90,
    hits: 160,
    doubles: 28,
    triples: 8,
    home_runs: 34,
    rbi: 95,
    stolen_bases: 11,
    caught_stealing: 5,
    walks: 72,
    strikeouts: 152,
    hit_by_pitch: 6,
    sacrifice_flies: 3,
    avg: 0.273,
    obp: 0.356,
    slg: 0.519,
    ops: 0.875,
    war: 9.6
  },
  {
    season: '2021',
    team_abbrev: 'LAA',
    games: 155,
    plate_appearances: 639,
    at_bats: 537,
    runs: 103,
    hits: 138,
    doubles: 26,
    triples: 8,
    home_runs: 46,
    rbi: 100,
    stolen_bases: 26,
    caught_stealing: 7,
    walks: 96,
    strikeouts: 189,
    hit_by_pitch: 4,
    sacrifice_flies: 2,
    avg: 0.257,
    obp: 0.372,
    slg: 0.592,
    ops: 0.965,
    war: 9.1
  },
  {
    season: '2020',
    team_abbrev: 'LAA',
    games: 44,
    plate_appearances: 175,
    at_bats: 153,
    runs: 23,
    hits: 29,
    doubles: 6,
    triples: 1,
    home_runs: 7,
    rbi: 24,
    stolen_bases: 7,
    caught_stealing: 1,
    walks: 19,
    strikeouts: 50,
    hit_by_pitch: 2,
    sacrifice_flies: 1,
    avg: 0.190,
    obp: 0.291,
    slg: 0.366,
    ops: 0.657,
    war: 1.0
  },
  {
    season: '2019',
    team_abbrev: 'LAA',
    games: 106,
    plate_appearances: 425,
    at_bats: 384,
    runs: 51,
    hits: 110,
    doubles: 20,
    triples: 6,
    home_runs: 18,
    rbi: 62,
    stolen_bases: 12,
    caught_stealing: 3,
    walks: 33,
    strikeouts: 110,
    hit_by_pitch: 7,
    sacrifice_flies: 1,
    avg: 0.286,
    obp: 0.343,
    slg: 0.505,
    ops: 0.848,
    war: 4.1
  },
  {
    season: '2018',
    team_abbrev: 'LAA',
    games: 104,
    plate_appearances: 367,
    at_bats: 326,
    runs: 59,
    hits: 93,
    doubles: 21,
    triples: 4,
    home_runs: 22,
    rbi: 61,
    stolen_bases: 10,
    caught_stealing: 5,
    walks: 33,
    strikeouts: 102,
    hit_by_pitch: 6,
    sacrifice_flies: 2,
    avg: 0.285,
    obp: 0.361,
    slg: 0.564,
    ops: 0.925,
    war: 4.0
  }
];