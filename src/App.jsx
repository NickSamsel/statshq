import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import './App.css'
import Dashboard from './components/Dashboard'
import NHLStats from './features/nhl/NHLStats'
import MLBStats from './features/mlb/MLBStats'
import NFLStats from './features/nfl/NFLStats'
import NBAStats from './features/nba/NBAStats'

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="logo">Stats HQ</h1>
            <ul className="nav-menu">
              <li><Link to="/">Dashboard</Link></li>
              <li><Link to="/nhl">NHL</Link></li>
              <li><Link to="/mlb">MLB</Link></li>
              <li><Link to="/nfl">NFL</Link></li>
              <li><Link to="/nba">NBA</Link></li>
            </ul>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nhl" element={<NHLStats />} />
            <Route path="/mlb" element={<MLBStats />} />
            <Route path="/nfl" element={<NFLStats />} />
            <Route path="/nba" element={<NBAStats />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
