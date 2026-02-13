import React, { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export function PitchMarkers({ pitches }) {
  const [hoveredIndex, setHovered] = useState(null);

  return (
    <group>
      {pitches.map((p, i) => (
        <SinglePitch 
          key={i} 
          pitch={p} 
          isHovered={hoveredIndex === i}
          onHover={() => {
            document.body.style.cursor = 'pointer'; // Change cursor on hover
            setHovered(i);
          }}
          onUnhover={() => {
            document.body.style.cursor = 'auto'; // Reset cursor
            setHovered(null);
          }}
        />
      ))}
    </group>
  );
}

function SinglePitch({ pitch, isHovered, onHover, onUnhover }) {
  const isHR = pitch.outcome?.toLowerCase() === 'home_run';

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
        color={isHR ? '#ff0055' : '#00ffcc'} 
        emissive={isHR ? '#ff0055' : '#00ffcc'}
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
            border: `1px solid ${isHR ? '#ff0055' : '#00f2ff'}`,
            fontSize: '11px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: `0 0 20px ${isHR ? 'rgba(255, 0, 85, 0.3)' : 'rgba(0, 242, 255, 0.2)'}`,
            fontFamily: 'Inter, system-ui, sans-serif'
          }}>
            <div style={{ 
              color: isHR ? '#ff0055' : '#00f2ff', 
              fontWeight: '800', 
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              {isHR ? '🚀 Home Run' : 'Pitch Data'}
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