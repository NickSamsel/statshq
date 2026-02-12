import axios from 'axios'

// This service connects to your backend API that interacts with BigQuery
// In production, you'll need a backend service to handle BigQuery authentication

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'

/**
 * Fetch NHL data from BigQuery
 */
export const fetchNHLData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nhl`)
    return response.data
  } catch (error) {
    console.error('Error fetching NHL data:', error)
    // Return mock data if API is not available
    return getMockNHLData()
  }
}

/**
 * Fetch MLB data from BigQuery
 */
export const fetchMLBData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb`)
    return response.data
  } catch (error) {
    console.error('Error fetching MLB data:', error)
    return getMockMLBData()
  }
}

/**
 * Fetch MLB team standings
 */
export const fetchMLBTeams = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/teams`)
    return response.data
  } catch (error) {
    console.error('Error fetching MLB teams:', error)
    throw error
  }
}

/**
 * Fetch MLB batting stats
 * @param {Object} params - Query parameters (limit, minAtBats)
 */
export const fetchMLBBattingStats = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/batting`, { params })
    return response.data
  } catch (error) {
    console.error('Error fetching MLB batting stats:', error)
    throw error
  }
}

/**
 * Fetch MLB pitching stats
 * @param {Object} params - Query parameters (limit, minInnings)
 */
export const fetchMLBPitchingStats = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/pitching`, { params })
    return response.data
  } catch (error) {
    console.error('Error fetching MLB pitching stats:', error)
    throw error
  }
}

/**
 * Fetch recent MLB games
 * @param {Object} params - Query parameters (limit)
 */
export const fetchMLBRecentGames = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/games/recent`, { params })
    return response.data
  } catch (error) {
    console.error('Error fetching MLB games:', error)
    throw error
  }
}

/**
 * Fetch MLB Statcast exit velocity data
 * @param {Object} params - Query parameters (limit)
 */
export const fetchMLBStatcastExitVelocity = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/mlb/statcast/exit-velocity`, { params })
    return response.data
  } catch (error) {
    console.error('Error fetching MLB Statcast data:', error)
    throw error
  }
}

/**
 * Fetch NFL data from BigQuery
 */
export const fetchNFLData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nfl`)
    return response.data
  } catch (error) {
    console.error('Error fetching NFL data:', error)
    return getMockNFLData()
  }
}

/**
 * Fetch NBA data from BigQuery
 */
export const fetchNBAData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nba`)
    return response.data
  } catch (error) {
    console.error('Error fetching NBA data:', error)
    return getMockNBAData()
  }
}

// Mock data for development/testing
const getMockNHLData = () => [
  { name: 'Team A', value: 45 },
  { name: 'Team B', value: 38 },
  { name: 'Team C', value: 52 },
  { name: 'Team D', value: 41 },
]

const getMockMLBData = () => [
  { name: 'Team A', value: 92 },
  { name: 'Team B', value: 85 },
  { name: 'Team C', value: 78 },
  { name: 'Team D', value: 88 },
]

const getMockNFLData = () => [
  { name: 'Team A', value: 12 },
  { name: 'Team B', value: 9 },
  { name: 'Team C', value: 11 },
  { name: 'Team D', value: 8 },
]

const getMockNBAData = () => [
  { name: 'Team A', value: 48 },
  { name: 'Team B', value: 52 },
  { name: 'Team C', value: 45 },
  { name: 'Team D', value: 50 },
]
