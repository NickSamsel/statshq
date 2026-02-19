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
import InteractiveBallpark from '../visualization/BallparkMap';
import {
  fetchMLBTeamsList,
  fetchMLBTeamSeasons,
  fetchMLBTeamStandings,
  fetchMLBTeamStandingsHistory,
  fetchMLBTeamSeasonStats,
  fetchMLBTeamGames,
  fetchMLBTeamStatcastMetrics,
  fetchMLBVenues,
  fetchMLBPlayersTeamRoster
} from '../../../services/bigqueryService';

// --- Formatting Helpers ---
const formatPct = (v) => (v == null ? '—' : `${(Number(v) * 100).toFixed(1)}%`);
const formatNumber = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const getDateString = (v) => (v && typeof v === 'object' ? v.value : String(v || ''));
const formatRank = (v) => (Number(v) > 0 ? `#${v}` : null);

// --- Main Component ---
export default function TeamExplorer({ prefillTeam }) {
  const [activeTab, setActiveTab] = useState('performance');
  const [scheduleView, setScheduleView] = useState('previous');
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
  const [roster, setRoster] = useState([]);

  const [standingsSnapshot, setStandingsSnapshot] = useState(null);
  const [divisionStandings, setDivisionStandings] = useState([]);
  const [standingsHistory, setStandingsHistory] = useState([]);

  // Init Seasons
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchMLBTeamSeasons();
        setSeasons(list);
        setSelectedSeason(list?.[0] ?? 2025);
      } catch (e) { setError('Failed to load seasons'); }
    })();
  }, []);

  // Init Teams
  useEffect(() => {
    if (!selectedSeason) return;
    (async () => {
      try {
        const rows = await fetchMLBTeamsList({ season: selectedSeason });
        setTeams(rows);
        if (!selectedTeamId && rows.length) setSelectedTeamId(rows[0].team_id);
      } catch (e) { setError('Failed to load teams'); }
    })();
  }, [selectedSeason]);

  // Load Main Data
  useEffect(() => {
    if (!selectedSeason || !selectedTeamId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [stats, sc, gameRows, venueRows, rosterRows] = await Promise.all([
          fetchMLBTeamSeasonStats(selectedTeamId, { season: selectedSeason }),
          fetchMLBTeamStatcastMetrics(selectedTeamId, { season: selectedSeason }),
          fetchMLBTeamGames(selectedTeamId, { season: selectedSeason, limit: 162 }),
          fetchMLBVenues(selectedTeamId, { season: selectedSeason }),
          fetchMLBPlayersTeamRoster(selectedTeamId, { season: selectedSeason })
        ]);
        if (cancelled) return;
        setSeasonStats(stats);
        setStatcastMetrics(sc);
        setGames(gameRows || []);
        setVenueData(venueRows?.[0] || null);
        setRoster(rosterRows || []);
      } catch (e) { setError('Data fetch error'); }
      finally { setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selectedSeason, selectedTeamId]);

  // Standings Logic
  useEffect(() => {
    if (!selectedSeason || !selectedTeamId) return;
    (async () => {
      try {
        const [std, hist] = await Promise.all([
          fetchMLBTeamStandings({ season: selectedSeason }),
          fetchMLBTeamStandingsHistory(selectedTeamId, { season: selectedSeason })
        ]);
        const rows = std?.rows || [];
        const team = rows.find(r => String(r.team_id) === String(selectedTeamId));
        setStandingsSnapshot(team || null);
        setStandingsHistory(hist || []);
        if (team?.division_id) {
          setDivisionStandings(rows.filter(r => r.division_id === team.division_id).sort((a,b) => (a.division_rank || 99) - (b.division_rank || 99)));
        }
      } catch (e) {}
    })();
  }, [selectedSeason, selectedTeamId]);

  const gamesChrono = useMemo(() => [...(games || [])].sort((a, b) => getDateString(a.game_date).localeCompare(getDateString(b.game_date))), [games]);
  const cumulativeRunDiff = useMemo(() => {
    let cum = 0;
    return gamesChrono.map((g, i) => ({ game: i + 1, diff: (cum += Number(g.run_differential || 0)) }));
  }, [gamesChrono]);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', padding: '40px' }}>
      {loading && <LoadingSpinner3D />}
      
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Team Explorer</h2>
            <nav style={{ display: 'flex', background: '#111', padding: '4px', borderRadius: '12px' }}>
              {['performance', 'schedule', 'roster', 'ballpark'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: activeTab === t ? '#222' : 'transparent',
                  color: activeTab === t ? '#00f2ff' : '#666', fontWeight: '600'
                }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </nav>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select value={selectedSeason ?? ''} onChange={e => setSelectedSeason(Number(e.target.value))} style={selectStyle}>
              {seasons.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} style={{ ...selectStyle, minWidth: '250px' }}>
              {teams.map(t => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}
            </select>
          </div>
        </header>

        {activeTab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <StatCard title="Record" value={seasonStats ? `${seasonStats.wins}-${seasonStats.losses}` : '—'} sub={`Win% ${formatNumber(seasonStats?.win_pct, 3)}`} />
              <StatCard title="Run Diff" value={seasonStats?.total_run_differential || '—'} sub={`${seasonStats?.total_runs_scored} RS / ${seasonStats?.total_runs_allowed} RA`} />
              <StatCard title="Team OPS" value={formatNumber(seasonStats?.season_ops, 3)} sub={`Rank: ${formatRank(seasonStats?.ops_rank)}`} />
              <StatCard title="Team ERA" value={formatNumber(seasonStats?.season_era, 2)} sub={`Rank: ${formatRank(seasonStats?.era_rank)}`} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Panel title="Run Differential Trend"><div style={{ height: 300 }}>
                <ResponsiveContainer><LineChart data={cumulativeRunDiff}><CartesianGrid stroke="#222" strokeDasharray="3 3"/><XAxis dataKey="game" stroke="#555"/><YAxis stroke="#555"/><Tooltip contentStyle={{background:'#111', border:'#333'}}/><Line type="monotone" dataKey="diff" stroke="#00f2ff" dot={false}/></LineChart></ResponsiveContainer>
              </div></Panel>
              <Panel title="Division Standings">
                <table style={tableStyle}>
                  <thead><tr style={{color:'#666'}}><th style={thS}>Pos</th><th style={thS}>Team</th><th style={thS}>W-L</th><th style={thS}>GB</th></tr></thead>
                  <tbody>{divisionStandings.map(r => (
                    <tr key={r.team_id} style={{borderTop:'1px solid #111', background: String(r.team_id)===selectedTeamId ? '#00f2ff11':''}}>
                      <td style={tdS}>{r.division_rank}</td><td style={tdS}>{r.team_name}</td><td style={tdS}>{r.wins}-{r.losses}</td><td style={tdS}>{r.games_back}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </Panel>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <Panel title={<div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
            <span>Game Schedule</span>
            <div style={{display:'flex', gap:'8px'}}>
              <button onClick={()=>setScheduleView('previous')} style={tabBtn(scheduleView==='previous')}>Results</button>
              <button onClick={()=>setScheduleView('future')} style={tabBtn(scheduleView==='future')}>Upcoming</button>
            </div>
          </div>}>
            <table style={tableStyle}>
              <thead>
                <tr style={{color:'#666'}}>
                  <th style={thS}>Date</th>
                  <th style={thS}>Opponent</th>
                  <th style={thS}>Score/Time</th>
                  <th style={thS}>Result</th>
                </tr>
              </thead>
              <tbody>
                {games
                  .filter(g => {
                    // A game is "previous" if it has runs_scored data
                    const hasPlayed = g.runs_scored !== null && g.runs_scored !== undefined;
                    return scheduleView === 'previous' ? hasPlayed : !hasPlayed;
                  })
                  // For Results, show newest first. For Upcoming, show soonest first.
                  .sort((a, b) => {
                    const dateA = new Date(getDateString(a.game_date));
                    const dateB = new Date(getDateString(b.game_date));
                    return scheduleView === 'previous' ? dateB - dateA : dateA - dateB;
                  })
                  .slice(0, 20)
                  .map(g => {
                    const isWin = g.is_win || (Number(g.runs_scored) > Number(g.runs_allowed));
                    const resultText = isWin ? 'W' : 'L';
                    
                    return (
                      <tr key={g.game_id} style={{borderTop:'1px solid #111'}}>
                        <td style={tdS}>{getDateString(g.game_date)}</td>
                        <td style={tdS}>{g.home_away === 'away' ? '@ ' : ''}{g.opponent_team_name}</td>
                        <td style={tdS}>
                          {g.runs_scored !== null ? `${g.runs_scored}-${g.runs_allowed}` : 'TBD'}
                        </td>
                        <td style={{
                          ...tdS, 
                          color: g.runs_scored !== null ? (isWin ? '#00f2ff' : '#ff4466') : '#666'
                        }}>
                          {g.runs_scored !== null ? resultText : 'Scheduled'}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {/* Empty State Handler */}
            {games.filter(g => (scheduleView === 'previous' ? g.runs_scored !== null : g.runs_scored === null)).length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#444' }}>
                No {scheduleView} games found for this season.
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'roster' && (
          <Panel title="Active Roster">
            <table style={tableStyle}>
              <thead>
                <tr style={{ color: '#666' }}>
                  <th style={thS}>#</th>
                  <th style={thS}>Player</th>
                  <th style={thS}>Pos</th>
                  <th style={thS}>B/T</th>
                  <th style={thS}>Role</th>
                </tr>
              </thead>
              <tbody>
                {[...(roster || [])]
                  .sort((a, b) => String(a?.player_name || '').localeCompare(String(b?.player_name || '')))
                  .map((p) => {
                    const bt = `${p?.bat_side_code || '—'}/${p?.pitch_hand_code || '—'}`;
                    const role = p?.is_pitcher && p?.is_batter ? 'Two-way' : (p?.is_pitcher ? 'Pitcher' : 'Batter');
                    return (
                      <tr key={p.player_id} style={{ borderTop: '1px solid #111' }}>
                        <td style={tdS}>{p.primary_number || '—'}</td>
                        <td style={tdS}>{p.player_name || '—'}</td>
                        <td style={tdS}>{p.primary_position_abbr || '—'}</td>
                        <td style={tdS}>{bt}</td>
                        <td style={tdS}>{role}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {(roster || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#444' }}>
                No roster data found for this team/season.
              </div>
            )}
          </Panel>
        )}

        {activeTab === 'ballpark' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
            <Panel title="Ballpark Map"><InteractiveBallpark venue={venueData} /></Panel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Panel title="Stadium Info">
                <MiniStat label="Stadium" value={venueData?.venue_name} />
                <MiniStat label="Location" value={venueData ? `${venueData.city}, ${venueData.state}` : ''} />
                <MiniStat label="Surface" value={venueData?.turf_type} />
                <MiniStat label="Roof" value={venueData?.roof_type} />
              </Panel>
              <Panel title="Dimensions">
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                  <MiniStat label="LF" value={venueData?.left_line} />
                  <MiniStat label="RF" value={venueData?.right_line} />
                  <MiniStat label="CF" value={venueData?.center} />
                </div>
              </Panel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Styles ---
const selectStyle = { padding: '10px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '8px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const thS = { padding: '12px 8px', fontSize: '0.8rem', textTransform: 'uppercase' };
const tdS = { padding: '12px 8px' };
const tabBtn = (active) => ({ 
  padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
  background: active ? '#00f2ff22' : 'transparent', color: active ? '#00f2ff' : '#666'
});

function Panel({ title, children }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
      <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: '16px', fontWeight: '600' }}>{title}</div>
      {children}
    </div>
  );
}

function StatCard({ title, value, sub }) {
  return (
    <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '16px', padding: '20px' }}>
      <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '4px' }}>{value}</div>
      <div style={{ color: '#aaa', fontSize: '0.85rem' }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '10px', background: '#050505', border: '1px solid #111', borderRadius: '8px', marginBottom: '8px' }}>
      <div style={{ color: '#555', fontSize: '0.7rem' }}>{label}</div>
      <div style={{ fontWeight: '700' }}>{value || '—'}</div>
    </div>
  );
}