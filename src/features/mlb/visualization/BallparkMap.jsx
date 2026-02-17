import React from 'react';

export default function BallparkMap({ venue }) {
  if (!venue) return <div style={{ color: '#555' }}>Select a team to view ballpark...</div>;

  // 1. Extract dimensions (with fallbacks for safety)
  const lf = Number(venue.left_line) || 330;
  const cf = Number(venue.center) || 400;
  const rf = Number(venue.right_line) || 330;

  // 2. SVG Coordinate Mapping
  // We'll use a 400x400 viewbox where Home is at [200, 380]
  const homeX = 200;
  const homeY = 380;
  const scale = 0.8; // Scale feet to SVG units

  // 3. Calculate Foul Pole and Center Field positions
  // Left/Right lines are 45 degrees from the center axis
  const angle = Math.PI / 4; // 45 degrees
  
  const lpoleX = homeX - (Math.sin(angle) * lf * scale);
  const lpoleY = homeY - (Math.cos(angle) * lf * scale);
  
  const rpoleX = homeX + (Math.sin(angle) * rf * scale);
  const rpoleY = homeY - (Math.cos(angle) * rf * scale);
  
  const centerPadY = homeY - (cf * scale);

  // 4. Infield Dimensions (Standard 90ft)
  const baseSize = 90 * scale;

  return (
    <div style={{ background: '#0a0a0a', borderRadius: '16px', padding: '20px', border: '1px solid #222' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>{venue.venue_name}</h3>
      <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '20px' }}>
        {venue.city}, {venue.state} • {venue.capacity?.toLocaleString()} capacity
      </p>

      <svg viewBox="0 0 400 400" style={{ width: '100%', height: 'auto', maxHeight: '500px' }}>
        {/* Outfield Grass */}
        <path 
          d={`M ${homeX} ${homeY} L ${lpoleX} ${lpoleY} Q ${homeX} ${centerPadY} ${rpoleX} ${rpoleY} Z`}
          fill="#143314"
          stroke="#2d5a2d"
          strokeWidth="2"
        />

        {/* Infield Dirt (Diamond) */}
        <path 
          d={`M ${homeX} ${homeY} 
             L ${homeX - baseSize} ${homeY - baseSize} 
             L ${homeX} ${homeY - baseSize * 2} 
             L ${homeX + baseSize} ${homeY - baseSize} Z`}
          fill="#5d4037"
        />

        {/* Foul Lines */}
        <line x1={homeX} y1={homeY} x2={lpoleX} y2={lpoleY} stroke="#fff" strokeWidth="1" strokeDasharray="4" />
        <line x1={homeX} y1={homeY} x2={rpoleX} y2={rpoleY} stroke="#fff" strokeWidth="1" strokeDasharray="4" />

        {/* Distance Markers */}
        <text x={lpoleX - 10} y={lpoleY} fill="#fff" fontSize="10" textAnchor="end">{lf}'</text>
        <text x={homeX} y={centerPadY - 10} fill="#fff" fontSize="10" textAnchor="middle">{cf}'</text>
        <text x={rpoleX + 10} y={rpoleY} fill="#fff" fontSize="10" textAnchor="start">{rf}'</text>
        
        {/* Pitcher's Mound */}
        <circle cx={homeX} cy={homeY - baseSize} r="3" fill="#8d6e63" />
      </svg>
    </div>
  );
}