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

export default function TeamExplorer({ prefillTeam }) {
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

  const [standingsSnapshot, setStandingsSnapshot] = useState(null);
  const [divisionStandings, setDivisionStandings] = useState([]);
  const [standingsHistory, setStandingsHistory] = useState([]);
  const [standingsDate, setStandingsDate] = useState(null);

  const appliedPrefillKeyRef = useRef(null);

  // Apply external prefill (from player card) for season/team selection
  useEffect(() => {
    if (!prefillTeam) return;
    const key = `${prefillTeam.teamId || ''}|${prefillTeam.teamAbbr || ''}|${prefillTeam.teamName || ''}|${prefillTeam.season || ''}|${prefillTeam._ts || ''}`;
    if (appliedPrefillKeyRef.current === key) return;
    appliedPrefillKeyRef.current = key;

    const seasonNum = Number.parseInt(String(prefillTeam.season || ''), 10);
    if (Number.isFinite(seasonNum) && seasonNum) {
      setSelectedSeason(seasonNum);
    }
  }, [prefillTeam]);

  // Load seasons + initialize to most recent
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const seasonList = await fetchMLBTeamSeasons();
        if (cancelled) return;
        setSeasons(seasonList);
        setSelectedSeason(seasonList?.[0] ?? 2025);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load seasons');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load teams when season changes
  useEffect(() => {
    if (!selectedSeason) return;

    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const teamRows = await fetchMLBTeamsList({ season: selectedSeason });
        if (cancelled) return;
        setTeams(teamRows);
        // Default to first team in list if nothing selected
        if (!selectedTeamId && teamRows?.length) {
          setSelectedTeamId(teamRows[0].team_id);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load teams');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason]);

  // After teams load, try to match the prefill team (by id, abbr, or name)
  useEffect(() => {
    if (!prefillTeam) return;
    if (!teams?.length) return;

    const key = `${prefillTeam.teamId || ''}|${prefillTeam.teamAbbr || ''}|${prefillTeam.teamName || ''}|${prefillTeam.season || ''}|${prefillTeam._ts || ''}`;
    // Only auto-select the team for the most recent prefill action.
    if (appliedPrefillKeyRef.current !== key) return;

    const desiredId = prefillTeam.teamId ? String(prefillTeam.teamId) : null;
    const desiredAbbr = prefillTeam.teamAbbr ? String(prefillTeam.teamAbbr).toUpperCase() : null;
    const desiredName = prefillTeam.teamName ? String(prefillTeam.teamName) : null;

    const match = teams.find((t) => {
      if (desiredId && String(t.team_id) === desiredId) return true;
      if (desiredAbbr && String(t.team_abbr || '').toUpperCase() === desiredAbbr) return true;
      if (desiredName && String(t.team_name || '') === desiredName) return true;
      return false;
    });

    if (match && String(match.team_id) !== String(selectedTeamId)) {
      setSelectedTeamId(match.team_id);
    }
  }, [prefillTeam, teams, selectedTeamId]);

  // Load team data when team/season changes
  useEffect(() => {
    if (!selectedSeason || !selectedTeamId) return;

    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const [seasonRow, statcastRow, gameRows] = await Promise.all([
          fetchMLBTeamSeasonStats(selectedTeamId, { season: selectedSeason }),
          fetchMLBTeamStatcastMetrics(selectedTeamId, { season: selectedSeason }),
          fetchMLBTeamGames(selectedTeamId, { season: selectedSeason, limit: 162 }),
          fetchMLBVenues(selectedTeamId, { season: selectedSeason })
        ]);
        if (cancelled) return;
        setSeasonStats(seasonRow);
        setStatcastMetrics(statcastRow);
        setGames(gameRows || []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load team stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedSeason, selectedTeamId]);

  // Load standings snapshot for the season (all teams), then derive division view + team snapshot
  useEffect(() => {
    if (!selectedSeason) return;

    let cancelled = false;
    (async () => {
      try {
        const standings = await fetchMLBTeamStandings({ season: selectedSeason });
        if (cancelled) return;
        const rows = standings?.rows || [];
        setStandingsDate(standings?.standings_date || null);

        // Snapshot for selected team if available
        const teamRow = rows.find(r => String(r.team_id) === String(selectedTeamId));
        setStandingsSnapshot(teamRow || null);

        // Division standings once we know selected team/division
        const divisionId = teamRow?.division_id;
        if (divisionId) {
          setDivisionStandings(rows.filter(r => r.division_id === divisionId).sort((a, b) => (a.division_rank || 99) - (b.division_rank || 99)));
        } else {
          setDivisionStandings([]);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load standings');
      }
    })();

    return () => { cancelled = true; };
  }, [selectedSeason, selectedTeamId]);

  // Load standings history for selected team (trend)
  useEffect(() => {
    if (!selectedSeason || !selectedTeamId) return;

    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMLBTeamStandingsHistory(selectedTeamId, { season: selectedSeason });
        if (cancelled) return;
        setStandingsHistory(rows || []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load standings history');
      }
    })();

    return () => { cancelled = true; };
  }, [selectedSeason, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find(t => t.team_id === selectedTeamId) || null,
    [teams, selectedTeamId]
  );

  const gamesChrono = useMemo(() => {
    const rows = [...(games || [])];
    rows.sort((a, b) => getDateString(a.game_date).localeCompare(getDateString(b.game_date)));
    return rows;
  }, [games]);

  const cumulativeRunDiffSeries = useMemo(() => {
    let cum = 0;
    return gamesChrono.map((g, idx) => {
      cum += Number(g.run_differential || 0);
      return {
        game: idx + 1,
        date: getDateString(g.game_date),
        cumulative_run_diff: cum
      };
    });
  }, [gamesChrono]);

  const runBars = useMemo(() => {
    return gamesChrono.slice(-20).map((g) => ({
      date: getDateString(g.game_date),
      runs_scored: g.runs_scored,
      runs_allowed: g.runs_allowed
    }));
  }, [gamesChrono]);

  const standingsTrend = useMemo(() => {
    return (standingsHistory || []).map((r) => ({
      date: getDateString(r.standings_date),
      win_pct: Number(r.win_pct || 0) * 100,
      games_back: Number(r.games_back ?? 0),
      run_diff: Number(r.run_differential ?? 0)
    }));
  }, [standingsHistory]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050505',
      color: '#fff',
      padding: 'clamp(16px, 3vw, 40px)'
    }}>
      {loading && <LoadingSpinner3D />}

      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.875rem', fontWeight: '700' }}>
          Explore Team Stats
        </h2>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>Season</div>
            <select
              value={selectedSeason ?? ''}
              onChange={(e) => setSelectedSeason(Number(e.target.value))}
              style={{
                padding: '12px 14px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '10px',
                color: '#fff',
                outline: 'none'
              }}
            >
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px' }}>Team</div>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              style={{
                minWidth: '320px',
                padding: '12px 14px',
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: '10px',
                color: '#fff',
                outline: 'none'
              }}
            >
              {teams.map((t) => (
                <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
              ))}
            </select>
          </div>

          {selectedTeam && (
            <div style={{ color: '#888', fontSize: '0.875rem', marginTop: '22px' }}>
              {selectedTeam.league_name} • {selectedTeam.division_name}
            </div>
          )}
        </div>

        {error && (
          <div style={{
            marginBottom: '24px',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid #552233',
            background: 'rgba(255, 0, 85, 0.08)',
            color: '#ff7aa2'
          }}>
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <StatCard
            title="Record"
            value={seasonStats ? `${seasonStats.wins}-${seasonStats.losses}` : '—'}
            sub={seasonStats ? `Win% ${formatNumber(seasonStats.win_pct, 3)}` : '—'}
            tooltip={seasonStats ? joinRankLines([
              `Wins rank: ${formatRank(seasonStats.wins_rank) || '—'}`,
              `Win% rank: ${formatRank(seasonStats.win_pct_rank) || '—'}`
            ]) : undefined}
            onTooltip={setHoverTooltip}
          />
          <StatCard
            title="Runs"
            value={seasonStats ? `${seasonStats.total_runs_scored} RS / ${seasonStats.total_runs_allowed} RA` : '—'}
            sub={seasonStats ? `Diff ${seasonStats.total_run_differential}` : '—'}
            tooltip={seasonStats ? joinRankLines([
              `Runs scored rank: ${formatRank(seasonStats.runs_scored_rank) || '—'}`,
              `Runs allowed rank: ${formatRank(seasonStats.runs_allowed_rank) || '—'}`,
              `Run diff rank: ${formatRank(seasonStats.run_diff_rank) || '—'}`
            ]) : undefined}
            onTooltip={setHoverTooltip}
          />
          <StatCard
            title="Batting"
            value={seasonStats ? `OPS ${formatNumber(seasonStats.season_ops, 3)}` : '—'}
            sub={seasonStats ? `AVG ${formatNumber(seasonStats.season_batting_avg, 3)} • OBP ${formatNumber(seasonStats.season_obp, 3)} • SLG ${formatNumber(seasonStats.season_slg, 3)}` : '—'}
            tooltip={seasonStats ? joinRankLines([
              `OPS rank: ${formatRank(seasonStats.ops_rank) || '—'}`,
              `AVG rank: ${formatRank(seasonStats.avg_rank) || '—'}`,
              `OBP rank: ${formatRank(seasonStats.obp_rank) || '—'}`,
              `SLG rank: ${formatRank(seasonStats.slg_rank) || '—'}`
            ]) : undefined}
            onTooltip={setHoverTooltip}
          />
          <StatCard
            title="Pitching"
            value={seasonStats ? `ERA ${formatNumber(seasonStats.season_era, 2)}` : '—'}
            sub={seasonStats ? `WHIP ${formatNumber(seasonStats.season_whip, 3)} • K/9 ${formatNumber(seasonStats.season_k_per_nine, 2)} • BB/9 ${formatNumber(seasonStats.season_bb_per_nine, 2)}` : '—'}
            tooltip={seasonStats ? joinRankLines([
              `ERA rank: ${formatRank(seasonStats.era_rank) || '—'}`,
              `WHIP rank: ${formatRank(seasonStats.whip_rank) || '—'}`,
              `K/9 rank: ${formatRank(seasonStats.k9_rank) || '—'}`,
              `BB/9 rank: ${formatRank(seasonStats.bb9_rank) || '—'}`
            ]) : undefined}
            onTooltip={setHoverTooltip}
          />
        </div>

        {hoverTooltip?.text ? (
          <div style={{
            position: 'fixed',
            left: hoverTooltip.x,
            top: hoverTooltip.y,
            transform: 'translate(12px, 12px)',
            zIndex: 9999,
            background: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '10px',
            padding: '8px 10px',
            color: '#ddd',
            fontSize: '0.75rem',
            maxWidth: '300px',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }} role="tooltip" aria-hidden>
            {hoverTooltip.text}
          </div>
        ) : null}

        {/* Charts */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <Panel title="Cumulative Run Differential">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={cumulativeRunDiffSeries} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                  <XAxis dataKey="game" stroke="#777" />
                  <YAxis stroke="#777" />
                  <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
                  <Line type="monotone" dataKey="cumulative_run_diff" stroke="#00f2ff" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Recent Runs (last 20 games)">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={runBars} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#777" hide />
                  <YAxis stroke="#777" />
                  <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
                  <Legend />
                  <Bar dataKey="runs_scored" fill="#00f2ff" name="Runs Scored" />
                  <Bar dataKey="runs_allowed" fill="#ff0055" name="Runs Allowed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Standings */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <Panel title={`Standings Trend${standingsDate ? ` (as of ${getDateString(standingsDate)})` : ''}`}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={standingsTrend} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
                  <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#777" hide />
                  <YAxis yAxisId="left" stroke="#777" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#777" />
                  <Tooltip contentStyle={{ background: '#0a0a0a', border: '1px solid #333' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="win_pct" stroke="#00f2ff" dot={false} strokeWidth={2} name="Win%" />
                  <Line yAxisId="right" type="monotone" dataKey="games_back" stroke="#ff0055" dot={false} strokeWidth={2} name="Games Back" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {standingsSnapshot && (
              <div style={{
                marginTop: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}>
                <MiniStat label="Division Rank" value={standingsSnapshot.division_rank ?? '—'} />
                <MiniStat label="Games Back" value={standingsSnapshot.games_back ?? '—'} />
                <MiniStat label="Last 10" value={standingsSnapshot.last_ten_record ?? '—'} />
                <MiniStat label="Streak" value={standingsSnapshot.streak ?? '—'} />
              </div>
            )}
          </Panel>

          <Panel title="Division Standings">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#aaa' }}>
                    <th style={thStyle}>Rk</th>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>W</th>
                    <th style={thStyle}>L</th>
                    <th style={thStyle}>GB</th>
                    <th style={thStyle}>Diff</th>
                    <th style={thStyle}>L10</th>
                    <th style={thStyle}>Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {(divisionStandings || []).map((r) => {
                    const isSelected = String(r.team_id) === String(selectedTeamId);
                    return (
                      <tr
                        key={String(r.team_id)}
                        style={{
                          borderTop: '1px solid #1e1e1e',
                          background: isSelected ? 'rgba(0, 242, 255, 0.06)' : 'transparent'
                        }}
                      >
                        <td style={{ ...tdStyle, color: isSelected ? '#00f2ff' : '#ddd' }}>{r.division_rank}</td>
                        <td style={{ ...tdStyle, fontWeight: isSelected ? 700 : 500 }}>{r.team_name}</td>
                        <td style={tdStyle}>{r.wins}</td>
                        <td style={tdStyle}>{r.losses}</td>
                        <td style={tdStyle}>{r.games_back}</td>
                        <td style={tdStyle}>{r.run_differential}</td>
                        <td style={tdStyle}>{r.last_ten_record}</td>
                        <td style={tdStyle}>{r.streak}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        {/* Statcast rollup */}
        <Panel title="Team Statcast (season rollup)">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px'
          }}>
            <MiniStat label="Avg EV" value={statcastMetrics ? formatNumber(statcastMetrics.avg_exit_velocity, 1) : '—'} />
            <MiniStat label="Barrel Rate" value={statcastMetrics ? formatPct(statcastMetrics.barrel_rate) : '—'} />
            <MiniStat label="Hard Hit Rate" value={statcastMetrics ? formatPct(statcastMetrics.hard_hit_rate) : '—'} />
            <MiniStat label="Staff Velo" value={statcastMetrics ? formatNumber(statcastMetrics.staff_avg_velocity, 1) : '—'} />
            <MiniStat label="Staff Whiff" value={statcastMetrics ? formatPct(statcastMetrics.staff_whiff_rate) : '—'} />
            <MiniStat label="Zone Rate" value={statcastMetrics ? formatPct(statcastMetrics.staff_zone_rate) : '—'} />
          </div>
        </Panel>

        {/* Recent games */}
        <Panel title="Recent Games">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#aaa' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>H/A</th>
                  <th style={thStyle}>Opponent</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Result</th>
                </tr>
              </thead>
              <tbody>
                {(games || []).slice(0, 25).map((g) => {
                  const result = g.is_win ? 'W' : g.is_loss ? 'L' : '';
                  const score = `${g.runs_scored}-${g.runs_allowed}`;
                  return (
                    <tr key={g.game_id + String(g.team_id)} style={{ borderTop: '1px solid #1e1e1e' }}>
                      <td style={tdStyle}>{getDateString(g.game_date)}</td>
                      <td style={tdStyle}>{g.home_away}</td>
                      <td style={tdStyle}>{g.opponent_team_name}</td>
                      <td style={tdStyle}>{score}</td>
                      <td style={{ ...tdStyle, color: result === 'W' ? '#00f2ff' : result === 'L' ? '#ff7aa2' : '#ccc' }}>
                        {result}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid #222',
      borderRadius: '16px',
      padding: '16px'
    }}>
      <div style={{
        fontSize: '0.875rem',
        color: '#aaa',
        marginBottom: '12px',
        letterSpacing: '0.5px'
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function StatCard({ title, value, sub, tooltip, onTooltip }) {
  const bind = (text) => {
    if (!onTooltip || !text) return {};
    return {
      onMouseEnter: (e) => onTooltip({ text, x: e.clientX, y: e.clientY }),
      onMouseMove: (e) => onTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : { text, x: e.clientX, y: e.clientY }),
      onMouseLeave: () => onTooltip(null)
    };
  };

  return (
    <div {...bind(tooltip)} title={tooltip} style={{
      background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)',
      border: '1px solid #222',
      borderRadius: '16px',
      padding: '16px'
    }}>
      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {title}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '6px' }}>
        {value}
      </div>
      <div style={{ color: '#aaa', fontSize: '0.875rem' }}>
        {sub}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      padding: '12px',
      borderRadius: '12px',
      border: '1px solid #222',
      background: '#070707'
    }}>
      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: '700' }}>{value}</div>
    </div>
  );
}

const thStyle = {
  padding: '10px 8px',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '1px'
};

const tdStyle = {
  padding: '10px 8px',
  color: '#ddd'
};
