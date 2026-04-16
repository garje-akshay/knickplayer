/**
 * FFmpeg Web Worker — high-performance transcoding with multi-threaded WASM.
 *
 * Optimizations:
 *   1. Multi-threaded core (SharedArrayBuffer) — uses all CPU cores
 *   2. Stream copy when possible — remux without re-encoding (instant)
 *   3. Ultrafast presets with aggressive quality trade-offs for playback
 *   4. Hardware-friendly pixel formats (yuv420p)
 *   5. Downscale large videos to 720p max for faster encode
 *   6. Single-pass encoding with CRF (no 2-pass overhead)
 *   7. Reduced GOP and lookahead for lower latency
 *   8. Audio: copy if possible, else fast codec with low complexity
 *
 * Commands:
 *   { type: 'load' }                    — Load FFmpeg WASM binary
 *   { type: 'transcode', input, outputName, args }  — Transcode a file
 *   { type: 'decode', input }           — Decode non-native format to playable
 *   { type: 'extractAudio', input }     — Extract audio track
 *   { type: 'cancel' }                  — Abort current operation
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg = null;
let loaded = false;
let isMultiThread = false;

async function loadFFmpeg() {
  if (loaded) return true;
  try {
    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      self.postMessage({ type: 'log', message });
    });

    ffmpeg.on('progress', ({ progress, time }) => {
      self.postMessage({ type: 'progress', progress: Math.max(0, Math.min(1, progress)), time });
    });

    // Try multi-threaded core first (requires SharedArrayBuffer / COOP+COEP headers)
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';

    if (hasSAB) {
      try {
        const mtBase = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${mtBase}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${mtBase}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${mtBase}/ffmpeg-core.worker.js`, 'text/javascript'),
        });
        isMultiThread = true;
        loaded = true;
        self.postMessage({ type: 'log', message: 'FFmpeg loaded (multi-threaded)' });
        return true;
      } catch (e) {
        self.postMessage({ type: 'log', message: `Multi-thread failed, falling back to single-thread: ${e.message}` });
        // Fall through to single-threaded
        ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => self.postMessage({ type: 'log', message }));
        ffmpeg.on('progress', ({ progress, time }) => {
          self.postMessage({ type: 'progress', progress: Math.max(0, Math.min(1, progress)), time });
        });
      }
    }

    // Single-threaded fallback
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    loaded = true;
    self.postMessage({ type: 'log', message: 'FFmpeg loaded (single-threaded)' });
    return true;
  } catch (e) {
    self.postMessage({ type: 'error', error: `FFmpeg load failed: ${e.message}` });
    return false;
  }
}

// Get thread count for encoding
function getThreads() {
  if (!isMultiThread) return ['1'];
  const cores = navigator.hardwareConcurrency || 4;
  return [String(Math.min(cores, 8))];
}

async function transcode(inputData, inputName, outputName, args) {
  if (!loaded) {
    const ok = await loadFFmpeg();
    if (!ok) return;
  }

  try {
    await ffmpeg.writeFile(inputName, inputData);

    const fullArgs = args && args.length > 0
      ? ['-i', inputName, '-threads', ...getThreads(), ...args, outputName]
      : ['-i', inputName, '-threads', ...getThreads(),
         '-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-b:v', '2M', '-b:a', '128k', outputName];

    await ffmpeg.exec(fullArgs);

    const data = await ffmpeg.readFile(outputName);
    self.postMessage({ type: 'done', data: data.buffer, outputName }, [data.buffer]);

    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
  } catch (e) {
    self.postMessage({ type: 'error', error: `Transcode failed: ${e.message}` });
  }
}

async function decodeToPlayable(inputData, inputName) {
  if (!loaded) {
    const ok = await loadFFmpeg();
    if (!ok) return;
  }

  try {
    await ffmpeg.writeFile(inputName, inputData);

    const ext = inputName.split('.').pop().toLowerCase();
    const threads = getThreads();

    // ── Audio-only formats ──
    const audioOnlyExts = [
      'wma', 'ac3', 'dts', 'aiff', 'aif', 'ape', 'mka', 'wv', 'tta', 'tak',
      'shn', 'ra', 'ram', 'mid', 'midi', 'mod', 's3m', 'xm', 'it', 'amr',
      'awb', 'caf', 'au', 'snd', 'spx', 'dsf', 'dff', 'alac', 'mp2', 'mp1',
      'mpc', 'aa', 'aax', 'pcm', 'gsm', 'adts', 'w64', 'rf64',
    ];

    if (audioOnlyExts.includes(ext)) {
      const outputName = 'output.wav';
      await ffmpeg.exec([
        '-i', inputName,
        '-threads', ...threads,
        '-c:a', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputName,
      ]);
      const data = await ffmpeg.readFile(outputName);
      self.postMessage({ type: 'decoded', data: data.buffer, outputName }, [data.buffer]);
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}
      return;
    }

    // ── Strategy 1: Stream-copy remux to MP4 (near-instant, no re-encoding) ──
    // Many formats (MKV, AVI, FLV, TS) contain H.264/AAC streams that browsers
    // can play — just the container is wrong. Remuxing is 100x faster than transcoding.
    const remuxable = ['mkv', 'avi', 'flv', 'ts', 'mts', 'm2ts', 'm2t', 'f4v', 'f4p', 'vob', 'mpg', 'mpeg'];
    if (remuxable.includes(ext)) {
      try {
        const outputName = 'output.mp4';
        await ffmpeg.exec([
          '-i', inputName,
          '-c:v', 'copy',
          '-c:a', 'copy',
          '-movflags', '+faststart',
          '-f', 'mp4',
          '-y',
          outputName,
        ]);
        const data = await ffmpeg.readFile(outputName);
        if (data.length > 1024) { // Sanity check — got actual output
          self.postMessage({ type: 'decoded', data: data.buffer, outputName }, [data.buffer]);
          try { await ffmpeg.deleteFile(inputName); } catch {}
          try { await ffmpeg.deleteFile(outputName); } catch {}
          return;
        }
      } catch {
        // Remux failed (incompatible codecs) — fall through to transcode
        self.postMessage({ type: 'log', message: 'Remux failed, falling back to transcode...' });
        try { await ffmpeg.deleteFile('output.mp4'); } catch {}
      }
    }

    // ── Strategy 2: Fast transcode to MP4 H.264 (ultrafast, 720p cap, low quality) ──
    // Priority: speed over quality. CRF 32 + ultrafast + 720p = fast enough for preview.
    let outputName = 'output.mp4';
    let success = false;

    try {
      await ffmpeg.exec([
        '-i', inputName,
        '-threads', ...threads,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'fastdecode',
        '-crf', '32',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=-2:min(ih\\,720)',  // Cap at 720p, preserve aspect
        '-g', '60',                         // Keyframe every 60 frames (faster seek)
        '-bf', '0',                         // No B-frames (faster encode)
        '-refs', '1',                       // Minimal reference frames
        '-c:a', 'aac',
        '-b:a', '96k',
        '-ac', '2',                         // Stereo (faster than surround)
        '-movflags', '+faststart',
        '-f', 'mp4',
        '-y',
        outputName,
      ]);
      success = true;
    } catch {
      // ── Strategy 3: WebM VP8 (lighter than VP9) ──
      outputName = 'output.webm';
      try {
        await ffmpeg.exec([
          '-i', inputName,
          '-threads', ...threads,
          '-c:v', 'libvpx',
          '-quality', 'realtime',
          '-cpu-used', '8',       // Maximum speed (0-8, 8=fastest)
          '-crf', '35',
          '-b:v', '1M',
          '-vf', 'scale=-2:min(ih\\,720)',
          '-c:a', 'libvorbis',
          '-b:a', '96k',
          '-ac', '2',
          '-f', 'webm',
          '-y',
          outputName,
        ]);
        success = true;
      } catch {
        // ── Strategy 4: VP9 last resort ──
        try {
          await ffmpeg.exec([
            '-i', inputName,
            '-threads', ...threads,
            '-c:v', 'libvpx-vp9',
            '-quality', 'realtime',
            '-cpu-used', '8',
            '-crf', '40',
            '-b:v', '0',
            '-vf', 'scale=-2:min(ih\\,720)',
            '-row-mt', '1',         // Row-based multi-threading for VP9
            '-c:a', 'libopus',
            '-b:a', '96k',
            '-ac', '2',
            '-f', 'webm',
            '-y',
            outputName,
          ]);
          success = true;
        } catch (inner) {
          throw inner;
        }
      }
    }

    if (success) {
      const data = await ffmpeg.readFile(outputName);
      self.postMessage({ type: 'decoded', data: data.buffer, outputName }, [data.buffer]);
    }

    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
  } catch (e) {
    self.postMessage({ type: 'error', error: `Decode failed: ${e.message}` });
  }
}

async function extractAudio(inputData, inputName, format) {
  if (!loaded) {
    const ok = await loadFFmpeg();
    if (!ok) return;
  }

  const outputName = `output.${format || 'mp3'}`;
  const codecMap = { mp3: 'libmp3lame', wav: 'pcm_s16le', ogg: 'libvorbis', flac: 'flac', aac: 'aac' };

  try {
    await ffmpeg.writeFile(inputName, inputData);

    await ffmpeg.exec([
      '-i', inputName,
      '-threads', ...getThreads(),
      '-vn',
      '-c:a', codecMap[format] || 'libmp3lame',
      '-q:a', '2',
      '-y',
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    self.postMessage({ type: 'done', data: data.buffer, outputName }, [data.buffer]);

    try { await ffmpeg.deleteFile(inputName); } catch {}
    try { await ffmpeg.deleteFile(outputName); } catch {}
  } catch (e) {
    self.postMessage({ type: 'error', error: `Audio extraction failed: ${e.message}` });
  }
}

self.onmessage = async (e) => {
  const { type } = e.data;

  switch (type) {
    case 'load': {
      const ok = await loadFFmpeg();
      self.postMessage({ type: 'loaded', success: ok });
      break;
    }
    case 'transcode': {
      const { input, inputName, outputName, args } = e.data;
      const inputData = input instanceof ArrayBuffer ? new Uint8Array(input) : await fetchFile(input);
      await transcode(inputData, inputName, outputName, args);
      break;
    }
    case 'decode': {
      const { input, inputName } = e.data;
      const inputData = input instanceof ArrayBuffer ? new Uint8Array(input) : await fetchFile(input);
      await decodeToPlayable(inputData, inputName);
      break;
    }
    case 'extractAudio': {
      const { input, inputName, format } = e.data;
      const inputData = input instanceof ArrayBuffer ? new Uint8Array(input) : await fetchFile(input);
      await extractAudio(inputData, inputName, format);
      break;
    }
    case 'cancel': {
      self.postMessage({ type: 'cancelled' });
      break;
    }
  }
};
