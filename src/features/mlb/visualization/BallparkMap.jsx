import React, { useMemo, useState } from 'react';
import styles from './BallparkMap.module.css';

export default function InteractiveBallpark({ venue }) {
  const [hoverData, setHoverData] = useState(null);

  if (!venue) return null;

  const dims = useMemo(() => {
    const lf = Number(venue.left_line) || 330;
    const lcf = Number(venue.left_center) || 375;
    const cf = Number(venue.center) || 400;
    const rcf = Number(venue.right_center) || 375;
    const rf = Number(venue.right_line) || 330;
    return { lf, lcf, cf, rcf, rf };
  }, [venue]);

  const geometry = useMemo(() => {
    const viewW = 500;
    const viewH = 500;

    const home = { x: 250, y: 440 };
    const padding = 40;
    const foulAngle = 45;
    const foulAngleRad = (foulAngle * Math.PI) / 180;

    const maxDist = Math.max(dims.lf, dims.lcf, dims.cf, dims.rcf, dims.rf);
    const maxRadiusByX = (home.x - padding) / Math.sin(foulAngleRad);
    const maxRadiusByY = home.y - padding;
    const maxRadiusPx = Math.min(maxRadiusByX, maxRadiusByY);
    const scale = maxRadiusPx / maxDist;

    const getCoords = (dist, angleDeg) => {
      const angleRad = (angleDeg * Math.PI) / 180;
      return {
        x: home.x - Math.sin(angleRad) * dist * scale,
        y: home.y - Math.cos(angleRad) * dist * scale,
      };
    };

    const splinePathParts = (points, tension = 1) => {
      if (!points?.length) return { moveTo: '', curves: '' };
      if (points.length === 1) return { moveTo: `M ${points[0].x} ${points[0].y}`, curves: '' };

      const moveTo = `M ${points[0].x} ${points[0].y}`;
      let curves = '';

      for (let i = 0; i < points.length - 1; i += 1) {
        const p0 = points[i - 1] ?? points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] ?? points[i + 1];

        const c1 = {
          x: p1.x + ((p2.x - p0.x) / 6) * tension,
          y: p1.y + ((p2.y - p0.y) / 6) * tension,
        };
        const c2 = {
          x: p2.x - ((p3.x - p1.x) / 6) * tension,
          y: p2.y - ((p3.y - p1.y) / 6) * tension,
        };

        curves += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`;
      }

      return { moveTo, curves };
    };

    const fence = [
      { key: 'lf', label: 'Left Field Line', dist: dims.lf, angle: foulAngle, ...getCoords(dims.lf, foulAngle) },
      { key: 'lcf', label: 'Left-Center', dist: dims.lcf, angle: 22.5, ...getCoords(dims.lcf, 22.5) },
      { key: 'cf', label: 'Center Field', dist: dims.cf, angle: 0, ...getCoords(dims.cf, 0) },
      { key: 'rcf', label: 'Right-Center', dist: dims.rcf, angle: -22.5, ...getCoords(dims.rcf, -22.5) },
      { key: 'rf', label: 'Right Field Line', dist: dims.rf, angle: -foulAngle, ...getCoords(dims.rf, -foulAngle) },
    ];

    // Use a spline so the curve actually passes through all dimension points.
    const fencePoints = fence.map((p) => ({ x: p.x, y: p.y }));
    const fenceSpline = splinePathParts(fencePoints, 1);
    const fencePath = `${fenceSpline.moveTo}${fenceSpline.curves}`;
    const warningTrackPath = `M ${home.x} ${home.y} L ${fence[0].x} ${fence[0].y}${fenceSpline.curves} Z`;

    const first = getCoords(90, -45);
    const third = getCoords(90, 45);
    const second = getCoords(90 * Math.SQRT2, 0);
    const mound = getCoords(60.5, 0);

    const infieldR = 95 * scale;
    const infieldLeft = getCoords(95, 45);
    const infieldRight = getCoords(95, -45);
    const infieldArc = `M ${infieldLeft.x} ${infieldLeft.y} A ${infieldR} ${infieldR} 0 0 1 ${infieldRight.x} ${infieldRight.y}`;

    return {
      viewW,
      viewH,
      home,
      scale,
      foulAngle,
      fence,
      warningTrackPath,
      fencePath,
      bases: { first, second, third },
      mound,
      infieldArc,
      getCoords,
    };
  }, [dims]);

  const handlePointerMove = (e, point) => {
    setHoverData({
      label: point.label,
      dist: point.dist,
      x: e.clientX,
      y: e.clientY,
    });
  };

  return (
    <div className={styles.container}>
      
      {/* Tooltip */}
      {hoverData && (
        <div
          className={styles.tooltip}
          style={{
            left: hoverData.x + 14,
            top: hoverData.y - 44,
          }}
        >
          {hoverData.label}: {hoverData.dist}'
        </div>
      )}

      <svg className={styles.svg} viewBox={`0 0 ${geometry.viewW} ${geometry.viewH}`} role="img" aria-label="Interactive ballpark diagram">
        <defs>
          <radialGradient id="grass" cx="50%" cy="70%" r="70%">
            <stop offset="0%" stopColor="#143414" stopOpacity="1" />
            <stop offset="65%" stopColor="#102710" stopOpacity="1" />
            <stop offset="100%" stopColor="#0b1b0b" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="infield" cx="50%" cy="80%" r="70%">
            <stop offset="0%" stopColor="#5a3d2f" stopOpacity="1" />
            <stop offset="100%" stopColor="#3d2a22" stopOpacity="1" />
          </radialGradient>
          <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="var(--accent-cyan)" floodOpacity="0.35" />
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="var(--accent-cyan)" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Warning track / outer edge */}
        <path
          d={geometry.warningTrackPath}
          fill="none"
          stroke="#6b4a3a"
          strokeOpacity="0.55"
          strokeWidth="18"
          strokeLinejoin="round"
        />

        {/* Main grass */}
        <path d={geometry.warningTrackPath} fill="url(#grass)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Foul lines */}
        <path
          d={`M ${geometry.home.x} ${geometry.home.y} L ${geometry.fence[0].x} ${geometry.fence[0].y}`}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="2"
        />
        <path
          d={`M ${geometry.home.x} ${geometry.home.y} L ${geometry.fence[4].x} ${geometry.fence[4].y}`}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="2"
        />

        {/* Outfield fence */}
        <path
          d={geometry.fencePath}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeOpacity="0.85"
          strokeWidth="3"
          filter="url(#cyanGlow)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Distance labels */}
        {geometry.fence.map((p) => {
          const labelPos = geometry.getCoords(p.dist + 18, p.angle);
          return (
            <text
              key={`t-${p.key}`}
              x={labelPos.x}
              y={labelPos.y}
              fill="rgba(255,255,255,0.72)"
              fontSize="12"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
              style={{ userSelect: 'none' }}
            >
              {p.dist}
            </text>
          );
        })}

        {/* Infield dirt */}
        <path
          d={`M ${geometry.home.x} ${geometry.home.y} L ${geometry.bases.third.x} ${geometry.bases.third.y} L ${geometry.bases.second.x} ${geometry.bases.second.y} L ${geometry.bases.first.x} ${geometry.bases.first.y} Z`}
          fill="url(#infield)"
          opacity="0.95"
        />

        {/* Infield grass cutout */}
        <path d={geometry.infieldArc} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />

        {/* Base paths */}
        <path
          d={`M ${geometry.home.x} ${geometry.home.y} L ${geometry.bases.first.x} ${geometry.bases.first.y} L ${geometry.bases.second.x} ${geometry.bases.second.y} L ${geometry.bases.third.x} ${geometry.bases.third.y} Z`}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d={`M ${geometry.bases.third.x} ${geometry.bases.third.y} L ${geometry.bases.first.x} ${geometry.bases.first.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* Pitcher's mound */}
        <circle cx={geometry.mound.x} cy={geometry.mound.y} r={8} fill="#c2a48f" opacity="0.85" />
        <circle cx={geometry.mound.x} cy={geometry.mound.y} r={22} fill="rgba(0,0,0,0.10)" />

        {/* Bases */}
        <rect x={geometry.bases.first.x - 6} y={geometry.bases.first.y - 6} width={12} height={12} fill="#f3f3f3" transform={`rotate(45 ${geometry.bases.first.x} ${geometry.bases.first.y})`} />
        <rect x={geometry.bases.second.x - 6} y={geometry.bases.second.y - 6} width={12} height={12} fill="#f3f3f3" transform={`rotate(45 ${geometry.bases.second.x} ${geometry.bases.second.y})`} />
        <rect x={geometry.bases.third.x - 6} y={geometry.bases.third.y - 6} width={12} height={12} fill="#f3f3f3" transform={`rotate(45 ${geometry.bases.third.x} ${geometry.bases.third.y})`} />
        <path
          d={`M ${geometry.home.x} ${geometry.home.y} l -7 -4 l 0 -6 l 14 0 l 0 6 Z`}
          fill="#f3f3f3"
        />

        {/* Interaction points (invisible hit targets) */}
        {geometry.fence.map((p) => (
          <circle
            key={`hit-${p.key}`}
            cx={p.x}
            cy={p.y}
            r="16"
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onPointerMove={(e) => handlePointerMove(e, p)}
            onPointerLeave={() => setHoverData(null)}
          />
        ))}

        {/* Visible fence markers */}
        {geometry.fence.map((p) => (
          <circle
            key={`m-${p.key}`}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="var(--accent-cyan)"
            opacity="0.75"
            filter="url(#cyanGlow)"
          />
        ))}
      </svg>
    </div>
  );
}