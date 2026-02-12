import React, { useState, useEffect } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ScatterChart, Scatter, ZAxis 
} from 'recharts'
import { 
  fetchMLBTeamsList,
  fetchMLBTeams, 
  fetchMLBBattingStats, 
  fetchMLBPitchingStats,
  fetchMLBRecentGames,
  fetchMLBStatcastExitVelocity 
} from '../services/bigqueryService'

function MLBStats() {
  const [activeTab, setActiveTab] = useState('teams')
  const [season, setSeason] = useState(2025)
  const [selectedTeam, setSelectedTeam] = useState('')
  const [teamsList, setTeamsList] = useState([])
  
  const [teams, setTeams] = useState([])
  const [batting, setBatting] = useState([])
  const [pitching, setPitching] = useState([])
  const [games, setGames] = useState([])
  const [statcast, setStatcast] = useState([])
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dataLoaded, setDataLoaded] = useState(false)

  // Load lightweight team list on mount
  useEffect(() => {
    loadTeamsList()
  }, [season])

  const loadTeamsList = async () => {
    try {
      const data = await fetchMLBTeamsList({ season })
      setTeamsList(data)
    } catch (err) {
      console.error('Error loading teams list:', err)
    }
  }

  const loadData = async () => {
    if (!dataLoaded && activeTab === 'teams') {
      // Auto-load teams tab
      await loadTeamsData()
      return
    }
    
    if (dataLoaded) return // Don't reload if already loaded
  }

  const loadTeamsData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMLBTeams({ 
        season,
        teamId: selectedTeam,
        limit: 30 
      })
      setTeams(data)
      setDataLoaded(true)
    } catch (err) {
      setError(err.message)
      console.error('Error loading teams data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadBattingData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMLBBattingStats({ 
        season,
        teamId: selectedTeam,
        limit: 20, 
        minAtBats: 50 
      })
      setBatting(data)
      setDataLoaded(true)
    } catch (err) {
      setError(err.message)
      console.error('Error loading batting data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPitchingData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMLBPitchingStats({ 
        season,
        teamId: selectedTeam,
        limit: 20, 
        minInnings: 30 
      })
      setPitching(data)
      setDataLoaded(true)
    } catch (err) {
      setError(err.message)
      console.error('Error loading pitching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGamesData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMLBRecentGames({ 
        season,
        teamId: selectedTeam,
        limit: 25 
      })
      setGames(data)
      setDataLoaded(true)
    } catch (err) {
      setError(err.message)
      console.error('Error loading games data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadStatcastData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMLBStatcastExitVelocity({ 
        season,
        limit: 50,
        minExitVelo: 100
      })
      setStatcast(data)
      setDataLoaded(true)
    } catch (err) {
      setError(err.message)
      console.error('Error loading Statcast data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setDataLoaded(false)
    setError(null)
  }

  const handleLoadStats = () => {
    switch(activeTab) {
      case 'teams':
        loadTeamsData()
        break
      case 'batting':
        loadBattingData()
        break
      case 'pitching':
        loadPitchingData()
        break
      case 'games':
        loadGamesData()
        break
      case 'statcast':
        loadStatcastData()
        break
    }
  }

  useEffect(() => {
    if (activeTab === 'teams') {
      loadData()
    }
  }, [activeTab])
          break
        case 'games':
          if (games.length === 0) {
            const data = await fetchMLBRecentGames({ limit: 25 })
            setGames(data)
          }
          break
        case 'statcast':
          if (statcast.length === 0) {
            const data = await fetchMLBStatcastExitVelocity({ limit: 50 })
            setStatcast(data)
          }
          break
      }
    } catch (err) {
      setError(err.message)
      console.error('Error loading MLB data:', err)
    } finally {
      setLoading(false)
    }
  }

  const renderTeamsView = () => (
    <div>
      <h2>Team Standings</h2>
      {teams.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={teams.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="abbreviation" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="wins" fill="#82ca9d" name="Wins" />
              <Bar dataKey="losses" fill="#ff8042" name="Losses" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '20px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Team</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Division</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>W</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>L</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Win %</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, idx) => (
                  <tr key={team.team_id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{team.team_name}</td>
                    <td style={{ padding: '10px' }}>{team.division_name}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{team.wins}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{team.losses}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{team.win_percentage?.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>No team data available</p>
      )}
    </div>
  )

  const renderBattingView = () => (
    <div>
      <h2>Top Batters (by OPS)</h2>
      {batting.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Player</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Team</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>AB</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>H</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>HR</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>RBI</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>AVG</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>OBP</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>SLG</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>OPS</th>
              </tr>
            </thead>
            <tbody>
              {batting.map((player, idx) => (
                <tr key={player.player_id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{player.player_name}</td>
                  <td style={{ padding: '10px' }}>{player.team_name}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.at_bats}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.hits}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.home_runs}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.rbi}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.batting_average?.toFixed(3)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.on_base_pct?.toFixed(3)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.slugging_pct?.toFixed(3)}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{player.ops?.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No batting data available</p>
      )}
    </div>
  )

  const renderPitchingView = () => (
    <div>
      <h2>Top Pitchers (by ERA)</h2>
      {pitching.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Player</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Team</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>G</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>QS</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>IP</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>K</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>BB</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>ER</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>ERA</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>WHIP</th>
              </tr>
            </thead>
            <tbody>
              {pitching.map((player, idx) => (
                <tr key={player.player_id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{player.player_name}</td>
                  <td style={{ padding: '10px' }}>{player.team_name}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.games}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.quality_starts}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.innings_pitched?.toFixed(1)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.strikeouts}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.walks}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.earned_runs}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{player.era?.toFixed(2)}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{player.whip?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No pitching data available</p>
      )}
    </div>
  )

  const renderGamesView = () => (
    <div>
      <h2>Recent Games</h2>
      {games.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Away</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Score</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Home</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>Score</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Winner</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game, idx) => (
                <tr key={game.game_id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>
                    {game.game_date?.value ? new Date(game.game_date.value).toLocaleDateString() : game.game_date}
                  </td>
                  <td style={{ padding: '10px' }}>{game.away_team}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{game.away_score}</td>
                  <td style={{ padding: '10px' }}>{game.home_team}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{game.home_score}</td>
                  <td style={{ padding: '10px' }}>{game.winner}</td>
                  <td style={{ padding: '10px', fontSize: '0.9em' }}>{game.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No game data available</p>
      )}
    </div>
  )

  const renderStatcastView = () => (
    <div>
      <h2>Statcast - Hardest Hit Balls</h2>
      {statcast.length > 0 ? (
        <>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="launch_angle" name="Launch Angle" unit="°" />
              <YAxis type="number" dataKey="exit_velocity" name="Exit Velocity" unit=" mph" />
              <ZAxis type="number" dataKey="hit_distance" range={[50, 400]} name="Distance" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Scatter name="Batted Balls" data={statcast.slice(0, 50)} fill="#8884d8" />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ marginTop: '20px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Player</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Game</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Exit Velo</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Launch Angle</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Distance</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {statcast.slice(0, 25).map((ball, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px' }}>{ball.player_name}</td>
                  <td style={{ padding: '10px', fontSize: '0.9em' }}>{ball.away_team_name} @ {ball.home_team_name}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{ball.exit_velocity?.toFixed(1)} mph</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{ball.launch_angle?.toFixed(1)}°</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{ball.hit_distance?.toFixed(0)} ft</td>
                    <td style={{ padding: '10px' }}>{ball.batted_ball_type}</td>
                    <td style={{ padding: '10px' }}>{ball.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>No Statcast data available</p>
      )}
    </div>
  )

  return (
    <div className="page-container">
      <h1 className="page-title">MLB Statistics</h1>
      
      {/* Filters */}
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '15px', 
        marginBottom: '20px', 
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Season:</label>
            <select 
              value={season} 
              onChange={(e) => {
                setSeason(Number(e.target.value))
                setDataLoaded(false)
              }}
              style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {[2025, 2024, 2023, 2022, 2021, 2020].map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Team:</label>
            <select 
              value={selectedTeam} 
              onChange={(e) => {
                setSelectedTeam(e.target.value)
                setDataLoaded(false)
              }}
              style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}
            >
              <option value="">All Teams</option>
              {teamsList.map(team => (
                <option key={team.team_id} value={team.team_id}>
                  {team.team_name}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={handleLoadStats}
            disabled={loading}
            style={{
              padding: '8px 20px',
              backgroundColor: loading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Loading...' : (dataLoaded ? 'Refresh Stats' : 'Load Stats')}
          </button>
          
          {dataLoaded && (
            <span style={{ color: '#28a745', fontWeight: 'bold' }}>
              ✓ Data loaded for {season} {selectedTeam && `(${teamsList.find(t => t.team_id === selectedTeam)?.team_abbr})`}
            </span>
          )}
        </div>
        
        <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
          💡 <strong>Tip:</strong> Select filters above and click "Load Stats" to query your BigQuery data. 
          This optimizes costs by preventing unnecessary full-table scans.
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div style={{ marginBottom: '20px', borderBottom: '2px solid #ddd' }}>
        <button 
          onClick={() => handleTabChange('teams')}
          style={{
            padding: '10px 20px',
            marginRight: '5px',
            backgroundColor: activeTab === 'teams' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'teams' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          Teams
        </button>
        <button 
          onClick={() => handleTabChange('batting')}
          style={{
            padding: '10px 20px',
            marginRight: '5px',
            backgroundColor: activeTab === 'batting' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'batting' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          Batting
        </button>
        <button 
          onClick={() => handleTabChange('pitching')}
          style={{
            padding: '10px 20px',
            marginRight: '5px',
            backgroundColor: activeTab === 'pitching' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'pitching' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          Pitching
        </button>
        <button 
          onClick={() => handleTabChange('games')}
          style={{
            padding: '10px 20px',
            marginRight: '5px',
            backgroundColor: activeTab === 'games' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'games' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          Recent Games
        </button>
        <button 
          onClick={() => handleTabChange('statcast')}
          style={{
            padding: '10px 20px',
            backgroundColor: activeTab === 'statcast' ? '#4CAF50' : '#f0f0f0',
            color: activeTab === 'statcast' ? 'white' : 'black',
            border: 'none',
            borderRadius: '5px 5px 0 0',
            cursor: 'pointer'
          }}
        >
          Statcast
        </button>
      </div>

      {/* Loading/Error State */}
      {loading && <div style={{ padding: '20px', textAlign: 'center' }}>Loading data...</div>}
      {error && <div style={{ padding: '20px', color: 'red', backgroundColor: '#ffebee', borderRadius: '4px' }}>Error: {error}</div>}
      
      {/* Content - Only show if data is loaded or it's the teams tab */}
      {!loading && !error && (
        <>
          {(!dataLoaded && activeTab !== 'teams') && (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              border: '2px dashed #dee2e6'
            }}>
              <h3>👆 Select your filters and click "Load Stats"</h3>
              <p style={{ color: '#666' }}>
                Choose a season and optionally a team above, then click the "Load Stats" button 
                to query your BigQuery data efficiently.
              </p>
            </div>
          )}
          
          {(dataLoaded || activeTab === 'teams') && (
            <>
              {activeTab === 'teams' && renderTeamsView()}
              {activeTab === 'batting' && renderBattingView()}
              {activeTab === 'pitching' && renderPitchingView()}
              {activeTab === 'games' && renderGamesView()}
              {activeTab === 'statcast' && renderStatcastView()}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default MLBStats
