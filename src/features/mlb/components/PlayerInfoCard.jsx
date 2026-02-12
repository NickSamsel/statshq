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
          {player.player_name}
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
          {player.primary_position && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(0, 242, 255, 0.1)',
              border: '1px solid #00f2ff',
              borderRadius: '20px',
              fontSize: '0.875rem',
              color: '#00f2ff',
              fontWeight: '600'
            }}>
              {player.primary_position}
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
        <StatItem label="Age" value={player.age || 'N/A'} />
        <StatItem label="Height" value={player.height || 'N/A'} />
        <StatItem label="Weight" value={player.weight ? `${player.weight} lbs` : 'N/A'} />
        <StatItem label="MLB Debut" value={player.mlb_debut ? new Date(player.mlb_debut).getFullYear() : 'N/A'} />
      </div>

      {/* Handedness Information */}
      <div style={{
        display: 'flex',
        gap: '24px',
        paddingTop: '20px',
        borderTop: '1px solid #333'
      }}>
        {player.bat_side && (
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Bats
            </span>
            <div style={{ fontSize: '1.125rem', color: '#fff', marginTop: '4px', fontWeight: '600' }}>
              {player.bat_side === 'L' ? 'Left' : player.bat_side === 'R' ? 'Right' : 'Switch'}
            </div>
          </div>
        )}
        {player.pitch_hand && (
          <div>
            <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Throws
            </span>
            <div style={{ fontSize: '1.125rem', color: '#fff', marginTop: '4px', fontWeight: '600' }}>
              {player.pitch_hand === 'L' ? 'Left' : player.pitch_hand === 'R' ? 'Right' : 'Both'}
            </div>
          </div>
        )}
      </div>
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
