import React from 'react';

/**
 * TeamExplorer Component
 * Placeholder for future team exploration feature
 * Shows "In Development" message
 */
export default function TeamExplorer() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#050505',
      color: '#fff',
      padding: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        borderRadius: '24px',
        padding: '60px 40px',
        border: '1px solid #333',
        boxShadow: '0 8px 32px rgba(0, 242, 255, 0.1)'
      }}>
        {/* Construction Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 24px',
          background: 'linear-gradient(135deg, rgba(0, 242, 255, 0.1) 0%, rgba(255, 0, 85, 0.1) 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem'
        }}>
          🚧
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: '2rem',
          fontWeight: '700',
          marginBottom: '16px',
          background: 'linear-gradient(90deg, #00f2ff 0%, #ff0055 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Team Explorer
        </h2>

        {/* Description */}
        <p style={{
          fontSize: '1.125rem',
          color: '#888',
          marginBottom: '32px',
          lineHeight: '1.6'
        }}>
          This feature is currently in development. Soon you'll be able to explore team statistics, 
          rosters, and performance analytics.
        </p>

        {/* Coming Soon Features */}
        <div style={{
          display: 'grid',
          gap: '16px',
          textAlign: 'left',
          marginTop: '40px'
        }}>
          <h3 style={{
            fontSize: '1rem',
            color: '#00f2ff',
            fontWeight: '600',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Coming Soon:
          </h3>
          
          {[
            'Team roster and depth charts',
            'Season-by-season team statistics',
            'Player performance comparisons',
            'Team pitching and batting analytics',
            'Historical team records and trends'
          ].map((feature, index) => (
            <div key={index} style={{
              padding: '16px',
              background: '#0a0a0a',
              border: '1px solid #222',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#00f2ff'
              }} />
              <span style={{ color: '#ccc', fontSize: '0.9375rem' }}>{feature}</span>
            </div>
          ))}
        </div>

        {/* Footer Message */}
        <div style={{
          marginTop: '40px',
          paddingTop: '24px',
          borderTop: '1px solid #333',
          color: '#666',
          fontSize: '0.875rem'
        }}>
          In the meantime, explore individual player profiles for detailed statistics and visualizations.
        </div>
      </div>
    </div>
  );
}
