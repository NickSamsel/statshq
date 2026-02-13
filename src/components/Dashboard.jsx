import React from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <h1 className="page-title">Sports Statistics Dashboard</h1>
      <p style={{ fontSize: '1.1rem', color: 'var(--muted)', marginBottom: '2rem' }}>
        Welcome to Stats HQ — Select a sport to begin your analysis.
      </p>
      
      <div className="stats-grid">
        <div 
          className="stat-card live-feature" 
          onClick={() => navigate('/mlb')}
          style={{ cursor: 'pointer' }}
        >
          <h3>⚾ MLB Spotlight</h3>
          <p>Analyze 3D pitch placements and iridescent Statcast metrics.</p>
          <span className="badge">LIVE NOW</span>
        </div>

        <div className="stat-card" onClick={() => navigate('/nhl')} style={{ cursor: 'pointer' }}>
          <h3>🏒 NHL</h3>
          <p>Advanced metrics and team analytics for the NHL season.</p>
        </div>
        <div className="stat-card" onClick={() => navigate('/nfl')} style={{ cursor: 'pointer' }}>
          <h3>🏈 NFL</h3>
          <p>Advanced metrics and team analytics for the NFL season.</p>
        </div>
        <div className="stat-card" onClick={() => navigate('/nba')} style={{ cursor: 'pointer' }}>
          <h3>🏀 NBA</h3>
          <p>Advanced metrics and team analytics for the NBA season.</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;