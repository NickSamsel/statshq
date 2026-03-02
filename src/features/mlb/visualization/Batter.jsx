import React from 'react';
import { Float, MeshTransmissionMaterial, Html } from '@react-three/drei';

export function IridescentBatter({ handedness, viewType = 'batting' }) {
  const xPos = handedness === 'L' ? 1.6 : -1.6;
  // Show batter in both views, but indicator only in batting view
  const showIndicator = viewType === 'batting';
  const batterOpacity = viewType === 'batting' ? 1.0 : 0.7; // More subtle in pitching view

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.4}>
      <group position={[xPos, 0, 0]}>
        {/* Stylized Torso */}
        <mesh position={[0, 1.3, 0]}>
          <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
          <GlassMaterial opacity={batterOpacity} />
        </mesh>
        
        {/* Stylized Head */}
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.18, 32, 32]} />
          <GlassMaterial opacity={batterOpacity} />
        </mesh>

        {/* The Bat (Simplified thin cylinder) - only show in batting view */}
        {viewType === 'batting' && (
          <mesh 
            position={[handedness === 'L' ? -0.4 : 0.4, 1.5, 0.3]} 
            rotation={[0, 0, handedness === 'L' ? 0.5 : -0.5]}
          >
            <cylinderGeometry args={[0.03, 0.05, 1.2, 16]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
          </mesh>
        )}

        {/* Handedness Indicator */}
        {showIndicator && (
          <Html position={[0, 2.8, 0]} center>
            <div style={{
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              border: handedness === 'L' ? '2px solid #FFD700' : '2px solid #00f2ff',
              borderRadius: '20px',
              padding: '6px 12px',
              color: handedness === 'L' ? '#FFD700' : '#00f2ff',
              fontSize: '0.75rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              pointerEvents: 'none',
              boxShadow: `0 4px 16px ${handedness === 'L' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 242, 255, 0.3)'}`,
              whiteSpace: 'nowrap'
            }}>
              {handedness === 'L' ? '⇐ Left' : 'Right ⇒'}
            </div>
          </Html>
        )}
      </group>
    </Float>
  );
}

// Reusable premium glass material
function GlassMaterial({ opacity = 0.9 } = {}) {
  return (
    <MeshTransmissionMaterial 
      backside
      samples={4}
      thickness={1.5}
      roughness={0.05}
      transmission={opacity}
      ior={1.2}
      chromaticAberration={0.03}
      anisotropy={0.1}
      color="#ffffff"
    />
  );
}