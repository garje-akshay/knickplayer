import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerContext } from '../hooks/PlayerContext';
import { formatTime, SPEEDS } from '../utils/helpers';

export default function Controls() {
  const { player, playlist, thumbnails } = usePlayerContext();
  const [speedOpen, setSpeedOpen] = useState(false);
  const seekDragging = useRef(false);
  const volDragging = useRef(false);
  const seekTrackRef = useRef(null);
  const volTrackRef = useRef(null);
  const speedRef = useRef(null);
  const [tooltipPos, setTooltipPos] = useState({ visible: false, x: 0, text: '', time: 0 });

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

  // Seek bar handlers — Pointer Events (unifies mouse + touch + pen)
  const getSeekPct = useCallback((clientX) => {
    const rect = seekTrackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleSeekPointerDown = useCallback((e) => {
    if (!player.duration) return;
    e.preventDefault();
    const target = e.currentTarget;
    try { target.setPointerCapture(e.pointerId); } catch {}
    seekDragging.current = true;
    const pct = getSeekPct(e.clientX);
    player.seekPercent(pct);
    const rect = seekTrackRef.current.getBoundingClientRect();
    const t = player.duration * pct;
    setTooltipPos({ visible: true, x: e.clientX - rect.left, text: formatTime(t), time: t });
  }, [player, getSeekPct]);

  const handleSeekPointerMove = useCallback((e) => {
    if (!player.duration) return;
    const rect = seekTrackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = player.duration * pct;
    setTooltipPos({ visible: true, x: e.clientX - rect.left, text: formatTime(t), time: t });
    if (seekDragging.current) {
      player.seekPercent(pct);
    }
  }, [player]);

  const handleSeekPointerUp = useCallback((e) => {
    if (seekDragging.current) {
      seekDragging.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
    // Hide tooltip on touch/pen release; keep for mouse hover
    if (e.pointerType !== 'mouse') {
      setTooltipPos(p => ({ ...p, visible: false }));
    }
  }, []);

  const handleSeekPointerLeave = useCallback((e) => {
    if (!seekDragging.current && e.pointerType === 'mouse') {
      setTooltipPos(p => ({ ...p, visible: false }));
    }
  }, []);

  const hoverThumb = tooltipPos.visible && thumbnails ? thumbnails.getThumbAt?.(tooltipPos.time) : null;
  const thumbsLoading = thumbnails?.isGenerating;
  const thumbsProgress = thumbnails?.progress || 0;

  // Volume handlers — Pointer Events
  const getVolPct = useCallback((clientX) => {
    const rect = volTrackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleVolPointerDown = useCallback((e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    volDragging.current = true;
    player.setVolume(getVolPct(e.clientX));
  }, [player, getVolPct]);

  const handleVolPointerMove = useCallback((e) => {
    if (volDragging.current) player.setVolume(getVolPct(e.clientX));
  }, [player, getVolPct]);

  const handleVolPointerUp = useCallback((e) => {
    if (volDragging.current) {
      volDragging.current = false;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  }, []);

  const handleVolWheel = useCallback((e) => {
    e.preventDefault();
    player.setVolume(player.volume + (e.deltaY > 0 ? -0.05 : 0.05));
  }, [player]);

  // Shared icon props — unified modern stroke style (Lucide/Feather-inspired)
  const iconProps = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  return (
    <div className="controls-area">
      {/* Seek Bar */}
      <div
        className="seek-bar-container"
        onPointerDown={handleSeekPointerDown}
        onPointerMove={handleSeekPointerMove}
        onPointerUp={handleSeekPointerUp}
        onPointerCancel={handleSeekPointerUp}
        onPointerLeave={handleSeekPointerLeave}
      >
        <div className="seek-bar-track" ref={seekTrackRef}>
          <div className="seek-bar-buffered" style={{ width: bufferedPct }} />
          <div className="seek-bar-progress" style={{ width: progressPct }} />
          <div className="seek-bar-thumb" style={{ left: progressPct, display: 'block' }} />
        </div>
        {tooltipPos.visible && (
          <div className={`seek-tooltip${hoverThumb ? ' with-thumb' : ''}`} style={{ left: tooltipPos.x }}>
            {hoverThumb ? (
              <img className="seek-thumb-img" src={hoverThumb} alt="" />
            ) : thumbsLoading ? (
              <div className="seek-thumb-loading">
                <div className="seek-thumb-spinner" />
                <div className="seek-thumb-loading-text">{Math.round(thumbsProgress * 100)}%</div>
              </div>
            ) : null}
            <div className="seek-tooltip-time">{tooltipPos.text}</div>
          </div>
        )}
        {thumbsLoading && (
          <div className="seek-thumbs-indicator" title={`Generating thumbnails — ${Math.round(thumbsProgress * 100)}%`}>
            <div className="seek-thumbs-indicator-bar" style={{ width: `${thumbsProgress * 100}%` }} />
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="control-buttons">
        <div className="control-left">
          <button className="ctrl-btn play-btn" onClick={() => player.togglePlay()} title="Play/Pause (Space)" aria-label={player.isPlaying ? 'Pause' : 'Play'}>
            {player.isPlaying ? (
              <svg {...iconProps}><line x1="9" y1="5" x2="9" y2="19" /><line x1="15" y1="5" x2="15" y2="19" /></svg>
            ) : (
              <svg {...iconProps}><polygon points="7 4 20 12 7 20 7 4" fill="currentColor" /></svg>
            )}
          </button>
          <button className="ctrl-btn" onClick={() => player.stop()} title="Stop (S)" aria-label="Stop">
            <svg {...iconProps}><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => playlist.playPrev()} title="Previous (P)" aria-label="Previous">
            <svg {...iconProps}><polygon points="19 5 8 12 19 19 19 5" fill="currentColor" /><line x1="5" y1="5" x2="5" y2="19" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => playlist.playNext()} title="Next (N)" aria-label="Next">
            <svg {...iconProps}><polygon points="5 5 16 12 5 19 5 5" fill="currentColor" /><line x1="19" y1="5" x2="19" y2="19" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => player.frameStep(1)} title="Next Frame (E)" aria-label="Next frame">
            <svg {...iconProps}><polygon points="5 5 14 12 5 19 5 5" fill="currentColor" /><line x1="17" y1="5" x2="17" y2="19" /><line x1="20" y1="5" x2="20" y2="19" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => document.dispatchEvent(new CustomEvent('kp-toggle-fullscreen'))} title="Fullscreen (F)" aria-label="Toggle fullscreen">
            <svg {...iconProps}><path d="M4 9V5a1 1 0 0 1 1-1h4" /><path d="M20 9V5a1 1 0 0 0-1-1h-4" /><path d="M4 15v4a1 1 0 0 0 1 1h4" /><path d="M20 15v4a1 1 0 0 1-1 1h-4" /></svg>
          </button>
          <button className="ctrl-btn" onClick={() => player.requestPiP()} title="Picture-in-Picture" aria-label="Picture in picture">
            <svg {...iconProps}><rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" stroke="none" /></svg>
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
            aria-label="Cycle aspect ratio"
          >
            {player.aspectRatio === 'fit' ? (
              <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6v6H9z" /></svg>
            ) : player.aspectRatio === 'crop' ? (
              <svg {...iconProps}><path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" /></svg>
            ) : player.aspectRatio === 'stretch' ? (
              <svg {...iconProps}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 12h10" /><path d="m9 10-2 2 2 2" /><path d="m15 10 2 2-2 2" /></svg>
            ) : (
              <svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="2" /></svg>
            )}
          </button>

          {/* Volume */}
          <button className={`ctrl-btn volume-btn${player.isMuted ? ' muted' : ''}`} onClick={() => player.toggleMute()} title="Mute (M)" aria-label={player.isMuted ? 'Unmute' : 'Mute'}>
            <svg {...iconProps}>
              {player.isMuted || player.volume === 0 ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="currentColor" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : player.volume < 0.33 ? (
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="currentColor" />
              ) : player.volume < 0.66 ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="currentColor" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="currentColor" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
          </button>
          <div className="volume-slider-container" onWheel={handleVolWheel}>
            <div
              className="volume-slider-track"
              ref={volTrackRef}
              onPointerDown={handleVolPointerDown}
              onPointerMove={handleVolPointerMove}
              onPointerUp={handleVolPointerUp}
              onPointerCancel={handleVolPointerUp}
            >
              <div className="volume-slider-fill" style={{ width: volumePct }} />
              <div className="volume-slider-thumb" style={{ left: volumePct }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
