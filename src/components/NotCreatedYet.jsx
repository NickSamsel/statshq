import React from 'react';

const NotCreatedYet = ({ sportName }) => (
  <div style={{ 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '60px 20px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '15px',
    border: '2px dashed #444',
    color: '#888',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🚧</div>
    <h2 style={{ color: '#aaa', margin: '0 0 10px 0' }}>{sportName} Analytics Not Created Yet</h2>
    <p style={{ maxWidth: '400px', lineHeight: '1.6' }}>
      We're currently focusing our engineering efforts on the **MLB 3D Visualizer**. 
      Check back soon for advanced {sportName} metrics!
    </p>
  </div>
);

export default NotCreatedYet;