import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useFFmpeg — manages the FFmpeg.wasm worker for transcoding and codec fallback.
 *
 * Performance features:
 *   - Multi-threaded WASM core (uses all CPU cores via SharedArrayBuffer)
 *   - Stream-copy remux when possible (near-instant, no re-encoding)
 *   - Ultrafast presets with 720p cap for playback transcoding
 *   - Lazy-loads FFmpeg WASM binary on first use
 *   - Transfers ArrayBuffer to worker (zero-copy via Transferable)
 *   - Pre-load support to warm the WASM cache in idle time
 */

// Formats the browser can definitely play natively (HTML5 <video>/<audio>)
const NATIVE_VIDEO = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'mp4v'];
const NATIVE_AUDIO = ['mp3', 'wav', 'ogg', 'oga', 'mp4', 'm4a', 'webm', 'flac', 'opus', 'aac', 'm4b'];

// Formats that MIGHT work in some browsers but are unreliable
const MAYBE_NATIVE = ['3gp', '3g2', 'ts', 'mpg', 'mpeg'];

// Formats that definitely need FFmpeg transcoding
const NEEDS_TRANSCODE = [
  // Video containers
  'asf', 'wmv', 'avi', 'mkv', 'flv', 'rm', 'rmvb', 'vob', 'divx', 'xvid',
  'f4v', 'f4p', 'dv', 'gxf', 'mxf', 'nsv', 'roq', 'nuv', 'bik', 'smk',
  'mts', 'm2ts', 'm2t', 'ogm', 'ogx', 'mpv', 'mp2v', 'm2v', 'm1v',
  'flc', 'fli', 'rec', 'wtv', 'dvr-ms', 'vp6',
  // Raw video
  'h264', 'h265', 'hevc', 'av1', 'vp8', 'vp9', 'y4m', 'yuv', 'ivf',
  // Audio
  'wma', 'ac3', 'dts', 'aiff', 'aif', 'ape', 'mka', 'wv', 'tta', 'tak',
  'shn', 'ra', 'ram', 'mid', 'midi', 'mod', 's3m', 'xm', 'it', 'amr',
  'awb', 'caf', 'au', 'snd', 'spx', 'dsf', 'dff', 'alac', 'mp2', 'mp1',
  'mpc', 'aa', 'aax', 'pcm', 'gsm', 'adts', 'w64', 'rf64',
  // Rare / legacy
  'swf', 'nut', 'matroska', 'mj2', 'dpx', 'cin', 'cdg', 'ifo',
];

export function isNativelyPlayable(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return NATIVE_VIDEO.includes(ext) || NATIVE_AUDIO.includes(ext);
}

export function needsTranscode(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return NEEDS_TRANSCODE.includes(ext) || MAYBE_NATIVE.includes(ext);
}

// Transcoding presets — optimized for speed
export const TRANSCODE_PRESETS = {
  'webm-vp9': {
    label: 'WebM (VP9 + Opus)',
    ext: 'webm',
    args: ['-c:v', 'libvpx-vp9', '-quality', 'realtime', '-cpu-used', '8',
           '-crf', '30', '-b:v', '0', '-row-mt', '1',
           '-c:a', 'libopus', '-b:a', '128k'],
  },
  'mp4-h264': {
    label: 'MP4 (H.264 + AAC)',
    ext: 'mp4',
    args: ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'fastdecode',
           '-crf', '28', '-pix_fmt', 'yuv420p', '-bf', '0', '-refs', '1',
           '-movflags', '+faststart',
           '-c:a', 'aac', '-b:a', '128k'],
  },
  'mp4-fast': {
    label: 'MP4 (Fast / Lower Quality)',
    ext: 'mp4',
    args: ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'fastdecode',
           '-crf', '35', '-pix_fmt', 'yuv420p', '-bf', '0', '-refs', '1',
           '-vf', 'scale=-2:min(ih\\,720)', '-g', '60',
           '-movflags', '+faststart',
           '-c:a', 'aac', '-b:a', '96k', '-ac', '2'],
  },
  'remux-mp4': {
    label: 'Remux to MP4 (No re-encode)',
    ext: 'mp4',
    args: ['-c:v', 'copy', '-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4'],
  },
  'mp3': {
    label: 'MP3 (Audio Only)',
    ext: 'mp3',
    args: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'],
  },
  'wav': {
    label: 'WAV (Lossless Audio)',
    ext: 'wav',
    args: ['-vn', '-c:a', 'pcm_s16le'],
  },
  'ogg': {
    label: 'OGG (Vorbis Audio)',
    ext: 'ogg',
    args: ['-vn', '-c:a', 'libvorbis', '-q:a', '5'],
  },
  'gif': {
    label: 'GIF (Animated)',
    ext: 'gif',
    args: ['-vf', 'fps=15,scale=480:-1:flags=lanczos', '-loop', '0'],
  },
  'webm-audio': {
    label: 'WebM (Opus Audio)',
    ext: 'webm',
    args: ['-vn', '-c:a', 'libopus', '-b:a', '128k'],
  },
};

// MIME type lookup
const MIME_MAP = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.gif': 'image/gif',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
};

function getMimeType(name) {
  const ext = name.substring(name.lastIndexOf('.'));
  return MIME_MAP[ext] || 'application/octet-stream';
}

export default function useFFmpeg() {
  const workerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const resolveRef = useRef(null);
  const rejectRef = useRef(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/ffmpeg.worker.js', import.meta.url),
        { type: 'module' }
      );
      workerRef.current.onmessage = (e) => {
        const { type } = e.data;
        switch (type) {
          case 'loaded':
            setIsLoaded(e.data.success);
            setIsLoading(false);
            if (resolveRef.current) { resolveRef.current(e.data.success); resolveRef.current = null; }
            break;
          case 'progress':
            setProgress(e.data.progress);
            break;
          case 'log':
            setLogs(prev => [...prev.slice(-49), e.data.message]);
            break;
          case 'done':
          case 'decoded':
            setIsProcessing(false);
            setProgress(1);
            if (resolveRef.current) {
              const blob = new Blob([e.data.data], { type: getMimeType(e.data.outputName) });
              resolveRef.current({ blob, name: e.data.outputName });
              resolveRef.current = null;
            }
            break;
          case 'error':
            setIsProcessing(false);
            setError(e.data.error);
            if (rejectRef.current) { rejectRef.current(new Error(e.data.error)); rejectRef.current = null; }
            break;
          case 'cancelled':
            setIsProcessing(false);
            if (rejectRef.current) { rejectRef.current(new Error('Cancelled')); rejectRef.current = null; }
            break;
        }
      };
    }
    return workerRef.current;
  }, []);

  const load = useCallback(() => {
    if (isLoaded) return Promise.resolve(true);
    setIsLoading(true);
    setError(null);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      getWorker().postMessage({ type: 'load' });
    });
  }, [isLoaded, getWorker]);

  // Pre-load FFmpeg in idle time (call during app init)
  const preload = useCallback(() => {
    if (isLoaded || isLoading) return;
    if ('requestIdleCallback' in self) {
      requestIdleCallback(() => load(), { timeout: 10000 });
    }
  }, [isLoaded, isLoading, load]);

  const transcode = useCallback(async (file, presetKey, customArgs) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setLogs([]);

    const preset = TRANSCODE_PRESETS[presetKey];
    const outputName = file.name.replace(/\.[^.]+$/, '') + '.' + (preset?.ext || 'webm');
    const args = customArgs || preset?.args || [];

    const buffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      getWorker().postMessage(
        { type: 'transcode', input: buffer, inputName: file.name, outputName, args },
        [buffer]  // Transferable — zero-copy to worker
      );
    });
  }, [getWorker]);

  const decodeForPlayback = useCallback(async (file) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setLogs([]);

    const buffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      getWorker().postMessage(
        { type: 'decode', input: buffer, inputName: file.name },
        [buffer]  // Transferable — zero-copy to worker
      );
    });
  }, [getWorker]);

  const extractAudio = useCallback(async (file, format = 'mp3') => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setLogs([]);

    const buffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      getWorker().postMessage(
        { type: 'extractAudio', input: buffer, inputName: file.name, format },
        [buffer]
      );
    });
  }, [getWorker]);

  const cancel = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
      setIsProcessing(false);
      setIsLoaded(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  return {
    isLoaded, isLoading, isProcessing, progress, logs, error,
    load, preload, transcode, decodeForPlayback, extractAudio, cancel,
  };
}
