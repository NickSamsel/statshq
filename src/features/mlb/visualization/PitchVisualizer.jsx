import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  ContactShadows, 
  Edges, 
  Grid 
} from '@react-three/drei';

// Internal feature imports
import { IridescentBatter } from './Batter';
import { PitchMarkers } from './PitchMarkers';
import styles from './PitchVisualizer.module.css';

/**
 * Modern Strike Zone Cage
 * Draws a sharp, glowing box with transparent sides
 */
function StrikeZone() {
  return (
    <group position={[0, 2.5, 0]}>
      <mesh>
        {/* Dimensions: 1.7ft wide, 2ft tall, 0.5ft deep */}
        <boxGeometry args={[1.7, 2, 0.5]} />
        <meshStandardMaterial 
          color="#00f2ff" 
          transparent 
          opacity={0.03} 
          metalness={1} 
          roughness={0} 
        />
        {/* Glow-edge helper for visibility */}
        <Edges threshold={15}>
          <meshBasicMaterial color="#00f2ff" toneMapped={false} />
        </Edges>
      </mesh>
    </group>
  );
}

export default function PitchVisualizer({ pitches, handedness }) {
  return (
    <div className={styles.hologramContainer}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 2, 7]} />
          <OrbitControls 
            makeDefault 
            target={[0, 2, 0]} 
            maxDistance={12} 
            minDistance={4}
            maxPolarAngle={Math.PI / 1.8} // Prevents camera from going under floor
          />
          
          {/* Studio Lighting */}
          <ambientLight intensity={0.4} />
          <spotLight 
            position={[10, 10, 10]} 
            angle={0.15} 
            penumbra={1} 
            intensity={2} 
            castShadow 
          />
          <pointLight position={[-10, -10, -10]} color="#00f2ff" intensity={1} />

          {/* The Data Actors */}
          <IridescentBatter handedness={handedness} />
          <PitchMarkers pitches={pitches} />
          <StrikeZone />

          {/* Modern Grounding Elements */}
          <Grid 
            infiniteGrid 
            fadeDistance={20} 
            fadeStrength={5} 
            cellSize={0.5} 
            sectionSize={2.5} 
            sectionColor="#222" 
            cellColor="#111" 
          />
          
          <ContactShadows 
            position={[0, 0, 0]} 
            opacity={0.3} 
            scale={10} 
            blur={2.5} 
            far={4} 
          />
        </Suspense>
      </Canvas>
    </div>
  );
}