import { useRef, useState, useCallback, useEffect } from 'react';

const THUMB_COUNT = 100;
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 90;
const SEEK_TIMEOUT_MS = 2500;

export default function useThumbnails() {
  const [thumbs, setThumbs] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const abortRef = useRef({ cancelled: false });
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const currentKeyRef = useRef(null);

  const reset = useCallback(() => {
    abortRef.current.cancelled = true;
    abortRef.current = { cancelled: false };
    setThumbs([]);
    setIsGenerating(false);
    setProgress(0);
    setDuration(0);
    currentKeyRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.removeAttribute('src');
      videoRef.current.load?.();
    }
  }, []);

  const generate = useCallback(async (src, key) => {
    if (!src) return;
    if (currentKeyRef.current === key) return;

    abortRef.current.cancelled = true;
    const token = { cancelled: false };
    abortRef.current = token;
    currentKeyRef.current = key;

    setThumbs([]);
    setProgress(0);
    setIsGenerating(true);

    if (!videoRef.current) {
      const v = document.createElement('video');
      v.muted = true;
      v.crossOrigin = 'anonymous';
      v.preload = 'auto';
      v.playsInline = true;
      videoRef.current = v;
    }
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = THUMB_WIDTH;
      canvasRef.current.height = THUMB_HEIGHT;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    try {
      video.src = src;
      await new Promise((resolve, reject) => {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onErr);
          resolve();
        };
        const onErr = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          video.removeEventListener('error', onErr);
          reject(new Error('load failed'));
        };
        video.addEventListener('loadedmetadata', onMeta);
        video.addEventListener('error', onErr);
      });
      if (token.cancelled) return;

      const dur = video.duration;
      if (!isFinite(dur) || dur <= 0) {
        throw new Error('invalid duration');
      }
      setDuration(dur);

      const count = Math.min(THUMB_COUNT, Math.max(10, Math.floor(dur / 5)));
      const interval = dur / count;
      const frames = new Array(count).fill(null);
      setThumbs(frames);

      for (let i = 0; i < count; i++) {
        if (token.cancelled) return;
        const t = Math.min(dur - 0.1, i * interval);

        try {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              reject(new Error('seek timeout'));
            }, SEEK_TIMEOUT_MS);
            const onSeeked = () => {
              clearTimeout(timer);
              video.removeEventListener('seeked', onSeeked);
              resolve();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = t;
          });
        } catch {
          continue;
        }
        if (token.cancelled) return;

        try {
          ctx.drawImage(video, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          frames[i] = { t, src: dataUrl };
          setThumbs([...frames]);
          setProgress((i + 1) / count);
        } catch {
          continue;
        }
      }
    } catch {
    } finally {
      if (!token.cancelled) {
        setIsGenerating(false);
      }
      try {
        video.removeAttribute('src');
        video.load?.();
      } catch {}
    }
  }, []);

  const getThumbAt = useCallback((time) => {
    if (!thumbs.length || !duration) return null;
    const valid = thumbs.filter(Boolean);
    if (!valid.length) return null;
    let best = valid[0];
    let bestDiff = Math.abs(best.t - time);
    for (let i = 1; i < valid.length; i++) {
      const d = Math.abs(valid[i].t - time);
      if (d < bestDiff) { best = valid[i]; bestDiff = d; }
    }
    return best.src;
  }, [thumbs, duration]);

  useEffect(() => () => {
    abortRef.current.cancelled = true;
    if (videoRef.current) {
      try { videoRef.current.removeAttribute('src'); videoRef.current.load?.(); } catch {}
    }
  }, []);

  return { thumbs, isGenerating, progress, generate, reset, getThumbAt };
}
