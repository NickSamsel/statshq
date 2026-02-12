import React, { useState, useEffect } from 'react';
import PitchVisualizer from './visualization/PitchVisualizer';
import LoadingSpinner3D from '../../components/LoadingSpinner3D';
import { usePitchData } from './hooks/usePitchData';
import { fetchMLBPlayerSeasonStats, fetchMLBBattingStats } from '../../services/bigqueryService';

function MLBStats() {
  const [activeTab, setActiveTab] = useState('batting');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerSeasonStats, setPlayerSeasonStats] = useState(null);
  const [batting, setBatting] = useState([]);
  const [loading, setLoading] = useState(false);

  const { pitches: pitchCoords } = usePitchData(selectedPlayer?.player_id, 2025);

  useEffect(() => {
    // Initial load for batting table
    const loadInitial = async () => {
      setLoading(true);
      const data = await fetchMLBBattingStats({ season: 2025, limit: 10 });
      setBatting(data);
      setLoading(false);
    };
    loadInitial();
  }, []);

  const handleDrillDown = async (player) => {
    setSelectedPlayer(player);
    setLoading(true); // Shows the 3D Spinner during transition
    const data = await fetchMLBPlayerSeasonStats({ playerId: player.player_id, season: 2025 });
    setPlayerSeasonStats(data[0]);
    setActiveTab('spotlight');
    setLoading(false);
  };

  return (
    <div className="mlb-container" style={{ color: '#fff', minHeight: '100vh', background: '#050505' }}>
      
      {/* 3D Global Loader */}
      {loading && <LoadingSpinner3D />}

      {!loading && (
        <>
          {activeTab === 'batting' && (
            <div style={{ padding: '40px' }}>
              <h2>Top Performance Metrics</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: '#666' }}>
                    <th style={{ padding: '15px' }}>PLAYER</th>
                    <th>OPS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {batting.map(p => (
                    <tr key={p.player_id} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: '15px' }}>{p.player_name}</td>
                      <td>{p.ops?.toFixed(3)}</td>
                      <td>
                        <button onClick={() => handleDrillDown(p)} style={{ 
                          background: '#00f2ff', color: '#000', border: 'none', 
                          padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' 
                        }}>
                          OPEN 3D PROFILE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'spotlight' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: '100vh' }}>
              {/* 3D Side */}
              <div style={{ position: 'relative' }}>
                <PitchVisualizer pitches={pitchCoords} handedness={selectedPlayer?.bat_side || 'L'} />
                <div style={{ position: 'absolute', bottom: '30px', left: '30px', background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: '30px', border: '1px solid #333' }}>
                  <span style={{ color: '#00f2ff' }}>●</span> HOVER PITCHES FOR DATA
                </div>
              </div>

              {/* Sidebar Side */}
              <div style={{ background: '#0a0a0a', padding: '40px', borderLeft: '1px solid #222' }}>
                <button onClick={() => setActiveTab('batting')} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px' }}>
                  ← BACK TO LIST
                </button>
                <h1 style={{ margin: 0 }}>{playerSeasonStats?.player_name}</h1>
                <p style={{ color: '#00f2ff' }}>{playerSeasonStats?.bat_side === 'L' ? 'Left' : 'Right'}-Handed Batter</p>
                
                {/* Ranking Bar */}
                <div style={{ marginTop: '40px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>EXIT VELO PERCENTILE</span>
                    <span style={{ color: '#ff0055' }}>{Math.round(playerSeasonStats?.exit_velo_percentile)}th</span>
                  </div>
                  <div style={{ height: '4px', width: '100%', background: '#222', borderRadius: '2px' }}>
                    <div style={{ width: `${playerSeasonStats?.exit_velo_percentile}%`, height: '100%', background: 'linear-gradient(90deg, #00f2ff, #ff0055)' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MLBStats;