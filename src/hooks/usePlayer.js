import { useRef, useState, useCallback, useEffect } from 'react';
import { detectMediaType, getFilenameFromUrl, EQ_FREQUENCIES } from '../utils/helpers';
import { detectStreamType } from './useStreamPlayer';

export default function usePlayer() {
  const videoRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const gainRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const sourceRef = useRef(null);
  const audioReady = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isStopped, setIsStopped] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [mediaInfo, setMediaInfo] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Stream player hook reference — set by App.jsx to enable HLS/DASH
  const streamAttachRef = useRef(null);

  const abLoopRef = useRef({ a: null, b: null });
  const [abLoopState, setAbLoopState] = useState('none');

  // --- Display mode system ---
  // Modes:
  //   'default'  — letterbox: video at native ratio, black bars
  //   'fit'      — fill container width OR height, keep ratio, no black bars on one axis
  //   '16:9'     — force 16:9 (crops excess)
  //   '4:3'      — force 4:3
  //   '1:1'      — force square
  //   '16:10'    — force 16:10
  //   '2.35:1'   — force cinemascope
  //   '2.39:1'   — force anamorphic
  //   '5:4'      — force 5:4
  //   'stretch'  — fill entire area, distort if needed
  //   'crop'     — zoom to fill, crop overflow (no black bars, no distortion)
  const [aspectRatio, setAspectRatioState] = useState('default');
  const ASPECT_RATIOS = ['default', 'fit', '16:9', '4:3', '1:1', '16:10', '2.35:1', '2.39:1', '5:4', 'stretch', 'crop'];

  // Zoom: 1 = 100%, 0.5 = 50%, 2 = 200%
  const [zoom, setZoomState] = useState(1);
  // Pan offset (px) for when zoomed > 1
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const cycleAspectRatio = useCallback(() => {
    setAspectRatioState(prev => {
      const idx = ASPECT_RATIOS.indexOf(prev);
      return ASPECT_RATIOS[(idx + 1) % ASPECT_RATIOS.length];
    });
    // Reset zoom/pan when cycling
    setZoomState(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const setAspectRatio = useCallback((ratio) => {
    setAspectRatioState(ratio);
    setZoomState(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const setZoom = useCallback((z) => {
    const clamped = Math.max(0.25, Math.min(4, z));
    setZoomState(clamped);
    // Reset pan if zooming back to 1 or below
    if (clamped <= 1) setPanOffset({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoomState(prev => Math.min(4, +(prev + 0.25).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomState(prev => {
      const next = Math.max(0.25, +(prev - 0.25).toFixed(2));
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomState(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const [videoFilters, setVideoFilters] = useState({
    brightness: 100, contrast: 100, saturation: 100, hue: 0,
    gamma: 100, rotation: 0, flipH: false, flipV: false,
  });

  const ensureAudioContext = useCallback(() => {
    if (audioReady.current || !videoRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const gain = ctx.createGain();
      gainRef.current = gain;

      const filters = EQ_FREQUENCIES.map((freq, i) => {
        const f = ctx.createBiquadFilter();
        f.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
        f.frequency.value = freq;
        f.gain.value = 0;
        f.Q.value = 1;
        return f;
      });
      eqFiltersRef.current = filters;

      const src = ctx.createMediaElementSource(videoRef.current);
      sourceRef.current = src;
      let chain = src;
      filters.forEach(f => { chain.connect(f); chain = f; });
      chain.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      audioReady.current = true;
    } catch (e) { console.warn('AudioContext init failed:', e); }
  }, []);

  const prevUrlRef = useRef(null);

  const revokeOldUrl = useCallback(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
  }, []);

  const loadFile = useCallback((file) => {
    return new Promise((resolve) => {
      const v = videoRef.current;
      if (!v) { resolve(); return; }
      const type = detectMediaType(file.name, file.type);
      setMediaType(type);
      setError(null);
      setIsLoading(true);
      revokeOldUrl();
      const url = URL.createObjectURL(file);
      prevUrlRef.current = url;

      const cleanup = () => {
        clearTimeout(tid);
        v.removeEventListener('canplay', onReady);
        v.removeEventListener('error', onErr);
      };

      const onReady = () => {
        cleanup();
        setIsLoading(false);
        // For video files: verify the browser actually decoded video frames,
        // not just the audio track. videoWidth === 0 means no video decoded.
        if (type === 'video' && v.videoWidth === 0) {
          resolve(null); // Audio-only decode — video codec unsupported
          return;
        }
        resolve(type);
      };
      const onErr = () => {
        cleanup();
        setIsLoading(false);
        resolve(null);
      };

      // Timeout: if browser can't reach canplay in 8s, treat as failure
      const tid = setTimeout(() => {
        cleanup();
        setIsLoading(false);
        resolve(null);
      }, 8000);

      v.addEventListener('canplay', onReady);
      v.addEventListener('error', onErr);
      v.src = url;
      v.load();
      setMediaInfo({ name: file.name, type, size: file.size, mimeType: file.type });
      setIsStopped(false);
    });
  }, [revokeOldUrl]);

  const loadUrl = useCallback(async (url) => {
    const v = videoRef.current;
    if (!v) return;
    setMediaType('video');
    setError(null);
    setIsLoading(true);

    const sType = detectStreamType(url);

    // Try HLS/DASH via stream player hook (async — lazy loads library)
    if (sType && streamAttachRef.current) {
      try {
        const attached = await streamAttachRef.current(url, v);
        if (attached) {
          await new Promise((resolve) => {
            const timeout = setTimeout(() => { v.removeEventListener('canplay', onReady); setIsLoading(false); resolve(); }, 15000);
            const onReady = () => { clearTimeout(timeout); v.removeEventListener('canplay', onReady); setIsLoading(false); resolve(); };
            v.addEventListener('canplay', onReady);
          });
          setMediaInfo({ name: getFilenameFromUrl(url), type: 'video', size: 0, mimeType: `application/${sType}` });
          setIsStopped(false);
          return 'video';
        }
      } catch (e) {
        console.warn('Stream attach failed, falling back to direct playback:', e);
        // Fall through to direct playback
      }
    }

    // Direct URL playback
    revokeOldUrl();
    return new Promise((resolve) => {
      const onReady = () => {
        v.removeEventListener('canplay', onReady);
        v.removeEventListener('error', onErr);
        setIsLoading(false);
        resolve('video');
      };
      const onErr = () => {
        v.removeEventListener('canplay', onReady);
        v.removeEventListener('error', onErr);
        setIsLoading(false);
        resolve(null);
      };
      v.addEventListener('canplay', onReady);
      v.addEventListener('error', onErr);
      v.src = url;
      v.load();
      setMediaInfo({ name: getFilenameFromUrl(url), type: 'video', size: 0, mimeType: '' });
      setIsStopped(false);
    });
  }, []);

  const play = useCallback(() => {
    ensureAudioContext();
    if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
    videoRef.current?.play().catch(() => {});
  }, [ensureAudioContext]);

  const pause = useCallback(() => { videoRef.current?.pause(); }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused || v.ended) play(); else pause();
  }, [play, pause]);

  const stop = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setIsPlaying(false);
    setIsStopped(true);
    setCurrentTime(0);
  }, []);

  const seek = useCallback((time) => {
    const v = videoRef.current;
    if (v && isFinite(time) && time >= 0) v.currentTime = Math.min(time, v.duration || 0);
  }, []);

  const seekPercent = useCallback((pct) => {
    if (videoRef.current?.duration) seek(videoRef.current.duration * pct);
  }, [seek]);

  const seekRelative = useCallback((sec) => {
    if (videoRef.current) seek(videoRef.current.currentTime + sec);
  }, [seek]);

  const setVolume = useCallback((vol) => {
    const v = Math.max(0, Math.min(2, vol));
    setVolumeState(v);
    const el = videoRef.current;
    if (!el) return;
    if (v > 1 && gainRef.current) { el.volume = 1; gainRef.current.gain.value = v; }
    else { el.volume = v; if (gainRef.current) gainRef.current.gain.value = 1; }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(m => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  const setSpeed = useCallback((rate) => {
    setPlaybackRateState(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, []);

  const setABLoop = useCallback(() => {
    const loop = abLoopRef.current;
    const t = videoRef.current?.currentTime || 0;
    if (loop.a === null) { loop.a = t; setAbLoopState('a'); }
    else if (loop.b === null) { loop.b = t; setAbLoopState('b'); }
    else { loop.a = null; loop.b = null; setAbLoopState('none'); }
  }, []);

  const frameStep = useCallback((direction = 1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    // Assume ~30fps if we can't detect; step ±1 frame
    const fps = 30;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + (direction / fps)));
  }, []);

  const requestPiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch (e) { console.warn('PiP failed:', e); }
  }, []);

  const takeSnapshot = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    c.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `knickplayer-snapshot-${Date.now()}.png`;
      a.click();
    }, 'image/png');
  }, []);

  const setEQBand = useCallback((index, gain) => {
    if (eqFiltersRef.current[index]) eqFiltersRef.current[index].gain.value = gain;
  }, []);

  const setEQPreamp = useCallback((gain) => {
    if (gainRef.current) gainRef.current.gain.value = Math.pow(10, gain / 20) * volume;
  }, [volume]);

  const getAnalyserData = useCallback(() => {
    if (!analyserRef.current) return null;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, []);

  const getWaveformData = useCallback(() => {
    if (!analyserRef.current) return null;
    const data = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(data);
    return data;
  }, []);

  // Apply CSS filters to video element
  // NOTE: Only CSS filter is applied here. The transform property (zoom, pan, rotation, flip)
  // is managed by VideoArea's computeVideoStyle() to avoid conflicts.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const f = videoFilters;
    const filters = [];
    if (f.brightness !== 100) filters.push(`brightness(${f.brightness}%)`);
    if (f.contrast !== 100) filters.push(`contrast(${f.contrast}%)`);
    if (f.saturation !== 100) filters.push(`saturate(${f.saturation}%)`);
    if (f.hue !== 0) filters.push(`hue-rotate(${f.hue}deg)`);
    v.style.filter = filters.join(' ') || 'none';
  }, [videoFilters]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => revokeOldUrl();
  }, [revokeOldUrl]);

  // Video event listeners
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => { setIsPlaying(true); setIsStopped(false); };
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      const loop = abLoopRef.current;
      if (loop.a !== null && loop.b !== null && v.currentTime >= loop.b) v.currentTime = loop.a;
    };
    const onLoadedMeta = () => {
      setDuration(v.duration);
      setVideoSize({ w: v.videoWidth, h: v.videoHeight });
    };
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1) / (v.duration || 1));
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      const msgs = { 1: 'Aborted', 2: 'Network error', 3: 'Decode error', 4: 'Format not supported' };
      setError(msgs[v.error?.code] || 'Unknown error');
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('progress', onProgress);
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('progress', onProgress);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', onError);
    };
  }, []);

  return {
    videoRef, streamAttachRef, isPlaying, isStopped, isMuted, isLoading, volume, currentTime, duration,
    buffered, playbackRate, mediaInfo, mediaType, videoSize, error,
    abLoopState, videoFilters, setVideoFilters, aspectRatio, zoom, panOffset, setPanOffset,
    loadFile, loadUrl, play, pause, togglePlay, stop, seek, seekPercent,
    seekRelative, setVolume, toggleMute, setSpeed, setABLoop, takeSnapshot,
    frameStep, requestPiP,
    setEQBand, setEQPreamp, getAnalyserData, getWaveformData, ensureAudioContext,
    cycleAspectRatio, setAspectRatio, setZoom, zoomIn, zoomOut, resetZoom,
  };
}
