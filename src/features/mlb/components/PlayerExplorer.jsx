import React, { useState, useEffect } from 'react';
import PlayerInfoCard from './PlayerInfoCard';
import SeasonStatsTable from './SeasonStatsTable';
import PitchHeatmap from './PitchHeatmap';
import LoadingSpinner3D from '../../../components/LoadingSpinner3D';
import { 
  fetchMLBPlayersList, 
  fetchMLBPlayerInfo, 
  fetchMLBPlayerSeasonHistory,
  fetchMLBStatcastData,
  fetchMLBBattedBallStats
} from '../../../services/bigqueryService';

/**
 * PlayerExplorer Component
 * Main interface for exploring individual player profiles
 * Includes:
 * - Searchable player dropdown
 * - Player summary card
 * - Season-by-season stats table
 * - 2D pitch heatmap with season filter
 */
export default function PlayerExplorer() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [seasonStats, setSeasonStats] = useState([]);
  const [pitchData, setPitchData] = useState([]);
  const [battedBallStats, setBattedBallStats] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [viewType, setViewType] = useState('batting'); // 'batting' or 'pitching'
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced search effect - searches as user types
  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setSearchLoading(true);
        try {
          const data = await fetchMLBPlayersList(searchTerm);
          setPlayers(data);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setSearchLoading(false);
        }
      } else if (searchTerm.length === 0) {
        setPlayers([]);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delaySearch);
  }, [searchTerm]);

  // Load player data when selected
  const handlePlayerSelect = async (player) => {
    setSelectedPlayer(player);
    setSearchTerm(player.player_name);
    setShowDropdown(false);
    setLoading(true);

    try {
      // Load player info and season history
      const [info, stats] = await Promise.all([
        fetchMLBPlayerInfo(player.player_id),
        fetchMLBPlayerSeasonHistory(player.player_id)
      ]);

      setPlayerInfo(info);
      setSeasonStats(stats);

      // Determine if player is pitcher, batter, or both
      const isPitcher = info.primary_position === 'P';
      const isBatter = !isPitcher || info.bat_side; // Assume batter if not pitcher or has batting side
      setViewType(isBatter ? 'batting' : 'pitching');

      // Load pitch data for most recent season
      if (stats.length > 0) {
        const recentSeason = stats[0].season;
        setSelectedSeason(recentSeason);
        await loadPitchData(player.player_id, recentSeason, isBatter ? 'batting' : 'pitching');
      }
    } catch (error) {
      console.error('Error loading player data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load pitch/statcast data for selected season
  const loadPitchData = async (playerId, season, type) => {
    const [pitchData, battedBallData] = await Promise.all([
      fetchMLBStatcastData({ playerId, season, viewType: type }),
      fetchMLBBattedBallStats({ playerId, season, viewType: type })
    ]);
    setPitchData(pitchData);
    setBattedBallStats(battedBallData);
  };

  // Handle season change
  const handleSeasonChange = async (season) => {
    setSelectedSeason(season);
    if (selectedPlayer) {
      setLoading(true);
      await loadPitchData(selectedPlayer.player_id, season, viewType);
      setLoading(false);
    }
  };

  // Handle view type change (for two-way players)
  const handleViewTypeChange = async (type) => {
    setViewType(type);
    if (selectedPlayer && selectedSeason) {
      setLoading(true);
      await loadPitchData(selectedPlayer.player_id, selectedSeason, type);
      setLoading(false);
    }
  };

  // Get unique seasons from stats
  const availableSeasons = seasonStats.map(s => s.season).filter((v, i, a) => a.indexOf(v) === i);

  // Check if player is two-way (both pitcher and batter stats)
  const isTwoWay = playerInfo && playerInfo.primary_position === 'P' && playerInfo.bat_side;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050505',
      color: '#fff',
      padding: '40px'
    }}>
      <style>
        {`
          @keyframes spin {
            0% { transform: translateY(-50%) rotate(0deg); }
            100% { transform: translateY(-50%) rotate(360deg); }
          }
        `}
      </style>

      {loading && <LoadingSpinner3D />}

      {/* Player Search */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.875rem', fontWeight: '700' }}>
          Explore Player Profile
        </h2>
        
        <div style={{ position: 'relative', maxWidth: '500px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search for a player (type at least 2 characters)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#00f2ff';
                setShowDropdown(true);
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#333';
                setTimeout(() => setShowDropdown(false), 200);
              }}
              style={{
                width: '100%',
                padding: '16px 20px',
                paddingRight: '50px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '1rem',
                outline: 'none',
                transition: 'border 0.2s'
              }}
            />
            {searchLoading && (
              <div style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                border: '2px solid #333',
                borderTop: '2px solid #00f2ff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
            )}
          </div>

          {/* Dropdown */}
          {showDropdown && players.length > 0 && searchTerm.length >= 2 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '12px',
              maxHeight: '400px',
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ padding: '8px 16px', fontSize: '0.75rem', color: '#666', borderBottom: '1px solid #222' }}>
                {players.length} player{players.length !== 1 ? 's' : ''} found
              </div>
              {players.map((player) => (
                <div
                  key={player.player_id}
                  onClick={() => handlePlayerSelect(player)}
                  style={{
                    padding: '12px 20px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #222',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0f0f0f'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: '600' }}>{player.player_name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '2px' }}>
                    {player.team_name || 'Free Agent'}
                    {player.latest_season && ` • Last played: ${player.latest_season}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No Results Message */}
          {showDropdown && searchTerm.length >= 2 && !searchLoading && players.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              color: '#666',
              zIndex: 100
            }}>
              No players found matching "{searchTerm}"
            </div>
          )}

          {/* Search Hint */}
          {showDropdown && searchTerm.length > 0 && searchTerm.length < 2 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              color: '#666',
              fontSize: '0.875rem',
              zIndex: 100
            }}>
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>

      {/* Player Profile */}
      {selectedPlayer && playerInfo && !loading && (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          {/* Player Info Card */}
          <div style={{ marginBottom: '40px' }}>
            <PlayerInfoCard player={playerInfo} />
          </div>

          {/* View Type Toggle (for two-way players) */}
          {isTwoWay && (
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              padding: '4px',
              background: '#0a0a0a',
              borderRadius: '12px',
              width: 'fit-content',
              border: '1px solid #333'
            }}>
              <button
                onClick={() => handleViewTypeChange('batting')}
                style={{
                  padding: '12px 24px',
                  background: viewType === 'batting' ? '#00f2ff' : 'transparent',
                  color: viewType === 'batting' ? '#000' : '#888',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Batting Profile
              </button>
              <button
                onClick={() => handleViewTypeChange('pitching')}
                style={{
                  padding: '12px 24px',
                  background: viewType === 'pitching' ? '#00f2ff' : 'transparent',
                  color: viewType === 'pitching' ? '#000' : '#888',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Pitching Profile
              </button>
            </div>
          )}

          {/* Season Stats Table */}
          <div style={{ marginBottom: '40px' }}>
            <SeasonStatsTable 
              seasons={seasonStats} 
              playerType={viewType === 'batting' ? 'batter' : 'pitcher'} 
            />
          </div>

          {/* Season Filter */}
          {availableSeasons.length > 0 && (
            <div style={{
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <label style={{ color: '#888', fontSize: '0.875rem', fontWeight: '600' }}>
                Filter by Season:
              </label>
              <select
                value={selectedSeason}
                onChange={(e) => handleSeasonChange(e.target.value)}
                style={{
                  padding: '10px 16px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {availableSeasons.map((season) => (
                  <option key={season} value={season}>
                    {season} Season
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Pitch Heatmap */}
          <PitchHeatmap 
            pitches={pitchData} 
            handedness={playerInfo.bat_side || playerInfo.pitch_hand}
            viewType={viewType}
            battedBallStats={battedBallStats}
          />
        </div>
      )}

      {/* Empty State */}
      {!selectedPlayer && !loading && (
        <div style={{
          maxWidth: '600px',
          margin: '80px auto',
          textAlign: 'center',
          color: '#666'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⚾</div>
          <h3 style={{ marginBottom: '8px', color: '#888' }}>Search for a Player</h3>
          <p>Start typing a player's name in the search box above to explore their profile, stats, and pitch data</p>
          <p style={{ fontSize: '0.875rem', marginTop: '16px', color: '#555' }}>
            Try searching for "Ohtani", "Judge", "Trout", or any MLB player
          </p>
        </div>
      )}
    </div>
  );
}
