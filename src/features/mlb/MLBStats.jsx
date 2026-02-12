import React, { useState } from 'react';
import PlayerExplorer from './components/PlayerExplorer';
import TeamExplorer from './components/TeamExplorer';

/**
 * MLBStats Component
 * Main navigation for MLB features
 * Allows user to choose between exploring players or teams
 */
function MLBStats() {
  const [activeTab, setActiveTab] = useState('player'); // 'player' or 'team'

  return (
    <div className="mlb-container" style={{ 
      minHeight: '100vh', 
      background: '#050505',
      color: '#fff'
    }}>
      {/* Top Navigation Bar */}
      <div style={{
        background: '#0a0a0a',
        borderBottom: '1px solid #222',
        padding: '0 40px',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '40px'
        }}>
          {/* Logo/Title */}
          <div style={{
            padding: '20px 0',
            fontSize: '1.5rem',
            fontWeight: '700',
            background: 'linear-gradient(90deg, #00f2ff 0%, #ff0055 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            MLB
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <NavTab
              label="Explore Player"
              icon="👤"
              active={activeTab === 'player'}
              onClick={() => setActiveTab('player')}
            />
            <NavTab
              label="Explore Team"
              icon="👥"
              active={activeTab === 'team'}
              onClick={() => setActiveTab('team')}
            />
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div>
        {activeTab === 'player' && <PlayerExplorer />}
        {activeTab === 'team' && <TeamExplorer />}
      </div>
    </div>
  );
}

// Navigation Tab Component
function NavTab({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '12px 24px',
        background: active ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
        color: active ? '#00f2ff' : '#888',
        border: 'none',
        borderBottom: active ? '2px solid #00f2ff' : '2px solid transparent',
        cursor: 'pointer',
        fontSize: '0.9375rem',
        fontWeight: active ? '600' : '400',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#fff';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#888';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '1.125rem' }}>{icon}</span>
      {label}
    </button>
  );
}

export default MLBStats;