import React, { useState } from 'react';

/**
 * PitchHeatmap Component
 * 2D strike zone visualization with hover tooltips showing Statcast data
 * Displays pitch locations from catcher's perspective
 * Includes batted ball statistics overlay
 */
export default function PitchHeatmap({
  pitches,
  zoneOutcomes = [],
  handedness = 'R',
  viewType = 'batting',
  battedBallStats = null
}) {
  const [hoveredPitch, setHoveredPitch] = useState(null);
  const [hoveredZone, setHoveredZone] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const hasRawPitches = Array.isArray(pitches) && pitches.length > 0;
  const hasZoneOutcomes = Array.isArray(zoneOutcomes) && zoneOutcomes.length > 0;

  if (!hasRawPitches && !hasZoneOutcomes) {
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
    const description = pitch.pitch_result_description || '';
    
    if (viewType === 'batting') {
      // For batters - looking for good outcomes
      if (description === 'In play, run(s)') return '#FFD700'; // Home runs, RBIs (gold)
      if (description === 'In play, no out') return '#00f2ff'; // Hits (cyan)
      if (description.includes('Foul')) return '#00ff88'; // Contact (green)
      if (description.includes('Ball') || description === 'Hit By Pitch') return '#888'; // Neutral (gray)
      if (description.includes('Strike') || description === 'In play, out(s)') return '#ff0055'; // Bad (red)
      return '#888';
    } else {
      // For pitchers - looking for outs/strikes
      if (description === 'Swinging Strike' || description.includes('Swinging Strike')) return '#FFD700'; // Whiffs (gold)
      if (description === 'Called Strike') return '#00f2ff'; // Called strikes (cyan)
      if (description.includes('Foul')) return '#00ff88'; // Foul balls (green)
      if (description.includes('Ball')) return '#ff0055'; // Bad (red)
      if (description === 'In play, out(s)') return '#00ff88'; // Good (green)
      if (description.includes('In play')) return '#888'; // Neutral (gray)
      return '#888';
    }
  };

  const handlePitchHover = (pitch, event) => {
    setHoveredPitch(pitch);
    setHoveredZone(null);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  const handleZoneHover = (zoneRow, event) => {
    setHoveredZone(zoneRow);
    setHoveredPitch(null);
    setTooltipPos({ x: event.clientX, y: event.clientY });
  };

  // BigQuery zone outcome rates are stored as 0..100 (percent). Some other sources may use 0..1.
  const toPercent = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n >= 0 && n <= 1) return n * 100;
    return n;
  };

  const formatPercent = (value, digits = 1) => {
    const p = toPercent(value);
    if (p === null) return 'N/A';
    return `${p.toFixed(digits)}%`;
  };

  const zoneSuccessRates = hasZoneOutcomes
    ? zoneOutcomes
      .map((r) => Number(r?.success_rate))
      .filter((v) => Number.isFinite(v))
    : [];

  const zoneSuccessMin = zoneSuccessRates.length ? Math.min(...zoneSuccessRates) : null;
  const zoneSuccessMax = zoneSuccessRates.length ? Math.max(...zoneSuccessRates) : null;
  const zoneSuccessRange = (zoneSuccessMin !== null && zoneSuccessMax !== null)
    ? (zoneSuccessMax - zoneSuccessMin)
    : null;

  const getZoneColor = (row) => {
    const v = Number(row?.success_rate);
    if (!Number.isFinite(v) || zoneSuccessMin === null || zoneSuccessMax === null || zoneSuccessRange === null) return '#444';

    // Normalize to 0..1 based on this player's season distribution
    const t = zoneSuccessRange === 0 ? 0.5 : (v - zoneSuccessMin) / zoneSuccessRange;

    // 4 buckets using the existing palette
    if (t >= 0.75) return '#00f2ff';
    if (t >= 0.5) return '#00ff88';
    if (t >= 0.25) return '#888';
    return '#ff0055';
  };

  const zonePitchCount = hasZoneOutcomes
    ? zoneOutcomes.reduce((sum, r) => sum + Number(r.total_pitches || 0), 0)
    : 0;

  const aggregatedZoneCounts = hasZoneOutcomes
    ? zoneOutcomes.reduce(
      (acc, r) => {
        acc.total += Number(r.total_pitches || 0);
        acc.called += Number(r.called_strikes || 0);
        acc.swinging += Number(r.swinging_strikes || 0);
        acc.balls += Number(r.balls || 0);
        acc.fouls += Number(r.fouls || 0);
        acc.inPlay += Number(r.in_play || 0);
        acc.success += Number(r.success_count || 0);
        const velo = Number(r.avg_velocity);
        const spin = Number(r.avg_spin_rate);
        const w = Number(r.total_pitches || 0);
        if (Number.isFinite(velo) && w > 0) {
          acc.veloSum += velo * w;
          acc.veloW += w;
        }
        if (Number.isFinite(spin) && w > 0) {
          acc.spinSum += spin * w;
          acc.spinW += w;
        }
        const key = r.primary_pitch_type || '';
        if (key) {
          acc.primaryPitchCounts[key] = (acc.primaryPitchCounts[key] || 0) + w;
          if (!acc.primaryPitchDesc[key] && r.primary_pitch_description) {
            acc.primaryPitchDesc[key] = r.primary_pitch_description;
          }
        }
        return acc;
      },
      {
        total: 0,
        called: 0,
        swinging: 0,
        balls: 0,
        fouls: 0,
        inPlay: 0,
        success: 0,
        veloSum: 0,
        veloW: 0,
        spinSum: 0,
        spinW: 0,
        primaryPitchCounts: {},
        primaryPitchDesc: {}
      }
    )
    : null;

  const aggregatedPitchingFromRaw = (!hasZoneOutcomes && hasRawPitches)
    ? pitches.reduce(
      (acc, p) => {
        acc.total += 1;
        const desc = String(p.pitch_result_description || p.pitch_result || '');
        if (desc.includes('Called Strike')) acc.called += 1;
        if (desc.includes('Swinging Strike')) acc.swinging += 1;
        if (desc.includes('Ball') || desc === 'Hit By Pitch') acc.balls += 1;
        if (desc.includes('Foul')) acc.fouls += 1;
        if (desc.includes('In play')) acc.inPlay += 1;
        const velo = Number(p.release_speed);
        const spin = Number(p.release_spin_rate);
        if (Number.isFinite(velo)) {
          acc.veloSum += velo;
          acc.veloN += 1;
        }
        if (Number.isFinite(spin)) {
          acc.spinSum += spin;
          acc.spinN += 1;
        }
        return acc;
      },
      { total: 0, called: 0, swinging: 0, balls: 0, fouls: 0, inPlay: 0, veloSum: 0, veloN: 0, spinSum: 0, spinN: 0 }
    )
    : null;

  const pitchOverlay = (() => {
    if (viewType !== 'pitching') return null;
    const src = aggregatedZoneCounts || aggregatedPitchingFromRaw;
    if (!src || !src.total) return null;

    const pct = (count) => (src.total ? (count / src.total) * 100 : 0);

    let primaryPitch = null;
    if (aggregatedZoneCounts) {
      const entries = Object.entries(aggregatedZoneCounts.primaryPitchCounts);
      if (entries.length) {
        entries.sort((a, b) => b[1] - a[1]);
        const type = entries[0][0];
        const desc = aggregatedZoneCounts.primaryPitchDesc[type];
        primaryPitch = desc ? `${desc} (${type})` : type;
      }
    }

    const avgVelo = aggregatedZoneCounts
      ? (aggregatedZoneCounts.veloW ? aggregatedZoneCounts.veloSum / aggregatedZoneCounts.veloW : null)
      : (aggregatedPitchingFromRaw?.veloN ? aggregatedPitchingFromRaw.veloSum / aggregatedPitchingFromRaw.veloN : null);

    const avgSpin = aggregatedZoneCounts
      ? (aggregatedZoneCounts.spinW ? aggregatedZoneCounts.spinSum / aggregatedZoneCounts.spinW : null)
      : (aggregatedPitchingFromRaw?.spinN ? aggregatedPitchingFromRaw.spinSum / aggregatedPitchingFromRaw.spinN : null);

    return {
      totalPitches: src.total,
      strikeRate: pct((src.called || 0) + (src.swinging || 0)),
      calledStrikeRate: pct(src.called || 0),
      whiffRate: pct(src.swinging || 0),
      ballRate: pct(src.balls || 0),
      inPlayRate: pct(src.inPlay || 0),
      avgVelo,
      avgSpin,
      primaryPitch
    };
  })();

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
          {hasZoneOutcomes
            ? `${zonePitchCount} pitches • Zone Heatmap + Markers`
            : `${hasRawPitches ? pitches.length : 0} pitches • Catcher's View`}
        </div>
      </div>

      {/* Batted Ball Stats Overlay */}
      {viewType === 'batting' && battedBallStats && battedBallStats.total_batted_balls > 0 && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '24px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #00f2ff',
          borderRadius: '8px',
          padding: '16px',
          minWidth: '220px',
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0, 242, 255, 0.2)'
        }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: '600', 
            color: '#00f2ff', 
            marginBottom: '12px',
            borderBottom: '1px solid #333',
            paddingBottom: '8px'
          }}>
            Batted Ball Stats
          </div>
          <div style={{ display: 'grid', gap: '8px', fontSize: '0.75rem' }}>
            <StatRow label="Total Balls" value={battedBallStats.total_batted_balls} />
            <StatRow label="Avg Exit Velo" value={`${battedBallStats.avg_exit_velo} mph`} highlight />
            <StatRow label="Max Exit Velo" value={`${battedBallStats.max_exit_velo} mph`} />
            <StatRow label="Avg Launch Angle" value={`${battedBallStats.avg_launch_angle}°`} />
            <StatRow label="Avg Distance" value={`${Math.round(battedBallStats.avg_distance)} ft`} />
            <StatRow label="Barrel Rate" value={`${battedBallStats.barrel_rate}%`} highlight />
            <StatRow label="Hard Hit Rate" value={`${battedBallStats.hard_hit_rate}%`} highlight />
            {battedBallStats.avg_sprint_speed && (
              <StatRow label="Sprint Speed" value={`${battedBallStats.avg_sprint_speed} ft/s`} />
            )}
          </div>
        </div>
      )}

      {/* Pitching Overlay (when pitcher/pitching view selected) */}
      {viewType === 'pitching' && pitchOverlay && (
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '24px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #00f2ff',
          borderRadius: '8px',
          padding: '16px',
          minWidth: '240px',
          zIndex: 10,
          boxShadow: '0 4px 16px rgba(0, 242, 255, 0.2)'
        }}>
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#00f2ff',
            marginBottom: '12px',
            borderBottom: '1px solid #333',
            paddingBottom: '8px'
          }}>
            Pitching Metrics
          </div>
          <div style={{ display: 'grid', gap: '8px', fontSize: '0.75rem' }}>
            <StatRow label="Total Pitches" value={pitchOverlay.totalPitches} />
            {pitchOverlay.primaryPitch && (
              <StatRow label="Primary Pitch" value={pitchOverlay.primaryPitch} highlight />
            )}
            <StatRow label="Strike Rate" value={formatPercent(pitchOverlay.strikeRate, 1)} highlight />
            <StatRow label="Called Strike" value={formatPercent(pitchOverlay.calledStrikeRate, 1)} />
            <StatRow label="Whiff" value={formatPercent(pitchOverlay.whiffRate, 1)} highlight />
            <StatRow label="Ball Rate" value={formatPercent(pitchOverlay.ballRate, 1)} />
            <StatRow label="In Play" value={formatPercent(pitchOverlay.inPlayRate, 1)} />
            {Number.isFinite(Number(pitchOverlay.avgVelo)) && (
              <StatRow label="Avg Velo" value={`${Number(pitchOverlay.avgVelo).toFixed(1)} mph`} />
            )}
            {Number.isFinite(Number(pitchOverlay.avgSpin)) && (
              <StatRow label="Avg Spin" value={`${Math.round(Number(pitchOverlay.avgSpin))} rpm`} />
            )}
          </div>
        </div>
      )}

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

          {/* Zone Outcomes Heatmap (aggregated) */}
          {hasZoneOutcomes && (
            <g>
              {zoneOutcomes
                .filter((z) => Number.isFinite(Number(z.avg_plate_x)) && Number.isFinite(Number(z.avg_plate_z)))
                .map((z) => {
                  const x = toCanvasX(Number(z.avg_plate_x));
                  const y = toCanvasY(Number(z.avg_plate_z));
                  const cellW = (ZONE_WIDTH * scaleX) / 3;
                  const cellH = ((ZONE_TOP - ZONE_BOTTOM) * scaleY) / 3;
                  const color = getZoneColor(z);
                  const isHovered = hoveredZone === z;

                  return (
                    <rect
                      key={`${z.zone}-${z.in_strike_zone}`}
                      x={x - cellW / 2}
                      y={y - cellH / 2}
                      width={cellW}
                      height={cellH}
                      rx="6"
                      ry="6"
                      fill={color}
                      opacity={isHovered ? 0.55 : 0.25}
                      stroke={isHovered ? '#FFD700' : '#333'}
                      strokeWidth={isHovered ? 2 : 1}
                      style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={(e) => handleZoneHover(z, e)}
                      onMouseLeave={() => setHoveredZone(null)}
                    />
                  );
                })}
            </g>
          )}

          {/* Pitch Markers */}
          {hasRawPitches && pitches.map((pitch, index) => {
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
                opacity={hoveredPitch === pitch ? 1 : (hasZoneOutcomes ? 0.35 : 0.6)}
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
        {hasZoneOutcomes && (
          <>
            <LegendItem color="#00f2ff" label="Higher Success (relative)" />
            <LegendItem color="#00ff88" label="Above Mid (relative)" />
            <LegendItem color="#888" label="Below Mid (relative)" />
            <LegendItem color="#ff0055" label="Lower Success (relative)" />
            <div style={{ flexBasis: '100%', color: '#888', marginTop: '-6px' }}>
              Note: zone colors are normalized within the selected player + season. “Success” is batter-friendly in Batting view and pitcher-friendly in Pitching view.
            </div>
          </>
        )}
        {viewType === 'batting' ? (
          <>
            <LegendItem color="#FFD700" label="Run(s) Scored" />
            <LegendItem color="#00f2ff" label="Hit (No Out)" />
            <LegendItem color="#00ff88" label="Foul" />
            <LegendItem color="#888" label="Ball" />
            <LegendItem color="#ff0055" label="Strike/Out" />
          </>
        ) : (
          <>
            <LegendItem color="#FFD700" label="Swinging Strike" />
            <LegendItem color="#00f2ff" label="Called Strike" />
            <LegendItem color="#00ff88" label="Foul/Out" />
            <LegendItem color="#888" label="In Play (Hit)" />
            <LegendItem color="#ff0055" label="Ball" />
          </>
        )}
      </div>

      {/* Tooltip */}
      {(hoveredPitch || hoveredZone) && (
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
          minWidth: '220px'
        }}>
          {hoveredZone ? (
            <>
              <div style={{ marginBottom: '8px', color: '#00f2ff', fontWeight: '600' }}>
                Zone {hoveredZone.zone} • {hoveredZone.total_pitches} pitches
              </div>
              {hoveredZone.primary_pitch_description && (
                <div style={{ fontSize: '0.75rem', color: '#aaa', marginBottom: '8px' }}>
                  Primary: {hoveredZone.primary_pitch_description} ({hoveredZone.primary_pitch_type})
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', marginBottom: '8px' }}>
                <TooltipRow label="Success" value={formatPercent(hoveredZone.success_rate, 1)} />
                <TooltipRow label="Strike" value={formatPercent(hoveredZone.strike_rate, 1)} />
                <TooltipRow label="Called" value={formatPercent(hoveredZone.called_strike_rate, 1)} />
                <TooltipRow label="Whiff" value={formatPercent(hoveredZone.swinging_strike_rate, 1)} />
                <TooltipRow label="Ball" value={formatPercent(hoveredZone.ball_rate, 1)} />
                <TooltipRow label="In Play" value={formatPercent(hoveredZone.in_play_rate, 1)} />
              </div>
              <div style={{ paddingTop: '8px', borderTop: '1px solid #333', fontSize: '0.75rem', color: '#aaa' }}>
                Avg Velo: {Number.isFinite(Number(hoveredZone.avg_velocity)) ? `${Number(hoveredZone.avg_velocity).toFixed(1)} mph` : 'N/A'}
                {` • `}
                Avg Spin: {Number.isFinite(Number(hoveredZone.avg_spin_rate)) ? `${Math.round(Number(hoveredZone.avg_spin_rate))} rpm` : 'N/A'}
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '8px', color: '#00f2ff', fontWeight: '600' }}>
                {hoveredPitch.pitch_type_description || hoveredPitch.pitch_type || 'Unknown'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem', marginBottom: '8px' }}>
                <TooltipRow label="Velocity" value={`${hoveredPitch.release_speed?.toFixed(1) || 'N/A'} mph`} />
                <TooltipRow label="Spin Rate" value={hoveredPitch.release_spin_rate ? `${hoveredPitch.release_spin_rate} rpm` : 'N/A'} />
                <TooltipRow label="Zone" value={hoveredPitch.zone || 'N/A'} />
                <TooltipRow label="In Zone" value={hoveredPitch.in_strike_zone ? 'Yes' : 'No'} />
              </div>
              <div style={{ paddingTop: '8px', borderTop: '1px solid #333' }}>
                <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>Count: {hoveredPitch.balls || 0}-{hoveredPitch.strikes || 0}</div>
                <div style={{ fontSize: '0.75rem', color: '#fff', fontWeight: '600' }}>
                  {hoveredPitch.pitch_result_description || hoveredPitch.pitch_result || 'N/A'}
                </div>
              </div>
            </>
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

function StatRow({ label, value, highlight = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#888' }}>{label}:</span>
      <span style={{ 
        color: highlight ? '#00f2ff' : '#fff', 
        fontWeight: highlight ? '700' : '600',
        fontSize: highlight ? '0.875rem' : '0.75rem'
      }}>
        {value}
      </span>
    </div>
  );
}
