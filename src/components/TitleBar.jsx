import React from 'react';

export default function TitleBar({ title }) {
  return (
    <div className="title-bar">
      <div className="title-bar-icon">
        <svg viewBox="0 0 24 24" width="16" height="16">
          <defs>
            <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6C5CE7" />
              <stop offset="100%" stopColor="#00CEFF" />
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill="url(#titleGrad)" opacity="0.9" />
          <polygon points="10,7 10,17 18,12" fill="#fff" />
        </svg>
      </div>
      <span className="title-bar-text">{title}</span>
    </div>
  );
}
