import React from 'react';

const BlizzLogo = ({ size = 24, color = '#000000' }) => {
  // Calculate font size based on the provided size
  const fontSize = Math.floor(size * 0.4);
  
  return (
    <div 
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: `${fontSize}px`,
        color: color,
        letterSpacing: '1px',
        textShadow: '0px 0px 1px rgba(0,0,0,0.3)',
        backgroundColor: 'white',
        borderRadius: '4px',
        padding: '2px'
      }}
    >
      BLIZZ
    </div>
  );
};

export default BlizzLogo;
