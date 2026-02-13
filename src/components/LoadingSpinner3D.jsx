import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { MeshDistortMaterial, Float } from '@react-three/drei';

function SpinningRing() {
  const meshRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.x = t * 0.5;
    meshRef.current.rotation.y = t * 0.2;
  });

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1.5, 0.05, 16, 100]} />
      <MeshDistortMaterial 
        color="#00f2ff" 
        speed={3} 
        distort={0.4} 
        radius={1} 
        emissive="#00f2ff"
        emissiveIntensity={2}
      />
    </mesh>
  );
}

export default function LoadingSpinner3D() {
  return (
    <div style={{ width: '100%', height: '300px' }}>
      <Canvas>
        <ambientLight intensity={0.5} />
        <Float speed={4} rotationIntensity={1} floatIntensity={2}>
          <SpinningRing />
        </Float>
      </Canvas>
      <p style={{ textAlign: 'center', color: '#00f2ff', marginTop: '-100px', fontWeight: 'bold' }}>
        QUERYING BIGQUERY...
      </p>
    </div>
  );
}