import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';

function SpinningRing() {
  const meshRef = useRef();

  useFrame(() => {
    // A clean, continuous spin on the Z-axis (like a traditional loading wheel)
    if (meshRef.current) {
      meshRef.current.rotation.z -= 0.05;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* 
        args: [radius, tube, radialSegments, tubularSegments, arc]
        We use Math.PI * 1.5 to create a 3/4 circle instead of a full closed ring,
        which gives it that classic "spinner" look when rotated.
      */}
      <torusGeometry args={[1.5, 0.08, 16, 100, Math.PI * 1.5]} />
      <meshStandardMaterial
        color="#00f2ff"
        emissive="#00f2ff"
        emissiveIntensity={2}
      />
    </mesh>
  );
}

export default function LoadingSpinner3D() {
  return (
    <div style={{ width: '100%', height: '300px', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <SpinningRing />
      </Canvas>
    </div>
  );
}