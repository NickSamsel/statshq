import React from 'react';

const NotCreatedYet = ({ sportName }) => (
  <div className="page-container" style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🚧</div>
    <h2 style={{ color: 'var(--muted)', margin: '0 0 10px 0' }}>{sportName} Analytics Not Created Yet</h2>
    <p style={{ maxWidth: '520px', margin: '0 auto', lineHeight: '1.6', color: 'var(--muted)' }}>
      We’re currently focusing engineering effort on MLB. Check back soon for advanced {sportName} metrics.
    </p>
  </div>
);

export default NotCreatedYet;