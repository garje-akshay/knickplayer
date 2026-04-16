import React, { useCallback } from 'react';
import { usePlayerContext } from '../hooks/PlayerContext';
import { formatTime } from '../utils/helpers';

// Unified modern stroke style — 24px grid, Lucide-inspired
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const IconAdd = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IconRemove = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IconClear = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
);
const IconVideo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
);
const IconAudio = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
);
const IconShuffle = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" /><polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" /><line x1="4" y1="4" x2="9" y2="9" /></svg>
);
const IconRepeatAll = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
);
const IconRepeatOne = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /><path d="M11 10h1v4" /></svg>
);

export default function Playlist({ visible }) {
  const { playlist } = usePlayerContext();

  const handleDblClick = useCallback((index) => {
    playlist.playIndex(index);
  }, [playlist]);

  if (!visible) return null;

  return (
    <div className="playlist-panel">
      <div className="playlist-header">
        <span>Playlist</span>
        <div className="playlist-toolbar">
          <button className="playlist-btn" title="Add" onClick={() => document.dispatchEvent(new CustomEvent('kp-open-file'))}><IconAdd /></button>
          <button className="playlist-btn" title="Remove" onClick={() => {
            if (playlist.currentIndex >= 0) playlist.remove(playlist.currentIndex);
          }}><IconRemove /></button>
          <button className="playlist-btn" title="Clear" onClick={() => playlist.clear()}><IconClear /></button>
        </div>
      </div>
      <div className="playlist-content">
        {playlist.items.length === 0 ? (
          <div className="playlist-empty">No items in playlist</div>
        ) : (
          playlist.items.map((item, i) => (
            <div
              key={item.id}
              className={`playlist-item${i === playlist.currentIndex ? ' active playing' : ''}`}
              onDoubleClick={() => handleDblClick(i)}
              onClick={() => {}} // selection handled via CSS active
            >
              <span className="pl-icon">{item.type === 'audio' ? <IconAudio /> : <IconVideo />}</span>
              <span className="pl-name" title={item.name}>{item.name}</span>
              <span className="pl-duration">{item.duration > 0 ? formatTime(item.duration) : ''}</span>
            </div>
          ))
        )}
      </div>
      <div className="playlist-footer">
        <button className={`playlist-mode-btn${playlist.shuffle ? ' active' : ''}`} onClick={() => playlist.toggleShuffle()} title="Shuffle"><IconShuffle /></button>
        <button className={`playlist-mode-btn${playlist.repeat === 'all' ? ' active' : ''}`} onClick={() => playlist.cycleRepeat()} title="Repeat"><IconRepeatAll /></button>
        <button className={`playlist-mode-btn${playlist.repeat === 'one' ? ' active' : ''}`} onClick={() => playlist.cycleRepeat()} title="Loop"><IconRepeatOne /></button>
      </div>
    </div>
  );
}
