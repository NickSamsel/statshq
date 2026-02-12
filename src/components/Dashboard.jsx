import React, { useState } from 'react';
import MLBStats from './features/mlb/MLBStats';
import NotCreatedYet from './components/NotCreatedYet';

function Dashboard() {
  const [activeSport, setActiveSport] = useState(null);

  const handleBackToHome = () => setActiveSport(null);

  // High-level navigation logic
  if (activeSport === 'MLB') {
    return (
      <div className="feature-wrapper">
        <nav style={{ padding: '20px', background: '#0a0a0a' }}>
          <button onClick={handleBackToHome} className="back-btn">
            ← Dashboard Home
          </button>
        </nav>
        <MLBStats />
      </div>
    );
  }

  if (activeSport) {
    return (
      <div className="feature-wrapper">
        <nav style={{ padding: '20px' }}>
          <button onClick={handleBackToHome} className="back-btn">
            ← Dashboard Home
          </button>
        </nav>
        <NotCreatedYet sportName={activeSport} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">Sports Statistics Dashboard</h1>
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem' }}>
        Welcome to Stats HQ — Select a sport to begin your analysis.
      </p>
      
      <div className="stats-grid">
        <div 
          className="stat-card live-feature" 
          onClick={() => setActiveSport('MLB')}
          style={{ border: '2px solid #00f2ff', cursor: 'pointer' }}
        >
          <h3>⚾ MLB Spotlight</h3>
          <p>Analyze 3D pitch placements and iridescent Statcast metrics.</p>
          <span className="badge">LIVE NOW</span>
        </div>

        {['NHL', 'NFL', 'NBA'].map((sport) => (
          <div key={sport} className="stat-card" onClick={() => setActiveSport(sport)} style={{ cursor: 'pointer' }}>
            <h3>{sport === 'NHL' ? '🏒' : sport === 'NFL' ? '🏈' : '🏀'} {sport}</h3>
            <p>Advanced metrics and team analytics for the {sport} season.</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;