import React from 'react';

export default function TitleBar({ title }) {
  return (
    <div className="title-bar">
      <div className="title-bar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          {/* Traffic-cone silhouette — nod to VLC, modern flat fill */}
          <path d="M12 3 L6 20 L18 20 Z" fill="#FF8800" />
          <rect x="5" y="20" width="14" height="1.5" rx="0.6" fill="#1b1b1b" />
          <path d="M9.2 11 L14.8 11" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M7.8 15.2 L16.2 15.2" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <span className="title-bar-text">{title}</span>
    </div>
  );
}
