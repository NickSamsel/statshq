import React, { useMemo, useState } from 'react';

export default function InteractiveBallpark({ venue }) {
  const [hoverData, setHoverData] = useState(null);

  if (!venue) return null;

  const dims = {
    lf: Number(venue.left_line) || 330,
    lcf: Number(venue.left_center) || 375,
    cf: Number(venue.center) || 400,
    rcf: Number(venue.right_center) || 375,
    rf: Number(venue.right_line) || 330,
  };

  const scale = 0.9; 
  const cx = 250;    
  const cy = 450;    

  const getCoords = (dist, angleDeg) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: cx - Math.sin(angleRad) * dist * scale,
      y: cy - Math.cos(angleRad) * dist * scale
    };
  };

  const pts = useMemo(() => [
    { label: 'Left Field Line', dist: dims.lf, ...getCoords(dims.lf, 45) },
    { label: 'Left-Center Alley', dist: dims.lcf, ...getCoords(dims.lcf, 22.5) },
    { label: 'Center Field', dist: dims.cf, ...getCoords(dims.cf, 0) },
    { label: 'Right-Center Alley', dist: dims.rcf, ...getCoords(dims.rcf, -22.5) },
    { label: 'Right Field Line', dist: dims.rf, ...getCoords(dims.rf, -45) },
  ], [dims]);

  const handleMouseMove = (e, point) => {
    setHoverData({
      label: point.label,
      dist: point.dist,
      x: e.clientX,
      y: e.clientY
    });
  };

  return (
    <div style={{ position: 'relative', background: '#0a0a0a', padding: '20px', borderRadius: '20px' }}>
      
      {/* Tooltip */}
      {hoverData && (
        <div style={{
          position: 'fixed',
          left: hoverData.x + 15,
          top: hoverData.y - 40,
          background: 'rgba(0, 242, 255, 0.95)',
          color: '#000',
          padding: '5px 12px',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          {hoverData.label}: {hoverData.dist}'
        </div>
      )}

      <svg viewBox="0 0 500 500" style={{ width: '100%', height: 'auto' }}>
        {/* Grass Path */}
        <path 
          d={`M ${cx} ${cy} L ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y} Q ${pts[3].x} ${pts[3].y} ${pts[4].x} ${pts[4].y} Z`} 
          fill="#142b14" 
          stroke="#2d5a2d" 
          strokeWidth="2" 
        />

        {/* Interaction Points (Invisible hit areas) */}
        {pts.map((p, i) => (
          <circle 
            key={i}
            cx={p.x} cy={p.y} r="15"
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseMove={(e) => handleMouseMove(e, p)}
            onMouseLeave={() => setHoverData(null)}
          />
        ))}

        {/* Visual Markers */}
        {pts.map((p, i) => (
          <circle key={`v-${i}`} cx={p.x} cy={p.y} r="4" fill="#00f2ff" opacity="0.6" />
        ))}

        {/* Dirt Diamond */}
        <path d={`M ${cx} ${cy} L ${cx-70} ${cy-70} L ${cx} ${cy-140} L ${cx+70} ${cy-70} Z`} fill="#4d342c" />
        <circle cx={cx} cy={cy-70} r="50" fill="#142b14" />
        <circle cx={cx} cy={cy-45} r="4" fill="#8d6e63" />
      </svg>
    </div>
  );
}