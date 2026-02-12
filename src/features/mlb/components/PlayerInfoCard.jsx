import React from 'react';

/**
 * PlayerInfoCard Component
 * Displays player summary information including:
 * - Name, Number, Position
 * - Physical attributes (Age, Height, Weight)
 * - Career information (Debut, Years in MLB)
 * - Handedness (Bats/Throws)
 */
export default function PlayerInfoCard({ player }) {
  if (!player) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      borderRadius: '16px',
      padding: '32px',
      border: '1px solid #333',
      boxShadow: '0 8px 32px rgba(0, 242, 255, 0.1)'
    }}>
      {/* Player Name and Number */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '2.5rem',
          margin: '0 0 8px 0',
          color: '#fff',
          fontWeight: '700'
        }}>
          {player.full_name}
        </h1>
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {player.primary_number && (
            <span style={{
              fontSize: '1.5rem',
              color: '#00f2ff',
              fontWeight: '700'
            }}>
              #{player.primary_number}
            </span>
          )}
          {player.primary_position_abbr && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(0, 242, 255, 0.1)',
              border: '1px solid #00f2ff',
              borderRadius: '20px',
              fontSize: '0.875rem',
              color: '#00f2ff',
              fontWeight: '600'
            }}>
              {player.primary_position_abbr}
            </span>
          )}
          {player.is_two_way_player && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid #FFD700',
              borderRadius: '20px',
              fontSize: '0.875rem',
              color: '#FFD700',
              fontWeight: '600'
            }}>
              Two-Way Player
            </span>
          )}
        </div>
      </div>

      {/* Player Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        <StatItem label="Height" value={player.height || 'N/A'} />
        <StatItem label="Weight" value={player.weight ? `${player.weight} lbs` : 'N/A'} />
        <StatItem label="MLB Debut" value={player.mlb_debut_date ? new Date(player.mlb_debut_date.value || player.mlb_debut_date).getFullYear() : 'N/A'} />
        <StatItem label="Last Game" value={player.last_game_date ? new Date(player.last_game_date.value || player.last_game_date).getFullYear() : 'N/A'} />
      </div>

      {/* Handedness Information */}
      <div style={{
        display: 'flex',
        gap: '24px',
        paddingTop: '20px',
        borderTop: '1px solid #333',
        marginBottom: player.is_batter || player.is_pitcher ? '20px' : '0'
      }}>
        {player.bat_side_code && (
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Bats
            </span>
            <div style={{ fontSize: '1.125rem', color: '#fff', marginTop: '4px', fontWeight: '600' }}>
              {player.bat_side_code === 'L' ? 'Left' : player.bat_side_code === 'R' ? 'Right' : player.bat_side_code === 'S' ? 'Switch' : player.bat_side_code}
            </div>
          </div>
        )}
        {player.pitch_hand_code && (
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Throws
            </span>
            <div style={{ fontSize: '1.125rem', color: '#fff', marginTop: '4px', fontWeight: '600' }}>
              {player.pitch_hand_code === 'L' ? 'Left' : player.pitch_hand_code === 'R' ? 'Right' : player.pitch_hand_code === 'B' ? 'Both' : player.pitch_hand_code}
            </div>
          </div>
        )}
      </div>

      {/* Career Batting Statistics */}
      {player.is_batter && player.career_batting_avg != null && (
        <div style={{
          paddingTop: '20px',
          borderTop: '1px solid #333'
        }}>
          <h3 style={{ 
            fontSize: '0.875rem', 
            color: '#00f2ff', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            marginBottom: '16px',
            fontWeight: '700'
          }}>
            ⚾ Career Batting
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '16px'
          }}>
            <StatItem label="AVG" value={player.career_batting_avg?.toFixed(3) || '.000'} />
            <StatItem label="HR" value={player.career_home_runs || 0} />
            <StatItem label="RBI" value={player.career_rbi || 0} />
            <StatItem label="OPS" value={player.career_ops?.toFixed(3) || '.000'} />
            {player.avg_exit_velocity && (
              <StatItem label="Exit Velo" value={`${player.avg_exit_velocity.toFixed(1)} mph`} />
            )}
            {player.barrel_rate && (
              <StatItem label="Barrel %" value={`${(player.barrel_rate * 100).toFixed(1)}%`} />
            )}
          </div>
        </div>
      )}

      {/* Career Pitching Statistics */}
      {player.is_pitcher && player.career_era != null && (
        <div style={{
          paddingTop: '20px',
          borderTop: '1px solid #333',
          marginTop: player.is_batter ? '20px' : '0'
        }}>
          <h3 style={{ 
            fontSize: '0.875rem', 
            color: '#00f2ff', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            marginBottom: '16px',
            fontWeight: '700'
          }}>
            🔥 Career Pitching
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '16px'
          }}>
            <StatItem label="ERA" value={player.career_era?.toFixed(2) || '0.00'} />
            <StatItem label="WHIP" value={player.career_whip?.toFixed(2) || '0.00'} />
            <StatItem label="K/9" value={player.career_k_per_9?.toFixed(1) || '0.0'} />
            <StatItem label="IP" value={player.career_innings_pitched?.toFixed(1) || '0.0'} />
            {player.avg_release_speed && (
              <StatItem label="Avg Velo" value={`${player.avg_release_speed.toFixed(1)} mph`} />
            )}
            {player.avg_spin_rate && (
              <StatItem label="Avg Spin" value={`${Math.round(player.avg_spin_rate)} rpm`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for stat items
function StatItem({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: '0.75rem',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: '4px'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.25rem',
        color: '#fff',
        fontWeight: '600'
      }}>
        {value}
      </div>
    </div>
  );
}
