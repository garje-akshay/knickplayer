import React, { useCallback } from 'react';
import { usePlayerContext } from '../hooks/PlayerContext';
import { formatTime } from '../utils/helpers';

const IconAdd = () => (
  <svg viewBox="0 0 16 16" width="12" height="12"><path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
);
const IconRemove = () => (
  <svg viewBox="0 0 16 16" width="12" height="12"><path d="M1 8h14" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
);
const IconClear = () => (
  <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
);
const IconVideo = () => (
  <svg viewBox="0 0 20 20" width="14" height="14"><rect x="2" y="4" width="12" height="12" rx="1" fill="currentColor" opacity="0.7" /><polygon points="16,7 20,5 20,15 16,13" fill="currentColor" opacity="0.7" /></svg>
);
const IconAudio = () => (
  <svg viewBox="0 0 20 20" width="14" height="14"><circle cx="7" cy="14" r="3" fill="currentColor" opacity="0.7" /><circle cx="15" cy="12" r="3" fill="currentColor" opacity="0.7" /><path d="M10 14V3l8-2v11" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
);
const IconShuffle = () => (
  <svg viewBox="0 0 20 20" width="14" height="14"><path d="M2 5h4l4 5-4 5H2m16-10h-4l-2 2.5m0 5l2 2.5h4m0-10v0m0 10v0" stroke="currentColor" strokeWidth="1.5" fill="none" /><polygon points="18,3 20,5 18,7" fill="currentColor" /><polygon points="18,13 20,15 18,17" fill="currentColor" /></svg>
);
const IconRepeatAll = () => (
  <svg viewBox="0 0 20 20" width="14" height="14"><path d="M4 7h12l-3-3m3 3v6a2 2 0 01-2 2H4l3 3m-3-3V7a2 2 0 012-2" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
);
const IconRepeatOne = () => (
  <svg viewBox="0 0 20 20" width="14" height="14"><path d="M4 7h12l-3-3m3 3v6a2 2 0 01-2 2H4l3 3m-3-3V7a2 2 0 012-2" stroke="currentColor" strokeWidth="1.5" fill="none" /><text x="10" y="13" textAnchor="middle" fontSize="7" fill="currentColor" fontWeight="bold">1</text></svg>
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
