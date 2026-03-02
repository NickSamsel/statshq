import React, { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export function PitchMarkers({ pitches, selectedZone = null, viewType = 'batting' }) {
  const [hoveredIndex, setHovered] = useState(null);

  // Filter pitches by selected zone
  const filteredPitches = selectedZone 
    ? pitches.filter(pitch => Number(pitch.zone) === selectedZone.zone)
    : pitches;

  return (
    <group>
      {filteredPitches.map((p, i) => (
        <SinglePitch 
          key={`${p.pitch_id || i}-${selectedZone?.zone || 'all'}`} 
          pitch={p} 
          isHovered={hoveredIndex === i}
          onHover={() => {
            document.body.style.cursor = 'pointer';
            setHovered(i);
          }}
          onUnhover={() => {
            document.body.style.cursor = 'auto';
            setHovered(null);
          }}
          viewType={viewType}
        />
      ))}
    </group>
  );
}

function SinglePitch({ pitch, isHovered, onHover, onUnhover, viewType = 'batting' }) {
  const isHR = pitch.outcome?.toLowerCase() === 'home_run';

  const getPitchColor = () => {
    const description = pitch.pitch_result_description || '';
    
    if (viewType === 'batting') {
      // For batters - looking for good outcomes
      if (description === 'In play, run(s)') return '#FFD700';
      if (description === 'In play, no out') return '#00f2ff';
      if (description.includes('Foul')) return '#00ff88';
      if (description.includes('Ball') || description === 'Hit By Pitch') return '#888';
      if (description.includes('Strike') || description === 'In play, out(s)') return '#ff0055';
      return '#888';
    } else {
      // For pitchers - looking for outs/strikes
      if (description === 'Swinging Strike' || description.includes('Swinging Strike')) return '#FFD700';
      if (description === 'Called Strike') return '#00f2ff';
      if (description.includes('Foul')) return '#00ff88';
      if (description.includes('Ball')) return '#ff0055';
      if (description === 'In play, out(s)') return '#00ff88';
      if (description.includes('In play')) return '#888';
      return '#888';
    }
  };

  const color = getPitchColor();

  return (
    <mesh 
      position={[pitch.plate_x, pitch.plate_z, 0]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover();
      }}
      onPointerOut={() => onUnhover()}
    >
      {/* Dynamic size based on hover and result */}
      <sphereGeometry args={[isHovered ? 0.15 : (isHR ? 0.12 : 0.06), 16, 16]} />
      
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        // High intensity on hover for that "digital glow" look
        emissiveIntensity={isHovered ? 12 : (isHR ? 5 : 2)}
        toneMapped={false}
      />

      {/* Modern Tooltip UI */}
      {isHovered && (
        <Html distanceFactor={8} position={[0, 0.25, 0]} center>
          <div style={{
            background: 'rgba(5, 5, 5, 0.95)',
            backdropFilter: 'blur(8px)', // Modern frosted look
            color: 'white',
            padding: '10px 14px',
            borderRadius: '12px',
            border: `1px solid ${color}`,
            fontSize: '11px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: `0 0 20px ${color.replace('#', 'rgba(').replace(/(.{2})/g, '$1,').slice(0, -1)}0.3)`,
            fontFamily: 'Inter, system-ui, sans-serif'
          }}>
            <div style={{ 
              color: color, 
              fontWeight: '800', 
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              {isHR ? '🚀 Home Run' : (viewType === 'pitching' ? 'Pitch Data' : 'Pitch Result')}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <span>VELO: <strong>{pitch.velocity}</strong> <small>MPH</small></span>
              <span style={{ color: '#666' }}>|</span>
              <span>HT: <strong>{pitch.plate_z?.toFixed(1)}</strong> <small>FT</small></span>
            </div>
          </div>
        </Html>
      )}
    </mesh>
  );
}