import React from 'react';
import { Float, MeshTransmissionMaterial } from '@react-three/drei';

export function IridescentBatter({ handedness }) {
  const xPos = handedness === 'L' ? 1.6 : -1.6;

  return (
    <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.4}>
      <group position={[xPos, 0, 0]}>
        {/* Stylized Torso */}
        <mesh position={[0, 1.3, 0]}>
          <capsuleGeometry args={[0.3, 0.8, 4, 16]} />
          <GlassMaterial />
        </mesh>
        
        {/* Stylized Head */}
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.18, 32, 32]} />
          <GlassMaterial />
        </mesh>

        {/* The Bat (Simplified thin cylinder) */}
        <mesh 
          position={[handedness === 'L' ? -0.4 : 0.4, 1.5, 0.3]} 
          rotation={[0, 0, handedness === 'L' ? 0.5 : -0.5]}
        >
          <cylinderGeometry args={[0.03, 0.05, 1.2, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </Float>
  );
}

// Reusable premium glass material
function GlassMaterial() {
  return (
    <MeshTransmissionMaterial 
      backside
      samples={4}
      thickness={1.5}
      roughness={0.05}
      transmission={0.9}
      ior={1.2}
      chromaticAberration={0.03}
      anisotropy={0.1}
      color="#ffffff"
    />
  );
}