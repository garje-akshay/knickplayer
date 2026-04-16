import React from 'react';

export default function StatusBar({ visible, text, codec, resolution, streamInfo }) {
  if (!visible) return null;
  return (
    <div className="status-bar">
      <span className="status-text">{text}</span>
      <span className="status-right">
        {streamInfo && (
          <span className="status-stream-badge">
            {streamInfo.type}{streamInfo.live ? ' LIVE' : ''}
          </span>
        )}
        <span>{codec}</span>
        <span>{resolution}</span>
      </span>
    </div>
  );
}
