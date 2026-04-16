import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerContext } from '../hooks/PlayerContext';
import { formatTime, SPEEDS } from '../utils/helpers';

export default function Controls() {
  const { player, playlist } = usePlayerContext();
  const [speedOpen, setSpeedOpen] = useState(false);
  const seekDragging = useRef(false);
  const volDragging = useRef(false);
  const seekTrackRef = useRef(null);
  const volTrackRef = useRef(null);
  const speedRef = useRef(null);
  const [tooltipPos, setTooltipPos] = useState({ visible: false, x: 0, text: '' });

  // Close speed popup on outside click or Escape
  useEffect(() => {
    if (!speedOpen) return;
    const handleClick = (e) => {
      if (speedRef.current && !speedRef.current.contains(e.target)) setSpeedOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setSpeedOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [speedOpen]);

  const progress = player.duration ? player.currentTime / player.duration : 0;
  const progressPct = (progress * 100) + '%';
  const bufferedPct = (player.buffered * 100) + '%';
  const volumePct = (Math.min(player.volume, 1) * 100) + '%';

  // Seek bar handlers
  const getSeekPct = useCallback((e) => {
    const rect = seekTrackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleSeekDown = useCallback((e) => {
    seekDragging.current = true;
    const pct = getSeekPct(e);
    player.seekPercent(pct);
    const onMove = (e) => {
      if (!seekDragging.current) return;
      const p = getSeekPct(e);
      player.seekPercent(p);
    };
    const onUp = () => { seekDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [player, getSeekPct]);

  const handleSeekHover = useCallback((e) => {
    if (!player.duration) return;
    const rect = seekTrackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setTooltipPos({ visible: true, x: e.clientX - rect.left, text: formatTime(player.duration * pct) });
  }, [player.duration]);

  const handleSeekLeave = useCallback(() => { setTooltipPos(p => ({ ...p, visible: false })); }, []);

  // Volume handlers
  const getVolPct = useCallback((e) => {
    const rect = volTrackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handleVolDown = useCallback((e) => {
    volDragging.current = true;
    player.setVolume(getVolPct(e));
    const onMove = (e) => { if (volDragging.current) player.setVolume(getVolPct(e)); };
    const onUp = () => { volDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [player, getVolPct]);

  const handleVolWheel = useCallback((e) => {
    e.preventDefault();
    player.setVolume(player.volume + (e.deltaY > 0 ? -0.05 : 0.05));
  }, [player]);

  return (
    <div className="controls-area">
      {/* Seek Bar */}
      <div className="seek-bar-container" onMouseDown={handleSeekDown} onMouseMove={handleSeekHover} onMouseLeave={handleSeekLeave}>
        <div className="seek-bar-track" ref={seekTrackRef}>
          <div className="seek-bar-buffered" style={{ width: bufferedPct }} />
          <div className="seek-bar-progress" style={{ width: progressPct }} />
          <div className="seek-bar-thumb" style={{ left: progressPct, display: 'block' }} />
        </div>
        {tooltipPos.visible && (
          <div className="seek-tooltip" style={{ left: tooltipPos.x }}>{tooltipPos.text}</div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="control-buttons">
        <div className="control-left">
          <button className="ctrl-btn" onClick={() => player.togglePlay()} title="Play/Pause (Space)">
            {player.isPlaying ? (
              <svg viewBox="0 0 24 24" width="20" height="20"><rect x="5" y="4" width="5" height="16" fill="currentColor" /><rect x="14" y="4" width="5" height="16" fill="currentColor" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20"><polygon points="5,3 19,12 5,21" fill="currentColor" /></svg>
            )}
          </button>
          <button className="ctrl-btn" onClick={() => player.stop()} title="Stop (S)">
            <svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="4" width="16" height="16" fill="currentColor" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => playlist.playPrev()} title="Previous (P)">
            <svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="3" height="14" fill="currentColor" /><polygon points="20,5 8,12 20,19" fill="currentColor" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => playlist.playNext()} title="Next (N)">
            <svg viewBox="0 0 24 24" width="18" height="18"><polygon points="4,5 16,12 4,19" fill="currentColor" /><rect x="18" y="5" width="3" height="14" fill="currentColor" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => player.frameStep(1)} title="Next Frame (E)">
            <svg viewBox="0 0 24 24" width="18" height="18"><polygon points="4,4 14,12 4,20" fill="currentColor" /><rect x="16" y="4" width="3" height="16" fill="currentColor" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => document.dispatchEvent(new CustomEvent('kp-toggle-fullscreen'))} title="Fullscreen (F)">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 3h6v2H5v4H3V3zm12 0h6v6h-2V5h-4V3zM3 15h2v4h4v2H3v-6zm16 4h-4v2h6v-6h-2v4z" fill="currentColor" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => player.requestPiP()} title="Picture-in-Picture">
            <svg viewBox="0 0 24 24" width="18" height="18"><rect x="1" y="3" width="22" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="11" y="10" width="10" height="7" rx="1" fill="currentColor" /></svg>
          </button>
        </div>

        <div className="control-center">
          <span className="time-display">
            {formatTime(player.currentTime)} / {formatTime(player.duration)}
          </span>
        </div>

        <div className="control-right">
          {/* Speed */}
          <div className="speed-control" ref={speedRef}>
            <button className="ctrl-btn speed-btn" onClick={() => setSpeedOpen(o => !o)} title="Playback Speed">
              <span>{player.playbackRate.toFixed(2)}x</span>
            </button>
            {speedOpen && (
              <div className="speed-popup">
                {SPEEDS.map(s => (
                  <div key={s} className={`speed-option${s === player.playbackRate ? ' active' : ''}`}
                    onClick={() => { player.setSpeed(s); setSpeedOpen(false); }}>
                    {s.toFixed(2)}x
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* A-B Loop */}
          <button
            className={`ctrl-btn${player.abLoopState === 'a' ? ' a-set' : ''}${player.abLoopState === 'b' ? ' b-set' : ''}`}
            onClick={() => player.setABLoop()}
            title="A-B Loop"
            id="abLoopBtn"
          >
            <span className="ab-text">A→B</span>
          </button>

          {/* Display Mode / Aspect Ratio */}
          <button
            className="ctrl-btn aspect-btn"
            onClick={() => player.cycleAspectRatio()}
            title={`Display: ${player.aspectRatio}${player.zoom !== 1 ? ` (${Math.round(player.zoom * 100)}%)` : ''} — press A to cycle`}
          >
            {player.aspectRatio === 'fit' ? (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="1" y="1" width="22" height="22" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                <polygon points="6,6 12,3 18,6 18,18 12,21 6,18" fill="currentColor" opacity="0.3" />
              </svg>
            ) : player.aspectRatio === 'crop' ? (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="currentColor" opacity="0.3" />
                <path d="M6 2v4M2 6h4M18 22v-4M22 18h-4" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : player.aspectRatio === 'stretch' ? (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M7 12h10M12 7v10M7 12l2-2m-2 2l2 2M17 12l-2-2m2 2l-2 2M12 7l-2 2m2-2l2 2M12 17l-2-2m2 2l2-2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18">
                <rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                <rect x="5" y="7" width="14" height="10" rx="1" fill="currentColor" opacity="0.3" />
              </svg>
            )}
          </button>

          {/* Volume */}
          <button className={`ctrl-btn volume-btn${player.isMuted ? ' muted' : ''}`} onClick={() => player.toggleMute()} title="Mute (M)">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
              {!player.isMuted && player.volume > 0 && (
                <>
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="currentColor" />
                  <path d="M19 12c0 2.97-1.65 5.54-4 6.71V5.29c2.35 1.17 4 3.74 4 6.71z" fill="currentColor" opacity="0.7" />
                </>
              )}
            </svg>
          </button>
          <div className="volume-slider-container" onWheel={handleVolWheel}>
            <div className="volume-slider-track" ref={volTrackRef} onMouseDown={handleVolDown}>
              <div className="volume-slider-fill" style={{ width: volumePct }} />
              <div className="volume-slider-thumb" style={{ left: volumePct }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
