import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  ContactShadows, 
  Edges, 
  Grid,
  Html
} from '@react-three/drei';

// Internal feature imports
import { IridescentBatter } from './Batter';
import { PitchMarkers } from './PitchMarkers';
import styles from './PitchVisualizer.module.css';

/**
 * Interactive Strike Zone with zone selection
 * Draws a sharp, glowing box with transparent sides and clickable zones
 */
function StrikeZone({ 
  zoneOutcomes = [], 
  selectedZone = null, 
  hoveredZone = null,
  onZoneClick = null,
  onZoneHover = null,
  viewType = 'batting'
}) {
  const ZONE_WIDTH = 1.7;
  const ZONE_HEIGHT = 2.0;
  const ZONE_TOP = 3.5;
  const ZONE_BOTTOM = 1.5;

  const getZoneColor = (zone) => {
    if (!zone) return '#00f2ff';
    const successRate = Number(zone.success_rate || 0);
    
    if (viewType === 'batting') {
      // For batters - higher success is better
      if (successRate >= 0.6) return '#FFD700';
      if (successRate >= 0.4) return '#00f2ff';
      if (successRate >= 0.2) return '#00ff88';
      return '#ff0055';
    } else {
      // For pitchers - lower success (for batters) is better
      if (successRate <= 0.2) return '#FFD700';
      if (successRate <= 0.4) return '#00f2ff';
      if (successRate <= 0.6) return '#00ff88';
      return '#ff0055';
    }
  };

  const createZoneMesh = (zoneIndex, position, zoneData = null) => {
    const cellWidth = ZONE_WIDTH / 3;
    const cellHeight = ZONE_HEIGHT / 3;
    const isHovered = hoveredZone?.zone === zoneIndex;
    const isSelected = selectedZone?.zone === zoneIndex;
    const color = zoneData ? getZoneColor(zoneData) : '#00f2ff';

    return (
      <mesh
        key={`zone-${zoneIndex}`}
        position={position}
        onClick={() => onZoneClick && onZoneClick({ ...zoneData, zone: zoneIndex })}
        onPointerOver={() => onZoneHover && onZoneHover({ ...zoneData, zone: zoneIndex })}
        onPointerOut={() => onZoneHover && onZoneHover(null)}
      >
        <boxGeometry args={[cellWidth, cellHeight, 0.01]} />
        <meshStandardMaterial 
          color={color}
          transparent 
          opacity={isSelected ? 0.6 : (isHovered ? 0.4 : 0.1)}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : (isHovered ? 0.4 : 0.1)}
          toneMapped={false}
        />
        {isSelected && (
          <Edges>
            <meshBasicMaterial color="#FFD700" toneMapped={false} />
          </Edges>
        )}
      </mesh>
    );
  };

  const zones = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const zoneIndex = row * 3 + col + 1;
      const x = (col - 1) * (ZONE_WIDTH / 3);
      const y = ZONE_BOTTOM + (2 - row) * (ZONE_HEIGHT / 3) + (ZONE_HEIGHT / 6);
      const zoneData = zoneOutcomes.find(z => Number(z.zone) === zoneIndex);
      zones.push(createZoneMesh(zoneIndex, [x, y, 0], zoneData));
    }
  }

  return (
    <group position={[0, 2.5, 0]}>
      {/* Main strike zone box */}
      <mesh>
        <boxGeometry args={[ZONE_WIDTH, ZONE_HEIGHT, 0.5]} />
        <meshStandardMaterial 
          color="#00f2ff" 
          transparent 
          opacity={0.03} 
          metalness={1} 
          roughness={0} 
        />
        <Edges threshold={15}>
          <meshBasicMaterial color="#00f2ff" toneMapped={false} />
        </Edges>
      </mesh>
      
      {/* Interactive zone cells */}
      {zones}
    </group>
  );
}

/**
 * Player Information Overlay with Handedness and Zone-Specific Stats
 */
function PlayerInfoOverlay({ playerInfo, viewType, selectedZone, battedBallStats }) {
  const getHandednessDisplay = () => {
    if (viewType === 'pitching') {
      const hand = playerInfo.pitch_hand_code || playerInfo.pitch_hand;
      return hand ? `${hand}-handed pitcher` : 'Pitcher';
    } else {
      const hand = playerInfo.bat_side_code || playerInfo.bat_side;
      return hand ? `${hand}-handed batter` : 'Batter';
    }
  };

  const getZoneStats = () => {
    if (!selectedZone) return null;
    
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ 
          fontSize: '0.75rem', 
          color: '#FFD700', 
          fontWeight: '600', 
          marginBottom: '8px' 
        }}>
          Zone {selectedZone.zone} Stats
        </div>
        <div style={{ display: 'grid', gap: '4px', fontSize: '0.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Pitches:</span>
            <span style={{ color: '#fff' }}>{selectedZone.total_pitches || 0}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#888' }}>Success Rate:</span>
            <span style={{ color: '#00f2ff' }}>
              {((selectedZone.success_rate || 0) * 100).toFixed(1)}%
            </span>
          </div>
          {selectedZone.avg_velocity && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Avg Velo:</span>
              <span style={{ color: '#fff' }}>{Number(selectedZone.avg_velocity).toFixed(1)} mph</span>
            </div>
          )}
          {viewType === 'batting' && selectedZone.in_play && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>In Play:</span>
              <span style={{ color: '#00ff88' }}>{selectedZone.in_play}</span>
            </div>
          )}
          {viewType === 'pitching' && selectedZone.swinging_strikes && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>Whiffs:</span>
              <span style={{ color: '#FFD700' }}>{selectedZone.swinging_strikes}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Html position={[0, 4, 0]} center>
      <div style={{
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #00f2ff',
        borderRadius: '12px',
        padding: '16px',
        minWidth: '280px',
        color: '#fff',
        fontSize: '0.875rem',
        boxShadow: '0 8px 32px rgba(0, 242, 255, 0.3)',
        pointerEvents: 'none'
      }}>
        {/* Player Type and Handedness */}
        <div style={{ 
          fontSize: '1rem', 
          fontWeight: '700', 
          color: '#00f2ff', 
          marginBottom: '12px',
          textAlign: 'center'
        }}>
          {getHandednessDisplay()}
        </div>

        {/* Zone-specific stats when zone is selected */}
        {selectedZone && getZoneStats()}

        {/* Zone-specific batted ball stats for batting view */}
        {viewType === 'batting' && selectedZone && battedBallStats && battedBallStats.total_batted_balls > 0 && (
          <div>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#FFD700', 
              fontWeight: '600', 
              marginBottom: '8px' 
            }}>
              Zone {selectedZone.zone} Batted Balls
            </div>
            <div style={{ display: 'grid', gap: '4px', fontSize: '0.7rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>In Play:</span>
                <span style={{ color: '#fff' }}>{selectedZone.in_play || 0}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Success Rate:</span>
                <span style={{ color: '#FFD700' }}>
                  {((selectedZone.success_rate || 0) * 100).toFixed(1)}%
                </span>
              </div>
              {selectedZone.avg_velocity && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#888' }}>Avg Velo:</span>
                  <span style={{ color: '#fff' }}>{Number(selectedZone.avg_velocity).toFixed(1)} mph</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* General batted ball stats for batting view (when no zone selected) */}
        {viewType === 'batting' && !selectedZone && battedBallStats && battedBallStats.total_batted_balls > 0 && (
          <div>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#00f2ff', 
              fontWeight: '600', 
              marginBottom: '8px' 
            }}>
              Overall Batted Ball Stats
            </div>
            <div style={{ display: 'grid', gap: '4px', fontSize: '0.7rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Total:</span>
                <span style={{ color: '#fff' }}>{battedBallStats.total_batted_balls}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Avg Exit Velo:</span>
                <span style={{ color: '#FFD700' }}>{battedBallStats.avg_exit_velo} mph</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Barrel Rate:</span>
                <span style={{ color: '#FFD700' }}>{battedBallStats.barrel_rate}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '12px', 
          borderTop: '1px solid #333',
          fontSize: '0.7rem',
          color: '#666',
          textAlign: 'center'
        }}>
          {selectedZone ? 'Click zone again to clear' : 'Click any zone to filter'}
        </div>
      </div>
    </Html>
  );
}

export default function PitchVisualizer({ 
  pitches, 
  handedness, 
  viewType = 'batting',
  playerInfo = null,
  zoneOutcomes = [],
  battedBallStats = null,
  onZoneSelect = null
}) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);

  const handleZoneClick = (zone) => {
    const newZone = selectedZone?.zone === zone.zone ? null : zone;
    setSelectedZone(newZone);
    if (onZoneSelect) {
      onZoneSelect(newZone);
    }
  };
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
          <IridescentBatter handedness={handedness} viewType={viewType} />
          <PitchMarkers 
            pitches={pitches} 
            selectedZone={selectedZone}
            viewType={viewType}
          />
          <StrikeZone 
            zoneOutcomes={zoneOutcomes}
            selectedZone={selectedZone}
            hoveredZone={hoveredZone}
            onZoneClick={handleZoneClick}
            onZoneHover={setHoveredZone}
            viewType={viewType}
          />

          {/* Player Info Overlay */}
          {playerInfo && (
            <PlayerInfoOverlay 
              playerInfo={playerInfo}
              viewType={viewType}
              selectedZone={selectedZone}
              battedBallStats={selectedZone ? null : battedBallStats}
            />
          )}

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
