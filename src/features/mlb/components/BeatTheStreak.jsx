import React, { useState, useEffect } from 'react';
import { fetchMLBPredictions } from '../../../services/bigqueryService';

const RISK_PROFILES = [
  { value: 'aggressive', label: 'Aggressive', threshold: '.200+' },
  { value: 'balanced', label: 'Balanced', threshold: '.250+' },
  { value: 'conservative', label: 'Conservative', threshold: '.280+' },
  { value: 'very_conservative', label: 'Very Conservative', threshold: '.300+' },
  { value: 'ultra_conservative', label: 'Ultra Conservative', threshold: '.330+' },
];

const LIMIT_OPTIONS = [10, 20, 50];

export default function BeatTheStreak() {
  const [riskProfile, setRiskProfile] = useState('balanced');
  const [limit, setLimit] = useState(20);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [date, setDate] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMLBPredictions(riskProfile, limit);
        if (cancelled) return;
        if (res.success) {
          setPredictions(res.predictions || []);
          setDate(res.date || '');
        } else {
          setError('Failed to load predictions.');
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || err.message || 'Failed to load predictions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [riskProfile, limit]);

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : '';

  const topPick = predictions[0] || null;
  const rest = predictions.slice(1);

  return (
    <div style={{
      padding: 'clamp(16px, 3vw, 40px)',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          fontWeight: '700',
          margin: '0 0 4px',
          background: 'linear-gradient(90deg, #00f2ff 0%, #ff0055 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Beat the Streak — ML Predictions
        </h2>
        {formattedDate && (
          <p style={{ margin: '0 0 2px', color: '#888', fontSize: '0.9rem' }}>{formattedDate}</p>
        )}
        <p style={{ margin: 0, color: '#555', fontSize: '0.8rem' }}>
          Ranked by 30-day rolling batting average · Filter by minimum BA threshold
        </p>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        {/* Risk Profile Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: '12px',
          padding: '4px',
          flexWrap: 'wrap'
        }}>
          {RISK_PROFILES.map(profile => (
            <RiskButton
              key={profile.value}
              profile={profile}
              active={riskProfile === profile.value}
              onClick={() => setRiskProfile(profile.value)}
            />
          ))}
        </div>

        {/* Limit Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#888', fontSize: '0.875rem' }}>Show top</span>
          <div style={{
            display: 'flex',
            gap: '4px',
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: '12px',
            padding: '4px'
          }}>
            {LIMIT_OPTIONS.map(n => (
              <LimitButton
                key={n}
                value={n}
                active={limit === n}
                onClick={() => setLimit(n)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          color: '#888',
          fontSize: '1rem'
        }}>
          Loading predictions...
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{
          background: 'rgba(255, 0, 85, 0.08)',
          border: '1px solid rgba(255, 0, 85, 0.3)',
          borderRadius: '12px',
          padding: '24px',
          color: '#ff0055',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px' }}>Failed to load predictions</div>
          <div style={{ fontSize: '0.8125rem', color: '#cc3355', fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {error}
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#888' }}>
            Check that <code style={{ color: '#aaa' }}>mlb_modeling.ml_mlb__daily_predictions</code> is accessible and the server is running.
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && predictions.length === 0 && (
        <div style={{
          background: '#0a0a0a',
          border: '1px solid #222',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚾</div>
          <h3 style={{ color: '#fff', margin: '0 0 8px', fontWeight: '600' }}>
            No Predictions Available
          </h3>
          <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>
            No games are scheduled for today, or predictions haven't been generated yet. Check back after 9 AM ET.
          </p>
        </div>
      )}

      {/* Top Pick Feature Card */}
      {!loading && !error && topPick && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px'
          }}>
            <span style={{
              background: 'linear-gradient(90deg, #00f2ff, #ff0055)',
              borderRadius: '6px',
              padding: '2px 10px',
              fontSize: '0.75rem',
              fontWeight: '700',
              color: '#000',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Top Pick
            </span>
          </div>
          <TopPickCard prediction={topPick} />
        </div>
      )}

      {/* Prediction Grid */}
      {!loading && !error && rest.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {rest.map((prediction, i) => (
            <PredictionCard
              key={prediction.player_id || i}
              prediction={prediction}
              rank={i + 2}
              hovered={hoveredCard === (prediction.player_id || i)}
              onMouseEnter={() => setHoveredCard(prediction.player_id || i)}
              onMouseLeave={() => setHoveredCard(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RiskButton({ profile, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 14px',
        background: active ? 'rgba(0, 242, 255, 0.15)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#00f2ff' : hovered ? '#fff' : '#888',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: active ? '600' : '400',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap'
      }}
    >
      {profile.label}
      <span style={{
        marginLeft: '5px',
        fontSize: '0.7rem',
        opacity: 0.7
      }}>
        {profile.threshold}
      </span>
    </button>
  );
}

function LimitButton({ value, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '6px 12px',
        background: active ? 'rgba(0, 242, 255, 0.15)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#00f2ff' : hovered ? '#fff' : '#888',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.8125rem',
        fontWeight: active ? '600' : '400',
        transition: 'all 0.15s'
      }}
    >
      {value}
    </button>
  );
}

function TopPickCard({ prediction }) {
  const pct = (prediction.hit_probability * 100).toFixed(1);
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0, 242, 255, 0.06) 0%, rgba(255, 0, 85, 0.04) 100%)',
      border: '1px solid rgba(0, 242, 255, 0.25)',
      borderRadius: '16px',
      padding: '28px 32px',
      display: 'flex',
      alignItems: 'center',
      gap: '32px',
      flexWrap: 'wrap'
    }}>
      {/* Rank */}
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #00f2ff, #0088aa)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '800',
        fontSize: '1.25rem',
        color: '#000',
        flexShrink: 0
      }}>
        #1
      </div>

      {/* Player Info */}
      <div style={{ flex: 1, minWidth: '160px' }}>
        <div style={{ fontSize: '1.375rem', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>
          {prediction.player_name}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '2px' }}>
          {prediction.team_id} vs {prediction.opponent_team_id}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>
          {prediction.game_time}
          {prediction.batting_order_position > 0 && (
            <span style={{ marginLeft: '10px' }}>
              Batting {prediction.batting_order_position}
            </span>
          )}
        </div>
      </div>

      {/* Probability */}
      <div style={{ textAlign: 'right', minWidth: '120px' }}>
        <div style={{
          fontSize: '2.5rem',
          fontWeight: '800',
          color: '#00f2ff',
          lineHeight: 1
        }}>
          .{String(Math.round(prediction.hit_probability * 1000)).padStart(3, '0')}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
          Rolling BA (L30)
        </div>
        <ProbabilityBar pct={parseFloat(pct)} color="#00f2ff" height={6} width={120} />
      </div>
    </div>
  );
}

function PredictionCard({ prediction, rank, hovered, onMouseEnter, onMouseLeave }) {
  const avg = prediction.hit_probability;
  const probColor = avg >= 0.300 ? '#00f2ff' : avg >= 0.270 ? '#00d4aa' : '#aaa';

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: hovered ? '#111' : '#0a0a0a',
        border: `1px solid ${hovered ? '#333' : '#222'}`,
        borderRadius: '16px',
        padding: '20px',
        transition: 'all 0.15s',
        cursor: 'default'
      }}
    >
      {/* Card Header: rank + probability */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#1a1a1a',
          border: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.75rem',
          fontWeight: '700',
          color: '#888'
        }}>
          #{rank}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.625rem', fontWeight: '800', color: probColor, lineHeight: 1 }}>
            .{String(Math.round(prediction.hit_probability * 1000)).padStart(3, '0')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#555', marginTop: '2px' }}>Rolling BA</div>
        </div>
      </div>

      {/* Player Name */}
      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>
        {prediction.player_name}
      </div>

      {/* Matchup */}
      <div style={{ fontSize: '0.8125rem', color: '#888', marginBottom: '3px' }}>
        {prediction.team_id}
        <span style={{ margin: '0 6px', color: '#444' }}>vs</span>
        {prediction.opponent_team_id}
      </div>

      {/* Game Time */}
      <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '14px' }}>
        {prediction.game_time}
        {prediction.batting_order_position > 0 && (
          <span style={{ marginLeft: '8px' }}>· Batting {prediction.batting_order_position}</span>
        )}
      </div>

      {/* Probability Bar */}
      <ProbabilityBar pct={avg * 100} color={probColor} />
    </div>
  );
}

function ProbabilityBar({ pct, color = '#00f2ff', height = 4, width = null }) {
  return (
    <div style={{
      width: width ? `${width}px` : '100%',
      height: `${height}px`,
      background: '#1a1a1a',
      borderRadius: '99px',
      overflow: 'hidden',
      marginTop: '8px'
    }}>
      <div style={{
        height: '100%',
        width: `${Math.min(pct, 100)}%`,
        background: color,
        borderRadius: '99px',
        transition: 'width 0.4s ease'
      }} />
    </div>
  );
}
