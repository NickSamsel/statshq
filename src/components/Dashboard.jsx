import React from 'react'

function Dashboard() {
  return (
    <div className="page-container">
      <h1 className="page-title">Sports Statistics Dashboard</h1>
      <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '2rem' }}>
        Welcome to Stats HQ - Your comprehensive sports data visualization platform
      </p>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>🏒 NHL</h3>
          <p>View National Hockey League statistics, player performance, and team analytics.</p>
        </div>
        
        <div className="stat-card">
          <h3>⚾ MLB</h3>
          <p>Explore Major League Baseball data, batting averages, and pitching stats.</p>
        </div>
        
        <div className="stat-card">
          <h3>🏈 NFL</h3>
          <p>Analyze National Football League metrics, quarterback ratings, and team statistics.</p>
        </div>
        
        <div className="stat-card">
          <h3>🏀 NBA</h3>
          <p>Discover National Basketball Association data, player scoring, and team performance.</p>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
