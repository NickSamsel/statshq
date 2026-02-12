import React, { useState } from 'react';

/**
 * PitchHeatmap Component
 * 2D strike zone visualization with hover tooltips showing Statcast data
 * Displays pitch locations from catcher's perspective
 */
export default function PitchHeatmap({ pitches, handedness = 'R', viewType = 'batting' }) {
  const [hoveredPitch, setHoveredPitch] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  if (!pitches || pitches.length === 0) {
    return (
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '60px 40px',
        textAlign: 'center',
        color: '#666',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚾</div>
          <div>No pitch data available for selected season</div>
        </div>
      </div>
    );
  }

  // Strike zone dimensions (in feet, from Statcast)
  const ZONE_WIDTH = 1.7; // feet
  const ZONE_HEIGHT = 2.0; // feet
  const ZONE_TOP = 3.5; // feet from ground
  const ZONE_BOTTOM = 1.5; // feet from ground

  // Canvas dimensions
  const width = 500;
  const height = 600;
  const padding = 60;

  // Scaling factors
  const scaleX = (width - 2 * padding) / (ZONE_WIDTH * 2);
  const scaleY = (height - 2 * padding) / (ZONE_HEIGHT * 2.5);

  // Convert plate coordinates to canvas coordinates
  const toCanvasX = (plateX) => {
    return width / 2 + plateX * scaleX;
  };

  const toCanvasY = (plateZ) => {
    // Flip Y axis (canvas Y increases downward)
    return height - padding - (plateZ - 0.5) * scaleY;
  };

  // Get pitch color based on outcome
  const getPitchColor = (pitch) => {
    if (viewType === 'batting') {
      // For batters
      if (pitch.events === 'home_run') return '#FFD700';
      if (pitch.events === 'double' || pitch.events === 'triple') return '#00f2ff';
      if (pitch.events === 'single') return '#00ff88';
      if (pitch.description?.includes('ball')) return '#888';
      return '#ff0055';
    } else {
      // For pitchers
      if (pitch.description?.includes('strike') || pitch.description?.includes('called_strike')) return '#00f2ff';
      if (pitch.description?.includes('swinging_strike') || pitch.description?.includes('foul')) return '#00ff88';
      if (pitch.description?.includes('ball')) return '#ff0055';
      if (pitch.events === 'strikeout') return '#FFD700';
      return '#888';
    }
  };

  const handlePitchHover = (pitch, event) => {
    setHoveredPitch(pitch);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid #333',
      borderRadius: '12px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #333',
        background: 'linear-gradient(90deg, rgba(0, 242, 255, 0.05) 0%, transparent 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: '#00f2ff', fontSize: '1.125rem', fontWeight: '600' }}>
          Pitch Location Tracker
        </h3>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>
          {pitches.length} pitches • Catcher's View
        </div>
      </div>

      {/* Canvas Container */}
      <div style={{
        padding: '40px',
        display: 'flex',
        justifyContent: 'center',
        background: '#050505'
      }}>
        <svg width={width} height={height} style={{ background: '#0a0a0a', borderRadius: '8px' }}>
          {/* Strike Zone Box */}
          <rect
            x={width / 2 - (ZONE_WIDTH / 2) * scaleX}
            y={toCanvasY(ZONE_TOP)}
            width={ZONE_WIDTH * scaleX}
            height={(ZONE_TOP - ZONE_BOTTOM) * scaleY}
            fill="none"
            stroke="#00f2ff"
            strokeWidth="2"
            opacity="0.3"
          />

          {/* Strike Zone Grid Lines */}
          {[1, 2].map((i) => (
            <line
              key={`h-${i}`}
              x1={width / 2 - (ZONE_WIDTH / 2) * scaleX}
              y1={toCanvasY(ZONE_BOTTOM + (ZONE_HEIGHT * i) / 3)}
              x2={width / 2 + (ZONE_WIDTH / 2) * scaleX}
              y2={toCanvasY(ZONE_BOTTOM + (ZONE_HEIGHT * i) / 3)}
              stroke="#00f2ff"
              strokeWidth="1"
              opacity="0.15"
            />
          ))}
          {[1, 2].map((i) => (
            <line
              key={`v-${i}`}
              x1={width / 2 - (ZONE_WIDTH / 2) * scaleX + (ZONE_WIDTH * scaleX * i) / 3}
              y1={toCanvasY(ZONE_TOP)}
              x2={width / 2 - (ZONE_WIDTH / 2) * scaleX + (ZONE_WIDTH * scaleX * i) / 3}
              y2={toCanvasY(ZONE_BOTTOM)}
              stroke="#00f2ff"
              strokeWidth="1"
              opacity="0.15"
            />
          ))}

          {/* Home Plate */}
          <polygon
            points={`${width / 2},${height - padding + 20} ${width / 2 - 25},${height - padding} ${width / 2 + 25},${height - padding}`}
            fill="#fff"
            opacity="0.2"
          />

          {/* Pitch Markers */}
          {pitches.map((pitch, index) => {
            const x = toCanvasX(pitch.plate_x || 0);
            const y = toCanvasY(pitch.plate_z || 2.5);
            const color = getPitchColor(pitch);

            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={hoveredPitch === pitch ? 8 : 6}
                fill={color}
                opacity={hoveredPitch === pitch ? 1 : 0.6}
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => handlePitchHover(pitch, e)}
                onMouseLeave={() => setHoveredPitch(null)}
              />
            );
          })}

          {/* Labels */}
          <text x={width / 2} y={padding - 20} textAnchor="middle" fill="#888" fontSize="12">
            High Zone
          </text>
          <text x={width / 2} y={height - padding + 50} textAnchor="middle" fill="#888" fontSize="12">
            Low Zone
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        padding: '20px 24px',
        borderTop: '1px solid #333',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        fontSize: '0.75rem'
      }}>
        {viewType === 'batting' ? (
          <>
            <LegendItem color="#FFD700" label="Home Run" />
            <LegendItem color="#00f2ff" label="Extra Base Hit" />
            <LegendItem color="#00ff88" label="Single" />
            <LegendItem color="#ff0055" label="Strike" />
            <LegendItem color="#888" label="Ball" />
          </>
        ) : (
          <>
            <LegendItem color="#FFD700" label="Strikeout" />
            <LegendItem color="#00f2ff" label="Called Strike" />
            <LegendItem color="#00ff88" label="Swinging Strike/Foul" />
            <LegendItem color="#ff0055" label="Ball" />
            <LegendItem color="#888" label="In Play" />
          </>
        )}
      </div>

      {/* Tooltip */}
      {hoveredPitch && (
        <div style={{
          position: 'fixed',
          left: tooltipPos.x + 20,
          top: tooltipPos.y - 100,
          background: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid #00f2ff',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#fff',
          fontSize: '0.875rem',
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0, 242, 255, 0.3)',
          minWidth: '200px'
        }}>
          <div style={{ marginBottom: '8px', color: '#00f2ff', fontWeight: '600' }}>
            {hoveredPitch.pitch_type || 'Unknown'} - {hoveredPitch.release_speed?.toFixed(1) || 'N/A'} mph
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
            <TooltipRow label="Exit Velo" value={hoveredPitch.launch_speed ? `${hoveredPitch.launch_speed.toFixed(1)} mph` : 'N/A'} />
            <TooltipRow label="Launch Angle" value={hoveredPitch.launch_angle ? `${hoveredPitch.launch_angle.toFixed(1)}°` : 'N/A'} />
            <TooltipRow label="Distance" value={hoveredPitch.hit_distance_sc ? `${hoveredPitch.hit_distance_sc} ft` : 'N/A'} />
            <TooltipRow label="Spin Rate" value={hoveredPitch.release_spin_rate ? `${hoveredPitch.release_spin_rate} rpm` : 'N/A'} />
          </div>
          {hoveredPitch.events && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333', fontSize: '0.75rem', color: '#888' }}>
              Result: <span style={{ color: '#fff' }}>{hoveredPitch.events}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper components
function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: color
      }} />
      <span style={{ color: '#888' }}>{label}</span>
    </div>
  );
}

function TooltipRow({ label, value }) {
  return (
    <div>
      <div style={{ color: '#888' }}>{label}</div>
      <div style={{ color: '#fff', fontWeight: '600' }}>{value}</div>
    </div>
  );
}
