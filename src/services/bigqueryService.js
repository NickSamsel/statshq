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
  outcome: Math.random() > 0.8 ? 'home_run' : 'strike',
  release_speed: (Math.random() * 20 + 80).toFixed(1) // Map to release_speed from schema
}));