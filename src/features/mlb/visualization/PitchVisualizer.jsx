import { useState, useMemo } from 'react';

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
  const [hoveredPitch, setHoveredPitch] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  // Pitching only: toggle between heatmap and scatter
  const [pitchingTab, setPitchingTab] = useState('zones');

  const handleZoneClick = (zone) => {
    const newZone = selectedZone?.zone === zone.zone ? null : zone;
    setSelectedZone(newZone);
    if (onZoneSelect) onZoneSelect(newZone);
  };

  // Statcast zone dimensions (feet)
  const ZONE_WIDTH  = 1.7;
  const ZONE_HEIGHT = 2.0;
  const ZONE_TOP    = 3.5;
  const ZONE_BOTTOM = 1.5;

  const width     = 480;
  const height    = 520;
  const padLeft   = 56;
  const padRight  = 36;
  const padTop    = 50;
  const padBottom = 86;

  const scaleX = (width - padLeft - padRight) / (ZONE_WIDTH  * 2.4);
  const scaleY = (height - padTop - padBottom) / (ZONE_HEIGHT * 2.5);

  const toX = (px)  => width / 2 + (padLeft - padRight) / 2 + px  * scaleX;
  const toY = (pz)  => height - padBottom - (pz - 0.7) * scaleY;

  // Normalize strike_rate across this player's zones
  const { zoneMin, zoneMax, zoneRange } = useMemo(() => {
    if (!Array.isArray(zoneOutcomes) || !zoneOutcomes.length) {
      return { zoneMin: 0, zoneMax: 1, zoneRange: 1 };
    }
    const vals = zoneOutcomes.map(z => Number(z.strike_rate)).filter(Number.isFinite);
    if (!vals.length) return { zoneMin: 0, zoneMax: 1, zoneRange: 1 };
    const min = Math.min(...vals), max = Math.max(...vals);
    return { zoneMin: min, zoneMax: max, zoneRange: max - min || 1 };
  }, [zoneOutcomes]);

  // Baseball Savant–style scale: blue (low) → yellow → red (high)
  const heatColor = (t) => {
    const s = Math.max(0, Math.min(1, t));
    const stops = [
      [30, 64, 175], [37, 99, 235], [250, 204, 21], [249, 115, 22], [220, 38, 38],
    ];
    const i = Math.min(Math.floor(s * 4), 3);
    const f = s * 4 - i;
    const lerp = (a, b) => Math.round(a + (b - a) * f);
    const [r, g, b] = [0, 1, 2].map(c => lerp(stops[i][c], stops[i + 1][c]));
    return { fill: `rgb(${r},${g},${b})`, alpha: 0.52 + s * 0.36 };
  };

  const zoneColor = (zoneData) => {
    const rate = Number(zoneData?.strike_rate);
    if (!Number.isFinite(rate)) return { fill: '#1e293b', alpha: 0.45 };
    return heatColor((rate - zoneMin) / zoneRange);
  };

  const toPct = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return n >= 0 && n <= 1 ? n * 100 : n;
  };
  const fmtPct = (v, d = 0) => {
    const p = toPct(v);
    return p === null ? 'N/A' : `${p.toFixed(d)}%`;
  };

  // Outcome colors — semantic
  const pitchColor = (pitch) => {
    const d = pitch.pitch_result_description || '';
    if (viewType === 'batting') {
      if (d === 'In play, run(s)')                                   return '#22c55e'; // green  – run
      if (d === 'In play, no out')                                    return '#06b6d4'; // cyan   – hit
      if (d.includes('Foul'))                                         return '#a78bfa'; // violet – foul
      if (d.includes('Ball') || d === 'Hit By Pitch')                 return '#64748b'; // slate  – ball
      if (d.includes('Strike') || d === 'In play, out(s)')            return '#f43f5e'; // rose   – out
      return '#64748b';
    } else {
      if (d.includes('Swinging Strike'))                              return '#22c55e'; // green  – whiff
      if (d === 'Called Strike')                                       return '#06b6d4'; // cyan   – called K
      if (d.includes('Foul'))                                          return '#a78bfa'; // violet – foul
      if (d.includes('Ball'))                                          return '#f43f5e'; // rose   – ball
      if (d === 'In play, out(s)')                                     return '#3b82f6'; // blue   – out
      if (d.includes('In play'))                                       return '#f43f5e'; // rose   – hit allowed
      return '#64748b';
    }
  };

  const pitchSize = (pitch) => {
    const v = Number(pitch.release_speed) || 90;
    return 4.5 + Math.max(0, Math.min(1, (v - 70) / 35)) * 3;
  };

  const pitchZone = (pitch) => {
    const col = Math.floor((pitch.plate_x + ZONE_WIDTH  / 2) / (ZONE_WIDTH  / 3));
    const row = Math.floor((ZONE_TOP    - pitch.plate_z)     / (ZONE_HEIGHT / 3));
    return row * 3 + col + 1;
  };

  const hasRawPitches  = Array.isArray(pitches)      && pitches.length > 0;
  const hasZoneData    = Array.isArray(zoneOutcomes)  && zoneOutcomes.length > 0;

  // What to render
  const showZoneMap   = viewType === 'pitching' && pitchingTab === 'zones' && hasZoneData;
  const showScatter   = viewType === 'batting'  || (viewType === 'pitching' && pitchingTab === 'plot');

  // Empty state
  if (!hasRawPitches && !hasZoneData) {
    return (
      <div style={{
        background: '#020617', border: '1px solid #1e293b', borderRadius: '16px',
        padding: '60px 40px', textAlign: 'center', minHeight: '400px',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px', opacity: 0.35 }}>⚾</div>
          <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#64748b' }}>No pitch data available</div>
          <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '8px' }}>Select a different season or player</div>
        </div>
      </div>
    );
  }

  // Geometry for zone cells (heatmap)
  const zoneGeom = Array.from({ length: 3 }, (_, row) =>
    Array.from({ length: 3 }, (_, col) => {
      const zoneIndex = row * 3 + col + 1;
      const cellLeft  = -ZONE_WIDTH / 2 + col * (ZONE_WIDTH  / 3);
      const cellTop   =  ZONE_TOP  - row * (ZONE_HEIGHT / 3);
      const zoneData  = zoneOutcomes.find(z => Number(z.zone) === zoneIndex);
      const { fill, alpha } = zoneColor(zoneData);
      return {
        zoneIndex, zoneData, fill, alpha,
        rx: toX(cellLeft),                   ry: toY(cellTop),
        rw: (ZONE_WIDTH  / 3) * scaleX,     rh: (ZONE_HEIGHT / 3) * scaleY,
        cx: toX(cellLeft + ZONE_WIDTH  / 6), cy: toY(cellTop  - ZONE_HEIGHT / 6),
        strikePct: fmtPct(zoneData?.strike_rate),
        count: zoneData?.total_pitches ?? null,
      };
    })
  ).flat();

  const leftLabel  = handedness === 'L' ? 'OUT' : 'IN';
  const rightLabel = handedness === 'L' ? 'IN'  : 'OUT';

  // Gradient bar for zone map legend
  const barX = toX(-ZONE_WIDTH / 2), barW = ZONE_WIDTH * scaleX;
  const barY = height - 34, barH = 6;

  // Zone grid inner lines (for scatter background reference)
  const scatterGrid = [
    // horizontal
    { x1: toX(-ZONE_WIDTH/2), y1: toY(ZONE_BOTTOM + ZONE_HEIGHT/3), x2: toX(ZONE_WIDTH/2), y2: toY(ZONE_BOTTOM + ZONE_HEIGHT/3) },
    { x1: toX(-ZONE_WIDTH/2), y1: toY(ZONE_BOTTOM + ZONE_HEIGHT*2/3), x2: toX(ZONE_WIDTH/2), y2: toY(ZONE_BOTTOM + ZONE_HEIGHT*2/3) },
    // vertical
    { x1: toX(-ZONE_WIDTH/2 + ZONE_WIDTH/3), y1: toY(ZONE_TOP), x2: toX(-ZONE_WIDTH/2 + ZONE_WIDTH/3), y2: toY(ZONE_BOTTOM) },
    { x1: toX(-ZONE_WIDTH/2 + ZONE_WIDTH*2/3), y1: toY(ZONE_TOP), x2: toX(-ZONE_WIDTH/2 + ZONE_WIDTH*2/3), y2: toY(ZONE_BOTTOM) },
  ];

  return (
    <div style={{ background: '#020617', borderRadius: '16px', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '9px 16px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', background: '#0a0f1e', borderBottom: '1px solid #0f172a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Batter side pill */}
          {handedness && (
            <span style={{
              fontSize: '0.68rem', fontWeight: '700', padding: '2px 8px',
              background: handedness === 'L' ? 'rgba(251,191,36,0.08)' : 'rgba(96,165,250,0.08)',
              color: handedness === 'L' ? '#fbbf24' : '#60a5fa',
              border: `1px solid ${handedness === 'L' ? 'rgba(251,191,36,0.2)' : 'rgba(96,165,250,0.2)'}`,
              borderRadius: '4px', letterSpacing: '0.05em'
            }}>
              {handedness === 'L' ? 'LHB' : 'RHB'}
            </span>
          )}

          {/* Pitching mode toggle */}
          {viewType === 'pitching' && hasZoneData && (
            <div style={{
              display: 'flex', background: '#060c18',
              borderRadius: '5px', padding: '2px', border: '1px solid #1e293b'
            }}>
              {[['zones', 'Zone Map'], ['plot', 'Pitch Plot']].map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setPitchingTab(tab)}
                  style={{
                    padding: '3px 10px', fontSize: '0.7rem', fontWeight: '600',
                    background: pitchingTab === tab ? '#1e293b' : 'transparent',
                    color: pitchingTab === tab ? '#e2e8f0' : '#475569',
                    border: 'none', borderRadius: '3px', cursor: 'pointer',
                    transition: 'all 0.12s'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zone selection info */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {selectedZone && showZoneMap ? (
            <>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Zone {selectedZone.zone}</span>
              <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: '700' }}>
                {fmtPct(selectedZone.strike_rate)} strike rate
              </span>
              <button
                onClick={() => handleZoneClick(selectedZone)}
                style={{
                  fontSize: '0.68rem', color: '#475569', background: 'none',
                  border: '1px solid #1e293b', borderRadius: '4px',
                  padding: '1px 6px', cursor: 'pointer'
                }}
              >✕</button>
            </>
          ) : (
            <span style={{ fontSize: '0.68rem', color: '#1e293b' }}>
              {showZoneMap ? 'Click zone to filter' : `${hasRawPitches ? pitches.length : 0} pitches`}
            </span>
          )}
        </div>
      </div>

      {/* ── SVG ── */}
      <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <svg width={width} height={height}>
          <defs>
            <radialGradient id="pv-bg" cx="50%" cy="40%" r="65%">
              <stop offset="0%"   stopColor="#0f172a" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
            <linearGradient id="pv-bar" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="rgb(30,64,175)"  />
              <stop offset="25%"  stopColor="rgb(37,99,235)"  />
              <stop offset="50%"  stopColor="rgb(250,204,21)" />
              <stop offset="75%"  stopColor="rgb(249,115,22)" />
              <stop offset="100%" stopColor="rgb(220,38,38)"  />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={height} fill="url(#pv-bg)" />

          {/* Height tick labels */}
          {[ZONE_TOP, 2.5, ZONE_BOTTOM].map((z, i) => (
            <g key={`yt${i}`}>
              <line
                x1={padLeft - 5} y1={toY(z)}
                x2={toX(-ZONE_WIDTH / 2)} y2={toY(z)}
                stroke="#1e293b" strokeWidth="1"
              />
              <text x={padLeft - 9} y={toY(z)} fill="#334155" fontSize="10"
                textAnchor="end" dominantBaseline="middle">
                {z}'
              </text>
            </g>
          ))}

          {/* Inside / Outside labels */}
          <text x={toX(-ZONE_WIDTH/2)} y={padTop - 10} fill="#334155" fontSize="9"
            fontWeight="600" textAnchor="middle" letterSpacing="0.06em">{leftLabel}</text>
          <text x={toX( ZONE_WIDTH/2)} y={padTop - 10} fill="#334155" fontSize="9"
            fontWeight="600" textAnchor="middle" letterSpacing="0.06em">{rightLabel}</text>

          {/* ── Zone heatmap (pitching, Zone Map tab) ── */}
          {showZoneMap && (
            <>
              {/* Pass 1: zone cell backgrounds */}
              {zoneGeom.map(({ zoneIndex, zoneData, fill, alpha, rx, ry, rw, rh }) => {
                const isHov = hoveredZone?.zone === zoneIndex;
                const isSel = selectedZone?.zone === zoneIndex;
                return (
                  <rect
                    key={`zb-${zoneIndex}`}
                    x={rx} y={ry} width={rw} height={rh}
                    fill={fill}
                    fillOpacity={isSel ? Math.min(alpha + 0.15, 1) : isHov ? alpha + 0.1 : alpha}
                    stroke={isSel ? 'rgba(255,255,255,0.65)' : isHov ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)'}
                    strokeWidth={isSel ? 2 : 1}
                    style={{ cursor: 'pointer', transition: 'fill-opacity 0.12s' }}
                    onClick={() => handleZoneClick({ ...zoneData, zone: zoneIndex })}
                    onMouseEnter={(e) => { setHoveredZone({ ...zoneData, zone: zoneIndex }); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                    onMouseLeave={() => setHoveredZone(null)}
                  />
                );
              })}

              {/* Zone border */}
              <rect
                x={toX(-ZONE_WIDTH/2)} y={toY(ZONE_TOP)}
                width={ZONE_WIDTH * scaleX} height={ZONE_HEIGHT * scaleY}
                fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"
              />

              {/* Pass 2: zone stat labels (always on top) */}
              {zoneGeom.map(({ zoneIndex, rx, ry, rw, rh, cx, cy, strikePct, count }) => {
                const isSel = selectedZone?.zone === zoneIndex;
                return (
                  <g key={`zl-${zoneIndex}`} pointerEvents="none">
                    {strikePct !== 'N/A' && (
                      <text x={cx} y={cy - 7} fill="rgba(255,255,255,0.92)"
                        fontSize="14" fontWeight="700" textAnchor="middle">{strikePct}</text>
                    )}
                    {count != null && (
                      <text x={cx} y={cy + 10} fill="rgba(255,255,255,0.45)"
                        fontSize="10" fontWeight="500" textAnchor="middle">{count} pitches</text>
                    )}
                    {isSel && (
                      <rect x={rx} y={ry} width={rw} height={rh}
                        fill="none" stroke="rgba(255,255,255,0.55)"
                        strokeWidth="2" strokeDasharray="5 3" />
                    )}
                  </g>
                );
              })}

              {/* Gradient scale bar */}
              <rect x={barX} y={barY} width={barW} height={barH} fill="url(#pv-bar)" rx="3" />
              <text x={barX}        y={barY + barH + 12} fill="#334155" fontSize="9" textAnchor="start">Low strike %</text>
              <text x={barX + barW} y={barY + barH + 12} fill="#334155" fontSize="9" textAnchor="end">High strike %</text>
            </>
          )}

          {/* ── Scatter plot (batting always; pitching Pitch Plot tab) ── */}
          {showScatter && (
            <>
              {/* Faint zone grid for spatial reference */}
              {scatterGrid.map((l, i) => (
                <line key={`sg${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
              ))}

              {/* Strike zone outline */}
              <rect
                x={toX(-ZONE_WIDTH/2)} y={toY(ZONE_TOP)}
                width={ZONE_WIDTH * scaleX} height={ZONE_HEIGHT * scaleY}
                fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5"
              />

              {/* Chase zone */}
              <rect
                x={toX(-ZONE_WIDTH/2 - 0.12)} y={toY(ZONE_TOP + 0.08)}
                width={(ZONE_WIDTH + 0.24) * scaleX} height={(ZONE_HEIGHT + 0.16) * scaleY}
                fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 5"
              />

              {/* Pitch dots */}
              {hasRawPitches && pitches
                .filter(p => selectedZone ? pitchZone(p) === selectedZone.zone : true)
                .map((pitch, i) => {
                  const px = toX(pitch.plate_x || 0);
                  const py = toY(pitch.plate_z || 2.5);
                  const color = pitchColor(pitch);
                  const r = pitchSize(pitch);
                  const isHov = hoveredPitch === pitch;
                  return (
                    <circle key={i} cx={px} cy={py} r={isHov ? r + 2 : r}
                      fill={color} fillOpacity={isHov ? 1 : 0.82}
                      stroke="rgba(0,0,0,0.5)" strokeWidth="1"
                      style={{
                        cursor: 'pointer',
                        filter: isHov ? `drop-shadow(0 0 5px ${color})` : 'none',
                        transition: 'r 0.08s'
                      }}
                      onMouseEnter={(e) => { setHoveredPitch(pitch); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setHoveredPitch(null)}
                    />
                  );
                })}
            </>
          )}

          {/* Home plate (always) */}
          <polygon
            points={[
              [toX(-0.708), toY(0.88)], [toX(0.708), toY(0.88)],
              [toX(0.708),  toY(0.68)], [toX(0),     toY(0.48)],
              [toX(-0.708), toY(0.68)],
            ].map(([x, y]) => `${x},${y}`).join(' ')}
            fill="rgba(255,255,255,0.8)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"
          />
        </svg>

        {/* ── Pitch dot tooltip ── */}
        {hoveredPitch && (
          <div style={{
            position: 'fixed', left: tooltipPos.x + 16, top: tooltipPos.y - 96,
            background: 'rgba(2,6,23,0.97)',
            border: `1px solid ${pitchColor(hoveredPitch)}40`,
            borderRadius: '10px', padding: '11px 14px',
            color: '#fff', fontSize: '0.8rem',
            pointerEvents: 'none', zIndex: 1000,
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)', minWidth: '172px'
          }}>
            <div style={{
              color: pitchColor(hoveredPitch), fontWeight: '700',
              marginBottom: '8px', fontSize: '0.85rem',
              borderBottom: '1px solid #0f172a', paddingBottom: '6px'
            }}>
              {hoveredPitch.pitch_result_description || 'Unknown'}
            </div>
            <div style={{ display: 'grid', gap: '3px' }}>
              <TRow label="Pitch"    value={hoveredPitch.pitch_type || 'N/A'} />
              <TRow label="Velocity" value={hoveredPitch.release_speed ? `${hoveredPitch.release_speed} mph` : 'N/A'} />
              <TRow label="Spin"     value={hoveredPitch.release_spin_rate ? `${hoveredPitch.release_spin_rate} rpm` : 'N/A'} />
              <TRow label="Count"    value={`${hoveredPitch.balls ?? 0}–${hoveredPitch.strikes ?? 0}`} />
            </div>
          </div>
        )}

        {/* ── Zone tooltip (heatmap hover) ── */}
        {hoveredZone && showZoneMap && (
          <div style={{
            position: 'fixed', left: tooltipPos.x + 16, top: tooltipPos.y - 130,
            background: 'rgba(2,6,23,0.97)', border: '1px solid #1e293b',
            borderRadius: '10px', padding: '12px 15px',
            color: '#fff', fontSize: '0.8rem',
            pointerEvents: 'none', zIndex: 1000,
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)', minWidth: '188px'
          }}>
            <div style={{
              color: '#06b6d4', fontWeight: '700', marginBottom: '9px',
              fontSize: '0.85rem', borderBottom: '1px solid #0f172a', paddingBottom: '6px',
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span>Zone {hoveredZone.zone}</span>
              <span style={{ color: '#94a3b8', fontWeight: '500' }}>{hoveredZone.total_pitches} pitches</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px' }}>
              <TRow label="Strike %"        value={fmtPct(hoveredZone.strike_rate, 1)} />
              <TRow label="Called K %"      value={fmtPct(hoveredZone.called_strike_rate, 1)} />
              <TRow label="Whiff %"         value={fmtPct(hoveredZone.swinging_strike_rate, 1)} />
              <TRow label="Ball %"          value={fmtPct(hoveredZone.ball_rate, 1)} />
            </div>
            {(hoveredZone.avg_velocity || hoveredZone.primary_pitch_description) && (
              <div style={{ borderTop: '1px solid #0f172a', marginTop: '8px', paddingTop: '7px', display: 'grid', gap: '3px' }}>
                {hoveredZone.primary_pitch_description && (
                  <TRow label="Primary pitch" value={`${hoveredZone.primary_pitch_description} (${hoveredZone.primary_pitch_type})`} />
                )}
                {hoveredZone.avg_velocity && (
                  <TRow label="Avg velocity" value={`${Number(hoveredZone.avg_velocity).toFixed(1)} mph`} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{
        padding: '12px 16px 14px', borderTop: '1px solid #0a0f1e',
        background: 'rgba(10,15,30,0.6)'
      }}>
        {showScatter && (
          <>
            <div style={{ fontSize: '0.62rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px', fontWeight: '700' }}>
              Pitch Outcomes
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {viewType === 'batting' ? (
                <>
                  <Dot color="#22c55e" label="Run(s)"       />
                  <Dot color="#06b6d4" label="Hit"          />
                  <Dot color="#a78bfa" label="Foul"         />
                  <Dot color="#64748b" label="Ball"         />
                  <Dot color="#f43f5e" label="Strike / Out" />
                </>
              ) : (
                <>
                  <Dot color="#22c55e" label="Swinging K" />
                  <Dot color="#06b6d4" label="Called K"   />
                  <Dot color="#a78bfa" label="Foul"       />
                  <Dot color="#3b82f6" label="Out"        />
                  <Dot color="#f43f5e" label="Ball / Hit" />
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '7px', color: '#1e293b', fontSize: '0.67rem' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#334155' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#334155' }} />
              <span>Dot size = pitch velocity</span>
            </div>
          </>
        )}
        {showZoneMap && (
          <div style={{ fontSize: '0.72rem', color: '#334155' }}>
            Hover a zone for full breakdown · Click to filter to that zone
          </div>
        )}
      </div>
    </div>
  );
}

function Dot({ color, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '3px 8px', background: '#0a0f1e',
      borderRadius: '20px', border: '1px solid #1e293b'
    }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ color: '#475569', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function TRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
      <span style={{ color: '#475569' }}>{label}</span>
      <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{String(value)}</span>
    </div>
  );
}
