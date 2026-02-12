import React from 'react';

/**
 * SeasonStatsTable Component
 * Displays season-by-season statistics for a player
 * Supports both batting and pitching stats
 */
export default function SeasonStatsTable({ seasons, playerType = 'batter' }) {
  if (!seasons || seasons.length === 0) {
    return (
      <div style={{
        background: '#0a0a0a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '40px',
        textAlign: 'center',
        color: '#666'
      }}>
        No season statistics available
      </div>
    );
  }

  // Determine which columns to show based on player type
  const isBatter = playerType === 'batter';
  
  return (
    <div style={{
      background: '#0a0a0a',
      border: '1px solid #333',
      borderRadius: '12px',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #333',
        background: 'linear-gradient(90deg, rgba(0, 242, 255, 0.05) 0%, transparent 100%)'
      }}>
        <h3 style={{ margin: 0, color: '#00f2ff', fontSize: '1.125rem', fontWeight: '600' }}>
          Season by Season Statistics
        </h3>
      </div>
      
      <div style={{ 
        overflowX: 'auto', 
        overflowY: 'auto',
        maxHeight: '500px'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.875rem'
        }}>
          <thead style={{ 
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <tr style={{
              background: '#050505',
              borderBottom: '1px solid #333'
            }}>
              <th style={{...headerStyle, position: 'sticky', left: 0, background: '#050505', zIndex: 11}}>Season</th>
              <th style={{...headerStyle, position: 'sticky', left: '80px', background: '#050505', zIndex: 11}}>Team</th>
              <th style={headerStyle}>G</th>
              
              {isBatter ? (
                <>
                  <th style={headerStyle}>PA</th>
                  <th style={headerStyle}>AB</th>
                  <th style={headerStyle}>R</th>
                  <th style={headerStyle}>H</th>
                  <th style={headerStyle}>2B</th>
                  <th style={headerStyle}>3B</th>
                  <th style={headerStyle}>HR</th>
                  <th style={headerStyle}>RBI</th>
                  <th style={headerStyle}>SB</th>
                  <th style={headerStyle}>CS</th>
                  <th style={headerStyle}>BB</th>
                  <th style={headerStyle}>SO</th>
                  <th style={headerStyle}>HBP</th>
                  <th style={headerStyle}>SF</th>
                  <th style={headerStyle}>AVG</th>
                  <th style={headerStyle}>OBP</th>
                  <th style={headerStyle}>SLG</th>
                  <th style={headerStyle}>OPS</th>
                  <th style={headerStyle}>WAR</th>
                </>
              ) : (
                <>
                  <th style={headerStyle}>ERA</th>
                  <th style={headerStyle}>IP</th>
                  <th style={headerStyle}>H</th>
                  <th style={headerStyle}>R</th>
                  <th style={headerStyle}>BB</th>
                  <th style={headerStyle}>SO</th>
                  <th style={headerStyle}>WHIP</th>
                  <th style={headerStyle}>K/9</th>
                  <th style={headerStyle}>K%</th>
                  <th style={headerStyle}>Str%</th>
                  <th style={headerStyle}>Velo</th>
                  <th style={headerStyle}>QS</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {seasons.map((season, index) => (
              <tr key={index} style={{
                borderBottom: '1px solid #222',
                transition: 'background 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0f0f0f'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{...cellStyle, position: 'sticky', left: 0, background: index % 2 === 0 ? '#0a0a0a' : '#0a0a0a', fontWeight: '600'}}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0f0f0f'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#0a0a0a'}
                >
                  {season.season}
                </td>
                <td style={{...cellStyle, position: 'sticky', left: '80px', background: index % 2 === 0 ? '#0a0a0a' : '#0a0a0a', fontWeight: '600', color: '#00f2ff'}}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0f0f0f'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#0a0a0a'}
                >
                  {season.team_name || season.team_abbrev || 'N/A'}
                </td>
                <td style={cellStyle}>{season.games || 0}</td>
                
                {isBatter ? (
                  <>
                    <td style={cellStyle}>{season.plate_appearances || 0}</td>
                    <td style={cellStyle}>{season.at_bats || 0}</td>
                    <td style={cellStyle}>{season.runs || 0}</td>
                    <td style={cellStyle}>{season.hits || 0}</td>
                    <td style={cellStyle}>{season.doubles || 0}</td>
                    <td style={cellStyle}>{season.triples || 0}</td>
                    <td style={cellStyle}>{season.home_runs || 0}</td>
                    <td style={cellStyle}>{season.rbi || 0}</td>
                    <td style={cellStyle}>{season.stolen_bases || 0}</td>
                    <td style={cellStyle}>{season.caught_stealing || 0}</td>
                    <td style={cellStyle}>{season.walks || 0}</td>
                    <td style={cellStyle}>{season.strikeouts || 0}</td>
                    <td style={cellStyle}>{season.hit_by_pitch || 0}</td>
                    <td style={cellStyle}>{season.sacrifice_flies || 0}</td>
                    <td style={cellStyle}>{season.avg?.toFixed(3) || '.000'}</td>
                    <td style={cellStyle}>{season.obp?.toFixed(3) || '.000'}</td>
                    <td style={cellStyle}>{season.slg?.toFixed(3) || '.000'}</td>
                    <td style={{...cellStyle, color: '#00f2ff', fontWeight: '600'}}>
                      {season.ops?.toFixed(3) || '.000'}
                    </td>
                    <td style={{...cellStyle, color: '#FFD700', fontWeight: '600'}}>
                      {season.war?.toFixed(1) || '0.0'}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{...cellStyle, color: '#00f2ff', fontWeight: '600'}}>
                      {season.era?.toFixed(2) || '0.00'}
                    </td>
                    <td style={cellStyle}>{season.innings_pitched?.toFixed(1) || '0.0'}</td>
                    <td style={cellStyle}>{season.hits || 0}</td>
                    <td style={cellStyle}>{season.runs || 0}</td>
                    <td style={cellStyle}>{season.walks || 0}</td>
                    <td style={cellStyle}>{season.strikeouts || 0}</td>
                    <td style={cellStyle}>{season.whip?.toFixed(2) || '0.00'}</td>
                    <td style={cellStyle}>
                      {season.innings_pitched > 0 
                        ? ((season.strikeouts / season.innings_pitched) * 9).toFixed(1) 
                        : '0.0'}
                    </td>
                    <td style={cellStyle}>
                      {season.k_percentage ? season.k_percentage.toFixed(1) + '%' : '0.0%'}
                    </td>
                    <td style={cellStyle}>
                      {season.strike_percentage ? season.strike_percentage.toFixed(1) + '%' : '0.0%'}
                    </td>
                    <td style={cellStyle}>{season.avg_pitch_velocity?.toFixed(1) || '0.0'}</td>
                    <td style={cellStyle}>{season.quality_starts || 0}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const headerStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  color: '#888',
  fontWeight: '600',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const cellStyle = {
  padding: '14px 16px',
  color: '#fff',
  whiteSpace: 'nowrap'
};
