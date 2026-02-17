import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import LoadingSpinner3D from '../../../components/LoadingSpinner3D';
import {
  fetchMLBTeamsList,
  fetchMLBTeamSeasons,
  fetchMLBTeamStandings,
  fetchMLBTeamStandingsHistory,
  fetchMLBTeamSeasonStats,
  fetchMLBTeamGames,
  fetchMLBTeamStatcastMetrics,
  fetchMLBVenues
} from '../../../services/bigqueryService';

// --- Helper Functions ---
function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(digits);
}

function getDateString(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.value) return v.value;
  return String(v);
}

function formatRank(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `#${n}`;
}

function joinRankLines(lines) {
  const cleaned = (lines || []).filter(Boolean);
  return cleaned.length ? cleaned.join('\n') : undefined;
}

// --- Ballpark Visualization Component ---
function InteractiveBallpark({ venue }) {
  const [hoverData, setHoverData] = useState(null);
  if (!venue) return <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>No venue data available for this selection.</div>;

  const dims = {
    lf: Number(venue.left_line) || 330,
    lcf: Number(venue.left_center) || 375,
    cf: Number(venue.center) || 400,
    rcf: Number(venue.right_center) || 375,
    rf: Number(venue.right_line) || 330,
  };

  const scale = 0.85; 
  const cx = 250;    
  const cy = 450;    

  const getCoords = (dist, angleDeg) => {
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: cx - Math.sin(angleRad) * dist * scale,
      y: cy - Math.cos(angleRad) * dist * scale
    };
  };

  const pts = [
    { label: 'Left Field Line', dist: dims.lf, ...getCoords(dims.lf, 45) },
    { label: 'Left-Center', dist: dims.lcf, ...getCoords(dims.lcf, 22.5) },
    { label: 'Center Field', dist: dims.cf, ...getCoords(dims.cf, 0) },
    { label: 'Right-Center', dist: dims.rcf, ...getCoords(dims.rcf, -22.5) },
    { label: 'Right Field Line', dist: dims.rf, ...getCoords(dims.rf, -45) },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '700px', margin: '0 auto' }}>
      {hoverData && (
        <div style={{
          position: 'fixed', left: hoverData.x + 15, top: hoverData.y - 40,
          background: '#00f2ff', color: '#000', padding: '4px 12px', borderRadius: '4px',
          fontSize: '0.8rem', fontWeight: 'bold', zIndex: 1000, pointerEvents: 'none'
        }}>
          {hoverData.label}: {hoverData.dist}'
        </div>
      )}

      <svg viewBox="0 0 500 500" style={{ width: '100%', height: 'auto' }}>
        <path 
          d={`M ${cx} ${cy} L ${pts[0].x} ${pts[0].y} Q ${pts[1].x} ${pts[1].y} ${pts[2].x} ${pts[2].y} Q ${pts[3].x} ${pts[3].y} ${pts[4].x} ${pts[4].y} Z`} 
          fill="#0f210f" stroke="#2d5a2d" strokeWidth="2" 
        />
        {/* Interaction Points */}
        {pts.map((p, i) => (
          <circle 
            key={i} cx={p.x} cy={p.y} r="18" fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseMove={(e) => setHoverData({ label: p.label, dist: p.dist, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setHoverData(null)}
          />
        ))}
        {/* Visual markers */}
        {pts.map((p, i) => <circle key={`v-${i}`} cx={p.x} cy={p.y} r="4" fill="#00f2ff" />)}
        
        {/* Infield */}
        <path d={`M ${cx} ${cy} L ${cx-70} ${cy-70} L ${cx} ${cy-140} L ${cx+70} ${cy-70} Z`} fill="#4d342c" />
        <circle cx={cx} cy={cy-70} r="52" fill="#0f210f" />
        <circle cx={cx} cy={cy-45} r="4" fill="#8d6e63" />
      </svg>
    </div>
  );
}

// --- Main Page ---
export default function TeamExplorer({ prefillTeam }) {
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' or 'ballpark'
  const [hoverTooltip, setHoverTooltip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  const [seasonStats, setSeasonStats] = useState(null);
  const [statcastMetrics, setStatcastMetrics] = useState(null);
  const [games, setGames] = useState([]);
  const [venueData, setVenueData] = useState(null);

  const [standingsSnapshot, setStandingsSnapshot] = useState(null);
  const [divisionStandings, setDivisionStandings] = useState([]);
  const [standingsHistory, setStandingsHistory] = useState([]);
  const [standingsDate, setStandingsDate] = useState(null);

  const appliedPrefillKeyRef = useRef(null);

  // Data Loading logic (Season List)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const seasonList = await fetchMLBTeamSeasons();
        if (cancelled) return;
        setSeasons(seasonList);
        setSelectedSeason(seasonList?.[0] ?? 2025);
      } catch (e) {
        setError(e?.message || 'Failed to load seasons');
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Team List logic
  useEffect(() => {
    if (!selectedSeason) return;
    let cancelled = false;
    (async () => {
      try {
        const teamRows = await fetchMLBTeamsList({ season: selectedSeason });
        if (cancelled) return;
        setTeams(teamRows);
        if (!selectedTeamId && teamRows?.length) setSelectedTeamId(teamRows[0].team_id);
      } catch (e) {
        setError(e?.message || 'Failed to load teams');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSeason]);

  // Main Team Data logic (Stats + Venue)
  useEffect(() => {
    if (!selectedSeason || !selectedTeamId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [seasonRow, statcastRow, gameRows, venueRows] = await Promise.all([
          fetchMLBTeamSeasonStats(selectedTeamId, { season: selectedSeason }),
          fetchMLBTeamStatcastMetrics(selectedTeamId, { season: selectedSeason }),
          fetchMLBTeamGames(selectedTeamId, { season: selectedSeason, limit: 162 }),
          fetchMLBVenues(selectedTeamId, { season: selectedSeason })
        ]);
        if (cancelled) return;
        setSeasonStats(seasonRow);
        setStatcastMetrics(statcastRow);
        setGames(gameRows || []);
        setVenueData(venueRows?.[0] || null);
      } catch (e) {
        setError(e?.message || 'Failed to load team data');
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSeason, selectedTeamId]);

  // Standings + History logic
  useEffect(() => {
    if (!selectedSeason || !selectedTeamId) return;
    let cancelled = false;
    (async () => {
      try {
        const [standings, history] = await Promise.all([
          fetchMLBTeamStandings({ season: selectedSeason }),
          fetchMLBTeamStandingsHistory(selectedTeamId, { season: selectedSeason })
        ]);
        if (cancelled) return;
        const rows = standings?.rows || [];
        setStandingsDate(standings?.standings_date || null);
        const teamRow = rows.find(r => String(r.team_id) === String(selectedTeamId));
        setStandingsSnapshot(teamRow || null);
        setStandingsHistory(history || []);
        if (teamRow?.division_id) {
          setDivisionStandings(rows.filter(r => r.division_id === teamRow.division_id).sort((a,b) => (a.division_rank || 99) - (b.division_rank || 99)));
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [selectedSeason, selectedTeamId]);

  const selectedTeam = useMemo(() => teams.find(t => t.team_id === selectedTeamId) || null, [teams, selectedTeamId]);

  // Chart data derivation
  const gamesChrono = useMemo(() => [...(games || [])].sort((a, b) => getDateString(a.game_date).localeCompare(getDateString(b.game_date))), [games]);
  const cumulativeRunDiffSeries = useMemo(() => {
    let cum = 0;
    return gamesChrono.map((g, idx) => ({ game: idx + 1, date: getDateString(g.game_date), cumulative_run_diff: (cum += Number(g.run_differential || 0)) }));
  }, [gamesChrono]);

  const standingsTrend = useMemo(() => (standingsHistory || []).map(r => ({ date: getDateString(r.standings_date), win_pct: Number(r.win_pct || 0) * 100, games_back: Number(r.games_back ?? 0) })), [standingsHistory]);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: 'clamp(16px, 3vw, 40px)' }}>
      {loading && <LoadingSpinner3D />}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.875rem', fontWeight: '700', margin: 0 }}>Explore Team</h2>
          
          <nav style={{ display: 'flex', background: '#111', borderRadius: '12px', padding: '4px' }}>
            {['stats', 'ballpark'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  background: activeTab === tab ? '#222' : 'transparent',
                  color: activeTab === tab ? '#00f2ff' : '#888',
                  transition: 'all 0.2s'
                }}
              >
                {tab === 'stats' ? 'Team Performance' : 'Ballpark Information'}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>Season</div>
            <select value={selectedSeason ?? ''} onChange={(e) => setSelectedSeason(Number(e.target.value))} style={selectStyle}>
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>Team</div>
            <select value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} style={{ ...selectStyle, minWidth: '320px' }}>
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
            </select>
          </div>
        </div>

        {activeTab === 'stats' ? (
          <>
            {/* Stats Dashboard Content */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard title="Record" value={seasonStats ? `${seasonStats.wins}-${seasonStats.losses}` : '—'} sub={seasonStats ? `Win% ${formatNumber(seasonStats.win_pct, 3)}` : '—'} onTooltip={setHoverTooltip} />
              <StatCard title="Runs" value={seasonStats ? `${seasonStats.total_runs_scored} RS / ${seasonStats.total_runs_allowed} RA` : '—'} sub={seasonStats ? `Diff ${seasonStats.total_run_differential}` : '—'} onTooltip={setHoverTooltip} />
              <StatCard title="Batting" value={seasonStats ? `OPS ${formatNumber(seasonStats.season_ops, 3)}` : '—'} sub={seasonStats ? `AVG ${formatNumber(seasonStats.season_batting_avg, 3)}` : '—'} onTooltip={setHoverTooltip} />
              <StatCard title="Pitching" value={seasonStats ? `ERA ${formatNumber(seasonStats.season_era, 2)}` : '—'} sub={seasonStats ? `WHIP ${formatNumber(seasonStats.season_whip, 3)}` : '—'} onTooltip={setHoverTooltip} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <Panel title="Cumulative Run Differential">
                <div style={{ height: 260 }}>
                  <ResponsiveContainer><LineChart data={cumulativeRunDiffSeries}><CartesianGrid stroke="#222" /><XAxis dataKey="game" stroke="#777" /><YAxis stroke="#777" /><Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} /><Line type="monotone" dataKey="cumulative_run_diff" stroke="#00f2ff" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer>
                </div>
              </Panel>
              <Panel title="Division Standings">
                 {/* Table logic remains the same */}
                 <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead><tr style={{ textAlign: 'left', color: '#aaa' }}><th style={thStyle}>Rk</th><th style={thStyle}>Team</th><th style={thStyle}>W</th><th style={thStyle}>L</th><th style={thStyle}>GB</th></tr></thead>
                    <tbody>{divisionStandings.map(r => (
                      <tr key={r.team_id} style={{ borderTop: '1px solid #1e1e1e', background: String(r.team_id) === String(selectedTeamId) ? 'rgba(0,242,255,0.06)' : 'transparent' }}>
                        <td style={tdStyle}>{r.division_rank}</td><td style={tdStyle}>{r.team_name}</td><td style={tdStyle}>{r.wins}</td><td style={tdStyle}>{r.losses}</td><td style={tdStyle}>{r.games_back}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px' }}>
            <Panel title="Visual Ground Map">
              <InteractiveBallpark venue={venueData} />
            </Panel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Panel title="Stadium Profile">
                <MiniStat label="Stadium Name" value={venueData?.venue_name || '—'} />
                <MiniStat label="Location" value={venueData ? `${venueData.city}, ${venueData.state}` : '—'} />
                <MiniStat label="Capacity" value={venueData?.capacity?.toLocaleString() || '—'} />
                <MiniStat label="Turf Type" value={venueData?.turf_type || '—'} />
                <MiniStat label="Roof" value={venueData?.roof_type || '—'} />
              </Panel>

              <Panel title="Field Dimensions (ft)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <MiniStat label="Left Line" value={venueData?.left_line} />
                  <MiniStat label="Right Line" value={venueData?.right_line} />
                  <MiniStat label="Left Center" value={venueData?.left_center} />
                  <MiniStat label="Right Center" value={venueData?.right_center} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <MiniStat label="Dead Center" value={venueData?.center} />
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle = { padding: '12px 14px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '10px', color: '#fff', outline: 'none' };
const thStyle = { padding: '10px 8px', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' };
const tdStyle = { padding: '10px 8px', color: '#ddd' };

function Panel({ title, children }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '16px', padding: '16px' }}>
      <div style={{ fontSize: '0.875rem', color: '#aaa', marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ title, value, sub, onTooltip }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '16px', padding: '16px' }}>
      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px' }}>{value}</div>
      <div style={{ color: '#aaa', fontSize: '0.875rem' }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '12px', borderRadius: '12px', border: '1px solid #222', background: '#070707', marginBottom: '8px' }}>
      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: '700' }}>{value}</div>
    </div>
  );
}