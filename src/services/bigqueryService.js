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
 * Fetches aggregated pitch outcomes by zone from fct_mlb__pitch_zone_outcomes
 * Useful for heatmaps (much smaller/faster than raw pitch locations)
 */
export const fetchMLBPitchZoneOutcomes = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/statcast/pitch-zone-outcomes`, { params });
  return response.data;
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
export const fetchMLBVenues = async (teamId, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/${teamId}/venues`, { params });
  return response.data;
};

export const fetchMLBTeamsList = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/list`, { params });
  return response.data;
};

export const fetchMLBTeams = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams`, { params });
  return response.data;
};

export const fetchMLBTeamSeasons = async () => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/seasons`);
  return response.data;
};

export const fetchMLBTeamStandings = async (params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/standings`, { params });
  return response.data;
};

export const fetchMLBTeamStandingsHistory = async (teamId, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/${teamId}/standings-history`, { params });
  return response.data;
};

export const fetchMLBTeamSeasonStats = async (teamId, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/${teamId}/season-stats`, { params });
  return response.data;
};

export const fetchMLBTeamGames = async (teamId, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/${teamId}/games`, { params });
  return response.data;
};

export const fetchMLBTeamStatcastMetrics = async (teamId, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/${teamId}/statcast-metrics`, { params });
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

export const fetchMLBPlayersTeamRoster = async (teamId, params = {}) => {
  const response = await axios.get(`${API_BASE_URL}/mlb/teams/${teamId}/roster`, { params });
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
 * Fetches player's season-by-season batting history
 */
export const fetchMLBPlayerBattingSeasons = async (playerId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/players/${playerId}/season-batting-stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB player batting seasons:', error);
    return getMockSeasonHistory(playerId);
  }
};

/**
 * Fetches player's season-by-season pitching history
 */
export const fetchMLBPlayerPitchingSeasons = async (playerId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/players/${playerId}/season-pitching-stats`);
    return response.data;
  } catch (error) {
    console.error('Error fetching MLB player pitching seasons:', error);
    return getMockSeasonHistory(playerId);
  }
};

/**
 * Fetches player's season-by-season history (legacy - prefer specific endpoints)
 * @deprecated Use fetchMLBPlayerBattingSeasons or fetchMLBPlayerPitchingSeasons instead
 */
export const fetchMLBPlayerSeasonHistory = async (playerId) => {
  // Default to batting stats for backwards compatibility
  return fetchMLBPlayerBattingSeasons(playerId);
};

