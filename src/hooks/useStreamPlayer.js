import { useCallback, useRef, useState } from 'react';

/**
 * useStreamPlayer — HLS and DASH adaptive streaming support.
 *
 * Lazy-loads hls.js and dash.js only when needed to keep initial bundle small.
 * Detects stream type from URL, attaches the library to the <video> element,
 * and exposes quality/track selection controls.
 */

export function detectStreamType(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('.m3u8') || u.includes('format=m3u8') || u.includes('hls')) return 'hls';
  if (u.includes('.mpd') || u.includes('format=mpd') || u.includes('dash')) return 'dash';
  return null;
}

export default function useStreamPlayer() {
  const hlsRef = useRef(null);
  const dashRef = useRef(null);
  const HlsClassRef = useRef(null);
  const [streamType, setStreamType] = useState(null);
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [audioTracks, setAudioTracks] = useState([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [streamInfo, setStreamInfo] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(null);

  const destroy = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (dashRef.current) {
      dashRef.current.reset();
      dashRef.current = null;
    }
    setStreamType(null);
    setQualities([]);
    setCurrentQuality(-1);
    setAudioTracks([]);
    setCurrentAudioTrack(0);
    setStreamInfo(null);
    setIsLive(false);
    setError(null);
  }, []);

  const attachHLS = useCallback(async (url, videoEl) => {
    destroy();

    // Lazy-load hls.js
    let Hls = HlsClassRef.current;
    if (!Hls) {
      try {
        const mod = await import('hls.js');
        Hls = mod.default;
        HlsClassRef.current = Hls;
      } catch (e) {
        setError('Failed to load HLS library');
        return false;
      }
    }

    if (!Hls.isSupported()) {
      // Safari has native HLS
      if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        videoEl.src = url;
        setStreamType('hls-native');
        return true;
      }
      setError('HLS is not supported in this browser');
      return false;
    }

    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startLevel: -1,
      capLevelToPlayerSize: true,
      enableWorker: true,
    });

    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      const levels = data.levels.map((level, i) => ({
        index: i,
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
        label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`,
      }));
      setQualities([{ index: -1, label: 'Auto' }, ...levels]);
      setStreamInfo({
        levels: levels.length,
        type: 'HLS',
        live: hls.levels?.[0]?.details?.live || false,
      });
      setIsLive(hls.levels?.[0]?.details?.live || false);
    });

    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
      setAudioTracks(data.audioTracks.map((t, i) => ({
        index: i,
        name: t.name || `Track ${i + 1}`,
        lang: t.lang || 'unknown',
      })));
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      setStreamInfo(prev => prev ? { ...prev, currentLevel: data.level } : prev);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setError('HLS network error — retrying...');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            setError('HLS media error — recovering...');
            hls.recoverMediaError();
            break;
          default:
            setError(`HLS fatal error: ${data.details}`);
            destroy();
        }
      }
    });

    hls.loadSource(url);
    hls.attachMedia(videoEl);
    hlsRef.current = hls;
    setStreamType('hls');
    return true;
  }, [destroy]);

  const attachDASH = useCallback(async (url, videoEl) => {
    destroy();

    try {
      // Lazy-load dashjs
      const dashjsMod = await import('dashjs');
      const dashjs = dashjsMod.default;

      const player = dashjs.MediaPlayer().create();
      player.updateSettings({
        streaming: {
          abr: { autoSwitchBitrate: { video: true, audio: true } },
          buffer: { bufferTimeAtTopQuality: 30 },
        },
      });

      player.on('streamInitialized', () => {
        const bitrateList = player.getBitrateInfoListFor('video') || [];
        const levels = bitrateList.map((b, i) => ({
          index: i,
          width: b.width,
          height: b.height,
          bitrate: b.bitrate,
          label: b.height ? `${b.height}p` : `${Math.round(b.bitrate / 1000)}kbps`,
        }));
        setQualities([{ index: -1, label: 'Auto' }, ...levels]);

        const audioList = player.getTracksFor('audio') || [];
        setAudioTracks(audioList.map((t, i) => ({
          index: i,
          name: t.lang || `Track ${i + 1}`,
          lang: t.lang || 'unknown',
        })));

        setStreamInfo({
          levels: levels.length,
          type: 'DASH',
          live: player.isDynamic(),
        });
        setIsLive(player.isDynamic());
      });

      player.on('error', (e) => {
        setError(`DASH error: ${e.error?.message || 'Unknown'}`);
      });

      player.initialize(videoEl, url, false);
      dashRef.current = player;
      setStreamType('dash');
      return true;
    } catch (e) {
      setError(`DASH init failed: ${e.message}`);
      return false;
    }
  }, [destroy]);

  const attachStream = useCallback((url, videoEl) => {
    const type = detectStreamType(url);
    if (type === 'hls') return attachHLS(url, videoEl);
    if (type === 'dash') return attachDASH(url, videoEl);
    return false;
  }, [attachHLS, attachDASH]);

  const setQuality = useCallback((index) => {
    setCurrentQuality(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    }
    if (dashRef.current) {
      if (index === -1) {
        dashRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
      } else {
        dashRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
        dashRef.current.setQualityFor('video', index);
      }
    }
  }, []);

  const setAudioTrack = useCallback((index) => {
    setCurrentAudioTrack(index);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = index;
    }
    if (dashRef.current) {
      const tracks = dashRef.current.getTracksFor('audio');
      if (tracks[index]) dashRef.current.setCurrentTrack(tracks[index]);
    }
  }, []);

  const captureStream = useCallback((videoEl) => {
    if (!videoEl) return null;
    try {
      const stream = videoEl.captureStream ? videoEl.captureStream() : videoEl.mozCaptureStream?.();
      return stream || null;
    } catch {
      return null;
    }
  }, []);

  return {
    streamType, qualities, currentQuality, audioTracks, currentAudioTrack,
    streamInfo, isLive, error,
    attachStream, attachHLS, attachDASH, destroy,
    setQuality, setAudioTrack, captureStream,
  };
}
