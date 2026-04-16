import React from 'react';

export default function AppLogo({ size = 120 }) {
  return (
    <svg className="app-logo-large" viewBox="0 0 200 200" width={size} height={size}>
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#6C5CE7' }} />
          <stop offset="100%" style={{ stopColor: '#00CEFF' }} />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="100" cy="100" r="80" fill="url(#logoGrad)" opacity="0.15" />
      <circle cx="100" cy="100" r="60" fill="none" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.4" />
      <polygon points="82,60 82,140 145,100" fill="url(#logoGrad)" filter="url(#logoGlow)" />
    </svg>
  );
}
