import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayerContext } from '../hooks/PlayerContext';
import AppLogo from './VLCCone';
import { VISUALIZATIONS } from '../utils/visualizations';

/**
 * VideoArea — The main video display area.
 *
 * Display modes:
 *   default  — letterbox: video at native ratio centered, black bars on sides/top
 *   fit      — fill the container on ONE axis (no black bars on that axis), maintain ratio
 *   16:9 etc — force the video into that aspect ratio (crops excess parts)
 *   stretch  — fill entire area, distort if needed
 *   crop     — zoom to fill entire area, crop overflow (no bars, no distortion)
 *
 * Also supports:
 *   - Zoom (0.25x–4x) via scroll wheel (Ctrl+scroll) or keyboard
 *   - Pan (drag when zoomed in)
 */

function getAspectNumber(ratio) {
  if (!ratio || ratio === 'default' || ratio === 'fit' || ratio === 'stretch' || ratio === 'crop') return null;
  const parts = ratio.split(':');
  if (parts.length === 2) return parseFloat(parts[0]) / parseFloat(parts[1]);
  return null;
}

export default function VideoArea({ onFilesDropped }) {
  const { player, ffmpeg, transcodingFile } = usePlayerContext();
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const containerRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const showVideo = player.mediaInfo && !player.isStopped;
  const isAudioOnly = player.mediaType === 'audio' && showVideo;

  // --- Drag & drop ---
  const handleDragOver = useCallback((e) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragEnter = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesDropped(files);
  }, [onFilesDropped]);

  // --- Click to play/pause, dblclick fullscreen ---
  const handleClick = useCallback(() => {
    if (!player.isStopped && player.mediaInfo) {
      player.togglePlay();
    }
  }, [player]);

  const handleDblClick = useCallback(() => {
    document.dispatchEvent(new CustomEvent('kp-toggle-fullscreen'));
  }, []);

  // --- Zoom with Ctrl+Scroll ---
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) player.zoomIn();
      else player.zoomOut();
    }
  }, [player]);

  // --- Pan with mouse drag when zoomed ---
  const handleMouseDown = useCallback((e) => {
    if (player.zoom > 1 && e.button === 0) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX, y: e.clientY,
        ox: player.panOffset.x, oy: player.panOffset.y,
      };
    }
  }, [player.zoom, player.panOffset]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      player.setPanOffset({
        x: panStartRef.current.ox + dx,
        y: panStartRef.current.oy + dy,
      });
    };
    const handleMouseUp = () => { isPanningRef.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [player]);

  // --- Compute video styles based on display mode ---
  const computeVideoStyle = () => {
    const mode = player.aspectRatio;
    const z = player.zoom;
    const pan = player.panOffset;

    const base = {};
    const f = player.videoFilters;

    // Transform: zoom + pan + rotation + flip
    const transforms = [];
    if (z !== 1) transforms.push(`scale(${z})`);
    if (pan.x !== 0 || pan.y !== 0) transforms.push(`translate(${pan.x}px, ${pan.y}px)`);
    if (f.rotation !== 0) transforms.push(`rotate(${f.rotation}deg)`);
    if (f.flipH) transforms.push('scaleX(-1)');
    if (f.flipV) transforms.push('scaleY(-1)');
    if (transforms.length > 0) base.transform = transforms.join(' ');

    // Cursor for pan mode
    if (z > 1) base.cursor = isPanningRef.current ? 'grabbing' : 'grab';

    switch (mode) {
      case 'default':
        // Letterbox — video at native ratio, black bars
        base.width = '100%';
        base.height = '100%';
        base.objectFit = 'contain';
        break;

      case 'fit':
        // Fill container — scale to cover one full axis, maintain ratio
        // The video will touch all edges on at least one axis
        base.width = '100%';
        base.height = '100%';
        base.objectFit = 'cover';
        break;

      case 'stretch':
        // Fill everything — distort to fit
        base.width = '100%';
        base.height = '100%';
        base.objectFit = 'fill';
        break;

      case 'crop':
        // Like 'fit' but guarantees no black bars — cover + overflow hidden on container
        base.width = '100%';
        base.height = '100%';
        base.objectFit = 'cover';
        break;

      default: {
        // Forced ratio modes: 16:9, 4:3, 1:1, etc.
        // We compute width/height to force the video into this ratio
        // while filling the container as much as possible
        const targetRatio = getAspectNumber(mode);
        if (targetRatio) {
          // Use object-fit: fill inside a container that we force to the target ratio
          // This way the video gets "squeezed" into the target ratio box
          base.width = '100%';
          base.height = '100%';
          base.objectFit = 'fill';
        } else {
          base.width = '100%';
          base.height = '100%';
          base.objectFit = 'contain';
        }
        break;
      }
    }

    return base;
  };

  // --- Compute wrapper styles for forced aspect ratios ---
  const computeWrapperStyle = () => {
    const mode = player.aspectRatio;
    const targetRatio = getAspectNumber(mode);

    if (!targetRatio) {
      // No forced ratio — wrapper fills the entire video area
      return { width: '100%', height: '100%' };
    }

    // For forced ratios, we create a box with the exact target ratio
    // that fills the container as much as possible (like a letterbox for the ratio box itself)
    // We need to compute this relative to the container
    return {
      position: 'relative',
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      aspectRatio: `${targetRatio}`,
      margin: 'auto',
    };
  };

  const [vizIndex, setVizIndex] = useState(0);
  const [vizMenuOpen, setVizMenuOpen] = useState(false);

  // --- Audio visualizer ---
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    if (!isAudioOnly || !canvasRef.current) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }
    playerRef.current.ensureAudioContext();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const viz = VISUALIZATIONS[vizIndex];

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const freqData = playerRef.current.getAnalyserData();
      if (!freqData) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const waveData = playerRef.current.getWaveformData();
      viz.draw(ctx, canvas, freqData, waveData, Date.now());
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isAudioOnly, vizIndex]);

  const cycleViz = useCallback((dir = 1) => {
    setVizIndex(i => (i + dir + VISUALIZATIONS.length) % VISUALIZATIONS.length);
  }, []);

  const videoStyle = computeVideoStyle();
  const wrapperStyle = computeWrapperStyle();

  return (
    <div
      ref={containerRef}
      className={`video-area${player.zoom > 1 ? ' zoomed' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={!isPanningRef.current ? handleClick : undefined}
      onDoubleClick={handleDblClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
    >
      {/* Video container — handles forced aspect ratios */}
      <div className={`video-wrapper${showVideo ? ' active' : ''}`} style={wrapperStyle}>
        <video
          ref={player.videoRef}
          preload="auto"
          className={showVideo ? 'active' : ''}
          style={videoStyle}
        />
      </div>

      {/* Zoom indicator */}
      {player.zoom !== 1 && showVideo && (
        <div className="zoom-indicator">
          {Math.round(player.zoom * 100)}%
        </div>
      )}

      {/* Display mode indicator (flashes briefly on change) */}

      {isAudioOnly && <canvas ref={canvasRef} className="audio-visualizer active" />}
      {isAudioOnly && (
        <div className="viz-controls">
          <button className="viz-nav-btn" onClick={() => cycleViz(-1)} title="Previous visualization">
            <svg viewBox="0 0 16 16" width="14" height="14"><polygon points="10,3 4,8 10,13" fill="currentColor" /></svg>
          </button>
          <button className="viz-name-btn" onClick={() => setVizMenuOpen(v => !v)} title="Choose visualization">
            {VISUALIZATIONS[vizIndex].name}
          </button>
          <button className="viz-nav-btn" onClick={() => cycleViz(1)} title="Next visualization">
            <svg viewBox="0 0 16 16" width="14" height="14"><polygon points="6,3 12,8 6,13" fill="currentColor" /></svg>
          </button>
          {vizMenuOpen && (
            <div className="viz-menu">
              {VISUALIZATIONS.map((v, i) => (
                <div
                  key={v.id}
                  className={`viz-menu-item${i === vizIndex ? ' active' : ''}`}
                  onClick={() => { setVizIndex(i); setVizMenuOpen(false); }}
                >
                  {v.name}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {player.isLoading && (
        <div className="loading-overlay">
          <div className="kp-loader">
            <svg className="kp-loader-icon" viewBox="0 0 100 100" width="60" height="60">
              <defs>
                <linearGradient id="loaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#6C5CE7' }} />
                  <stop offset="100%" style={{ stopColor: '#00CEFF' }} />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="40" fill="url(#loaderGrad)" opacity="0.2" />
              <polygon points="40,28 40,72 75,50" fill="url(#loaderGrad)" />
            </svg>
            <div className="kp-loader-ring"></div>
          </div>
          <div className="loading-text">Loading media...</div>
        </div>
      )}
      {!showVideo && !player.isLoading && (
        <div className="video-placeholder">
          <AppLogo size={120} />
        </div>
      )}
      {dragging && (
        <div className="drag-overlay">
          <div className="drag-text">Drop media files here</div>
        </div>
      )}

      {/* Transcoding progress overlay */}
      {transcodingFile && (
        <div className="transcode-overlay">
          <div className="transcode-overlay-card">
            <div className="transcode-overlay-icon">
              <svg viewBox="0 0 24 24" width="32" height="32">
                <defs>
                  <linearGradient id="tcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6C5CE7" />
                    <stop offset="100%" stopColor="#00CEFF" />
                  </linearGradient>
                </defs>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"
                  fill="url(#tcGrad)" />
              </svg>
              <div className="transcode-overlay-spinner" />
            </div>

            <div className="transcode-overlay-info">
              <div className="transcode-overlay-title">
                {ffmpeg.isLoading ? 'Loading FFmpeg engine...' : 'Transcoding for playback'}
              </div>
              <div className="transcode-overlay-filename">{transcodingFile}</div>

              <div className="transcode-overlay-progress-track">
                <div
                  className="transcode-overlay-progress-fill"
                  style={{ width: `${Math.round(ffmpeg.progress * 100)}%` }}
                />
              </div>

              <div className="transcode-overlay-meta">
                <span className="transcode-overlay-percent">
                  {ffmpeg.isLoading ? 'Downloading WASM...' : `${Math.round(ffmpeg.progress * 100)}%`}
                </span>
                {!ffmpeg.isLoading && ffmpeg.logs.length > 0 && (
                  <span className="transcode-overlay-stage">
                    {ffmpeg.logs[ffmpeg.logs.length - 1]?.substring(0, 60)}
                  </span>
                )}
              </div>
            </div>

            <button
              className="transcode-overlay-cancel"
              onClick={(e) => { e.stopPropagation(); ffmpeg.cancel(); }}
              title="Cancel"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
