import React, { useState, useCallback, useRef, useEffect } from 'react';
import Dialog from './Dialog';
import { formatTime, formatFileSize } from '../utils/helpers';
import { TRANSCODE_PRESETS } from '../hooks/useFFmpeg';

// ===== Transcode / Convert Dialog =====
export function TranscodeDialog({ open, onClose, ffmpeg, currentFile }) {
  const [preset, setPreset] = useState('webm-vp9');
  const [customArgs, setCustomArgs] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const file = selectedFile || currentFile;

  useEffect(() => {
    if (open) {
      setResult(null);
      setSelectedFile(null);
    }
  }, [open]);

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) setSelectedFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleStart = async () => {
    if (!file) return;

    // Load FFmpeg if not loaded
    if (!ffmpeg.isLoaded) {
      await ffmpeg.load();
    }

    try {
      const args = useCustom ? customArgs.split(' ').filter(Boolean) : undefined;
      const output = await ffmpeg.transcode(file, preset, args);
      setResult(output);
    } catch (e) {
      // Error is captured in ffmpeg.error
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(result.blob);
    a.download = result.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleCancel = () => {
    ffmpeg.cancel();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Convert / Transcode" wide
      footer={
        <>
          {ffmpeg.isProcessing && <button className="dialog-btn" onClick={handleCancel}>Cancel</button>}
          {!ffmpeg.isProcessing && !result && <button className="dialog-btn primary" onClick={handleStart} disabled={!file}>Start</button>}
          {result && <button className="dialog-btn primary" onClick={handleDownload}>Download</button>}
          <button className="dialog-btn" onClick={onClose}>Close</button>
        </>
      }>

      {/* Source file */}
      <div className="dialog-section">
        <h4 className="transcode-section-title">Source</h4>
        <div className="transcode-source">
          <div className="transcode-file-info">
            {file ? (
              <>
                <span className="transcode-filename">{file.name}</span>
                <span className="transcode-filesize">{formatFileSize(file.size)}</span>
              </>
            ) : (
              <span className="transcode-no-file">No file selected</span>
            )}
          </div>
          <button className="dialog-btn" onClick={() => fileInputRef.current?.click()}>Browse...</button>
          <input ref={fileInputRef} type="file" accept="video/*,audio/*" style={{ display: 'none' }} onChange={handleFileSelect} />
        </div>
      </div>

      {/* Output format */}
      <div className="dialog-section">
        <h4 className="transcode-section-title">Output Format</h4>
        <div className="transcode-presets">
          {Object.entries(TRANSCODE_PRESETS).map(([key, p]) => (
            <label key={key} className={`transcode-preset${preset === key ? ' active' : ''}`}>
              <input type="radio" name="preset" value={key} checked={preset === key}
                onChange={() => setPreset(key)} />
              <span className="transcode-preset-label">{p.label}</span>
              <span className="transcode-preset-ext">.{p.ext}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Advanced options */}
      <div className="dialog-section">
        <label className="checkbox-row">
          <input type="checkbox" checked={useCustom} onChange={e => setUseCustom(e.target.checked)} />
          <span>Custom FFmpeg arguments</span>
        </label>
        {useCustom && (
          <input type="text" className="dialog-input" value={customArgs}
            onChange={e => setCustomArgs(e.target.value)}
            placeholder="-c:v libx264 -crf 23 -c:a aac -b:a 128k"
            style={{ marginTop: 8 }} />
        )}
      </div>

      {/* Progress */}
      {(ffmpeg.isLoading || ffmpeg.isProcessing) && (
        <div className="dialog-section">
          <h4 className="transcode-section-title">
            {ffmpeg.isLoading ? 'Loading FFmpeg Engine...' : 'Transcoding...'}
          </h4>
          <div className="transcode-progress-bar">
            <div className="transcode-progress-fill" style={{ width: `${(ffmpeg.progress * 100).toFixed(1)}%` }} />
          </div>
          <div className="transcode-progress-text">{(ffmpeg.progress * 100).toFixed(1)}%</div>
          {ffmpeg.logs.length > 0 && (
            <div className="transcode-log">
              {ffmpeg.logs.slice(-5).map((log, i) => (
                <div key={i} className="transcode-log-line">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="dialog-section">
          <h4 className="transcode-section-title">Complete</h4>
          <div className="transcode-result">
            <span>{result.name}</span>
            <span>{formatFileSize(result.blob.size)}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {ffmpeg.error && (
        <div className="dialog-section">
          <div className="transcode-error">{ffmpeg.error}</div>
        </div>
      )}
    </Dialog>
  );
}

// ===== Screen Capture Dialog =====
export function ScreenCaptureDialog({ open, onClose, capture, onPlayRecording }) {
  const previewRef = useRef(null);
  const [settings, setSettings] = useState({
    fps: 30,
    systemAudio: true,
    micAudio: false,
  });

  // Attach live preview
  useEffect(() => {
    if (previewRef.current && capture.stream) {
      previewRef.current.srcObject = capture.stream;
    }
  }, [capture.stream]);

  // Reset capture state when dialog opens fresh
  useEffect(() => {
    if (open && !capture.isCapturing && !capture.isRecording) {
      capture.cleanup();
    }
  }, [open]);

  const handleStartScreen = async () => {
    const stream = await capture.startScreenCapture(settings);
    if (stream) capture.startRecording();
  };

  const handleStartWebcam = async () => {
    const stream = await capture.startWebcam(settings);
    if (stream) capture.startRecording();
  };

  const handleStop = () => {
    capture.stopRecording();
  };

  const handlePlayback = () => {
    const file = capture.getRecordingFile();
    if (file && onPlayRecording) {
      onPlayRecording(file);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={() => { if (!capture.isRecording) onClose(); }} title="Screen Capture" wide
      footer={
        <>
          {capture.recordedBlob && (
            <>
              <button className="dialog-btn" onClick={handlePlayback}>Play in Player</button>
              <button className="dialog-btn" onClick={() => capture.downloadRecording()}>Save</button>
            </>
          )}
          {!capture.isRecording && !capture.isCapturing && (
            <button className="dialog-btn" onClick={() => { capture.cleanup(); onClose(); }}>Close</button>
          )}
        </>
      }>

      {/* Source selection - shown when not recording */}
      {!capture.isCapturing && !capture.recordedBlob && (
        <>
          <div className="dialog-section">
            <h4 className="transcode-section-title">Capture Source</h4>
            <div className="capture-sources">
              <button className="capture-source-btn" onClick={handleStartScreen}>
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <rect x="2" y="3" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Screen</span>
              </button>
              <button className="capture-source-btn" onClick={handleStartWebcam}>
                <svg viewBox="0 0 24 24" width="32" height="32">
                  <circle cx="12" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                  <rect x="2" y="3" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                  <circle cx="12" cy="10" r="1.5" fill="currentColor" />
                </svg>
                <span>Webcam</span>
              </button>
            </div>
          </div>

          <div className="dialog-section">
            <h4 className="transcode-section-title">Settings</h4>
            <div className="capture-settings">
              <div className="pref-row">
                <label>Frame rate:</label>
                <select className="dialog-select" value={settings.fps}
                  onChange={e => setSettings(s => ({ ...s, fps: parseInt(e.target.value) }))}>
                  <option value="15">15 fps</option>
                  <option value="24">24 fps</option>
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                </select>
              </div>
              <div className="pref-row checkbox-row">
                <label>
                  <input type="checkbox" checked={settings.systemAudio}
                    onChange={e => setSettings(s => ({ ...s, systemAudio: e.target.checked }))} />
                  Capture system audio
                </label>
              </div>
              <div className="pref-row checkbox-row">
                <label>
                  <input type="checkbox" checked={settings.micAudio}
                    onChange={e => setSettings(s => ({ ...s, micAudio: e.target.checked }))} />
                  Capture microphone audio
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recording in progress */}
      {capture.isRecording && (
        <div className="dialog-section">
          <div className="capture-recording">
            <div className="capture-preview-container">
              <video ref={previewRef} autoPlay muted className="capture-preview" />
            </div>
            <div className="capture-recording-info">
              <div className="capture-recording-indicator">
                <span className="capture-rec-dot" />
                <span>{capture.isPaused ? 'PAUSED' : 'REC'}</span>
              </div>
              <div className="capture-duration">{formatTime(capture.duration)}</div>
              <div className="capture-controls">
                {capture.isPaused ? (
                  <button className="dialog-btn" onClick={capture.resumeRecording}>Resume</button>
                ) : (
                  <button className="dialog-btn" onClick={capture.pauseRecording}>Pause</button>
                )}
                <button className="dialog-btn primary" onClick={handleStop}>Stop Recording</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recording complete — preview */}
      {capture.recordedBlob && !capture.isRecording && (
        <div className="dialog-section">
          <h4 className="transcode-section-title">Recording Complete</h4>
          <div className="capture-preview-container">
            <video src={capture.previewUrl} controls className="capture-preview" />
          </div>
          <div className="capture-result-info">
            <span>Size: {formatFileSize(capture.recordedBlob.size)}</span>
            <span>Duration: {formatTime(capture.duration)}</span>
          </div>
        </div>
      )}

      {capture.error && (
        <div className="dialog-section">
          <div className="transcode-error">{capture.error}</div>
        </div>
      )}
    </Dialog>
  );
}

// ===== Media Library Dialog =====
export function MediaLibraryDialog({ open, onClose, library, onPlayMedia }) {
  const [tab, setTab] = useState('library');
  const stats = library.getStats();

  const handlePlay = (item) => {
    if (onPlayMedia) onPlayMedia(item);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Media Library" wide
      footer={
        <>
          <button className="dialog-btn" onClick={() => library.clearHistory()}>Clear History</button>
          <button className="dialog-btn primary" onClick={onClose}>Close</button>
        </>
      }>

      <div className="dialog-tabs">
        <button className={`dialog-tab${tab === 'library' ? ' active' : ''}`} onClick={() => setTab('library')}>
          Library ({stats.total})
        </button>
        <button className={`dialog-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          History ({library.recentHistory.length})
        </button>
        <button className={`dialog-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>
          Statistics
        </button>
      </div>

      {tab === 'library' && (
        <>
          {/* Search and sort */}
          <div className="library-toolbar">
            <input type="text" className="dialog-input library-search"
              placeholder="Search media..."
              value={library.searchQuery}
              onChange={e => library.setSearchQuery(e.target.value)} />
            <select className="dialog-select" value={library.sortBy}
              onChange={e => library.setSortBy(e.target.value)}>
              <option value="lastPlayed">Recently Played</option>
              <option value="dateAdded">Date Added</option>
              <option value="name">Name</option>
              <option value="type">Type</option>
            </select>
          </div>

          {/* Media items */}
          <div className="library-list">
            {library.items.length === 0 ? (
              <div className="library-empty">
                {library.searchQuery ? 'No results found.' : 'Your media library is empty. Play some media to populate it.'}
              </div>
            ) : (
              library.items.map(item => (
                <div key={item.id} className="library-item" onDoubleClick={() => handlePlay(item)}>
                  <div className="library-thumb">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" />
                    ) : (
                      <div className="library-thumb-placeholder">
                        {item.type === 'audio' ? '♪' : '▶'}
                      </div>
                    )}
                  </div>
                  <div className="library-item-info">
                    <div className="library-item-name">{item.name}</div>
                    <div className="library-item-meta">
                      <span>{item.type}</span>
                      {item.duration > 0 && <span>{formatTime(item.duration)}</span>}
                      <span>{formatFileSize(item.size)}</span>
                      <span>Played {item.playCount || 0}x</span>
                    </div>
                    {item.lastPosition > 0 && item.duration > 0 && (
                      <div className="library-item-progress">
                        <div className="library-progress-bar">
                          <div className="library-progress-fill"
                            style={{ width: `${(item.lastPosition / item.duration * 100).toFixed(1)}%` }} />
                        </div>
                        <span>{formatTime(item.lastPosition)} / {formatTime(item.duration)}</span>
                      </div>
                    )}
                  </div>
                  <button className="library-item-delete" onClick={() => library.deleteMedia(item.id)} title="Remove">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="library-list">
          {library.recentHistory.length === 0 ? (
            <div className="library-empty">No playback history yet.</div>
          ) : (
            library.recentHistory.map(item => (
              <div key={item.id} className="library-history-item">
                <div className="library-history-name">{item.mediaName}</div>
                <div className="library-history-meta">
                  <span>{new Date(item.timestamp).toLocaleString()}</span>
                  {item.position > 0 && <span>at {formatTime(item.position)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div className="info-grid" style={{ padding: 16 }}>
          <div className="info-row"><span className="info-label">Total items:</span><span className="info-value">{stats.total}</span></div>
          <div className="info-row"><span className="info-label">Videos:</span><span className="info-value">{stats.videoCount}</span></div>
          <div className="info-row"><span className="info-label">Audio files:</span><span className="info-value">{stats.audioCount}</span></div>
          <div className="info-row"><span className="info-label">Total size:</span><span className="info-value">{formatFileSize(stats.totalSize)}</span></div>
          <div className="info-row"><span className="info-label">History entries:</span><span className="info-value">{library.recentHistory.length}</span></div>
          <div style={{ marginTop: 20 }}>
            <button className="dialog-btn" onClick={() => {
              if (confirm('Clear entire media library? This cannot be undone.')) library.clearLibrary();
            }}>Clear Entire Library</button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ===== Stream Quality Selector Dialog =====
export function StreamInfoDialog({ open, onClose, stream }) {
  if (!stream.streamInfo) {
    return (
      <Dialog open={open} onClose={onClose} title="Stream Information"
        footer={<button className="dialog-btn primary" onClick={onClose}>Close</button>}>
        <div className="dialog-section">
          <p>No active stream. Open a network stream (.m3u8 or .mpd) to see stream information.</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} title="Stream Information" wide
      footer={<button className="dialog-btn primary" onClick={onClose}>Close</button>}>

      <div className="dialog-section">
        <h4 className="transcode-section-title">Stream Details</h4>
        <div className="info-grid">
          <div className="info-row"><span className="info-label">Protocol:</span><span className="info-value">{stream.streamInfo.type}</span></div>
          <div className="info-row"><span className="info-label">Quality levels:</span><span className="info-value">{stream.streamInfo.levels}</span></div>
          <div className="info-row"><span className="info-label">Live:</span><span className="info-value">{stream.isLive ? 'Yes' : 'No'}</span></div>
        </div>
      </div>

      {stream.qualities.length > 0 && (
        <div className="dialog-section">
          <h4 className="transcode-section-title">Video Quality</h4>
          <div className="stream-quality-list">
            {stream.qualities.map(q => (
              <label key={q.index} className={`stream-quality-option${stream.currentQuality === q.index ? ' active' : ''}`}>
                <input type="radio" name="quality" checked={stream.currentQuality === q.index}
                  onChange={() => stream.setQuality(q.index)} />
                <span className="stream-quality-label">{q.label}</span>
                {q.bitrate && <span className="stream-quality-bitrate">{Math.round(q.bitrate / 1000)} kbps</span>}
                {q.width && <span className="stream-quality-res">{q.width}x{q.height}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {stream.audioTracks.length > 1 && (
        <div className="dialog-section">
          <h4 className="transcode-section-title">Audio Track</h4>
          <div className="stream-quality-list">
            {stream.audioTracks.map(t => (
              <label key={t.index} className={`stream-quality-option${stream.currentAudioTrack === t.index ? ' active' : ''}`}>
                <input type="radio" name="audioTrack" checked={stream.currentAudioTrack === t.index}
                  onChange={() => stream.setAudioTrack(t.index)} />
                <span>{t.name} ({t.lang})</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ===== Plugin Manager Dialog =====
export function PluginManagerDialog({ open, onClose, plugins }) {
  const [pluginUrl, setPluginUrl] = useState('');
  const [tab, setTab] = useState('installed');

  const handleInstall = async () => {
    if (pluginUrl.trim()) {
      await plugins.install(pluginUrl.trim());
      setPluginUrl('');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Extensions / Plugins" wide
      footer={<button className="dialog-btn primary" onClick={onClose}>Close</button>}>

      <div className="dialog-tabs">
        <button className={`dialog-tab${tab === 'installed' ? ' active' : ''}`} onClick={() => setTab('installed')}>
          Installed ({plugins.plugins.length})
        </button>
        <button className={`dialog-tab${tab === 'install' ? ' active' : ''}`} onClick={() => setTab('install')}>
          Add Extension
        </button>
      </div>

      {tab === 'installed' && (
        <div className="plugin-list">
          {plugins.plugins.length === 0 ? (
            <div className="library-empty">No extensions installed.</div>
          ) : (
            plugins.plugins.map(plugin => (
              <div key={plugin.id} className="plugin-item">
                <div className="plugin-info">
                  <div className="plugin-name">{plugin.name}</div>
                  <div className="plugin-desc">{plugin.description || 'No description'}</div>
                  <div className="plugin-version">v{plugin.version || '1.0.0'}</div>
                </div>
                <div className="plugin-actions">
                  <label className="plugin-toggle">
                    <input type="checkbox" checked={plugin.enabled}
                      onChange={() => plugins.toggle(plugin.id)} />
                    <span>{plugin.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                  <button className="dialog-btn" onClick={() => plugins.uninstall(plugin.id)}>Remove</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'install' && (
        <div className="dialog-section">
          <label>Extension URL (JavaScript module):</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input type="text" className="dialog-input" value={pluginUrl}
              onChange={e => setPluginUrl(e.target.value)}
              placeholder="https://example.com/my-plugin.js"
              onKeyDown={e => { if (e.key === 'Enter') handleInstall(); }} />
            <button className="dialog-btn primary" onClick={handleInstall}>Install</button>
          </div>
          <div className="dialog-hint" style={{ marginTop: 12 }}>
            Extensions are JavaScript modules that export a <code>register(api)</code> function.
            They can add menu items, keyboard shortcuts, and custom processing.
          </div>
          <div className="dialog-section" style={{ marginTop: 16 }}>
            <h4 className="transcode-section-title">Plugin API</h4>
            <div className="transcode-log" style={{ maxHeight: 120 }}>
              <div className="transcode-log-line">{'export function register(api) {'}</div>
              <div className="transcode-log-line">{'  api.name = "My Plugin";'}</div>
              <div className="transcode-log-line">{'  api.description = "Description";'}</div>
              <div className="transcode-log-line">{'  api.onPlay = (mediaInfo) => { ... };'}</div>
              <div className="transcode-log-line">{'  api.onPause = () => { ... };'}</div>
              <div className="transcode-log-line">{'  api.onTimeUpdate = (time) => { ... };'}</div>
              <div className="transcode-log-line">{'  api.getMenuItems = () => [...];'}</div>
              <div className="transcode-log-line">{'}'}</div>
            </div>
          </div>
        </div>
      )}

      {plugins.error && (
        <div className="dialog-section">
          <div className="transcode-error">{plugins.error}</div>
        </div>
      )}
    </Dialog>
  );
}
