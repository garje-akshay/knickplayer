import { useState, useCallback, useRef } from 'react';

/**
 * useScreenCapture — Screen recording + webcam capture via browser APIs.
 *
 * Features:
 *   - Screen capture via getDisplayMedia (screen, window, or tab)
 *   - Webcam capture via getUserMedia
 *   - Records to WebM using MediaRecorder
 *   - Configurable video/audio settings
 *   - Download or play back recordings
 */

const MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function getSupportedMime() {
  for (const mime of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'video/webm';
}

export default function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [source, setSource] = useState(null); // 'screen' | 'webcam'
  const [error, setError] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsCapturing(false);
    setIsRecording(false);
    setIsPaused(false);
    setSource(null);
    setDuration(0);
    setError(null);
    setRecordedBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const startScreenCapture = useCallback(async (options = {}) => {
    setError(null);
    setRecordedBlob(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: options.width || 1920 },
          height: { ideal: options.height || 1080 },
          frameRate: { ideal: options.fps || 30 },
        },
        audio: options.systemAudio !== false,
      });

      // If user wants mic audio, mix it in
      let finalStream = displayStream;
      if (options.micAudio) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const ctx = new AudioContext();
          const dest = ctx.createMediaStreamDestination();
          // System audio
          const sysSource = ctx.createMediaStreamSource(displayStream);
          sysSource.connect(dest);
          // Mic audio
          const micSource = ctx.createMediaStreamSource(micStream);
          micSource.connect(dest);
          // Combine video tracks from display + mixed audio
          finalStream = new MediaStream([
            ...displayStream.getVideoTracks(),
            ...dest.stream.getAudioTracks(),
          ]);
        } catch {
          // Mic failed — continue with just system audio
        }
      }

      streamRef.current = finalStream;
      setIsCapturing(true);
      setSource('screen');

      // Auto-stop when user stops sharing — use refs to avoid stale closure
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        setIsCapturing(false);
      });

      return finalStream;
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Screen capture permission denied' : e.message);
      return null;
    }
  }, [previewUrl]);

  const startWebcam = useCallback(async (options = {}) => {
    setError(null);
    setRecordedBlob(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: options.width || 1280 },
          height: { ideal: options.height || 720 },
          frameRate: { ideal: options.fps || 30 },
          facingMode: options.facingMode || 'user',
        },
        audio: options.audio !== false,
      });

      streamRef.current = stream;
      setIsCapturing(true);
      setSource('webcam');
      return stream;
    } catch (e) {
      setError(e.name === 'NotAllowedError' ? 'Camera permission denied' : e.message);
      return null;
    }
  }, [previewUrl]);

  const startRecording = useCallback((options = {}) => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setRecordedBlob(null);
    setDuration(0);

    const mimeType = getSupportedMime();
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: options.videoBitrate || 2500000,
      audioBitsPerSecond: options.audioBitrate || 128000,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    recorder.start(1000); // Collect data every second
    recorderRef.current = recorder;
    setIsRecording(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  }, []);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      setIsPaused(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  }, []);

  const downloadRecording = useCallback((filename) => {
    if (!recordedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(recordedBlob);
    a.download = filename || `knickplayer-recording-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [recordedBlob]);

  const getRecordingFile = useCallback(() => {
    if (!recordedBlob) return null;
    return new File([recordedBlob], `knickplayer-recording-${Date.now()}.webm`, { type: recordedBlob.type });
  }, [recordedBlob]);

  return {
    // State
    isCapturing, isRecording, isPaused, duration, source, error,
    recordedBlob, previewUrl, stream: streamRef.current,
    // Actions
    startScreenCapture, startWebcam, startRecording, pauseRecording,
    resumeRecording, stopRecording, downloadRecording, getRecordingFile,
    cleanup,
  };
}
