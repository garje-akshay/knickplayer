import React, { useState } from 'react';
import Dialog from './Dialog';
import AppLogo from './VLCCone';
import { usePlayerContext } from '../hooks/PlayerContext';
import { formatTime, formatFileSize, EQ_LABELS, EQ_PRESETS } from '../utils/helpers';

// ===== Network Stream Dialog =====
export function NetworkDialog({ open, onClose }) {
  const { player, playlist } = usePlayerContext();
  const [url, setUrl] = useState('');

  const handlePlay = () => {
    if (!url.trim()) return;
    player.loadUrl(url.trim());
    player.play();
    playlist.addUrl(url.trim());
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Open Network Stream"
      footer={<>
        <button className="dialog-btn primary" onClick={handlePlay}>Play</button>
        <button className="dialog-btn" onClick={onClose}>Cancel</button>
      </>}>
      <div className="dialog-section">
        <label>Please enter a network URL:</label>
        <input type="text" className="dialog-input" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="http:// or https:// URL, HLS stream (.m3u8), DASH (.mpd)..."
          onKeyDown={e => { if (e.key === 'Enter') handlePlay(); }} />
      </div>
      <div className="dialog-hint">Supported: HTTP/HTTPS direct links, HLS (.m3u8), DASH (.mpd)</div>
    </Dialog>
  );
}

// ===== Jump to Time Dialog =====
export function JumpDialog({ open, onClose }) {
  const { player } = usePlayerContext();
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [s, setS] = useState(0);
  const handleGo = () => { player.seek(h * 3600 + m * 60 + s); onClose(); };
  return (
    <Dialog open={open} onClose={onClose} title="Jump to Time"
      footer={<><button className="dialog-btn primary" onClick={handleGo}>Go</button><button className="dialog-btn" onClick={onClose}>Cancel</button></>}>
      <div className="dialog-section">
        <label>Jump to:</label>
        <div className="time-input-group">
          <input type="number" className="time-input" min="0" max="99" value={h} onChange={e => setH(parseInt(e.target.value) || 0)} /><span>:</span>
          <input type="number" className="time-input" min="0" max="59" value={m} onChange={e => setM(parseInt(e.target.value) || 0)} /><span>:</span>
          <input type="number" className="time-input" min="0" max="59" value={s} onChange={e => setS(parseInt(e.target.value) || 0)} />
        </div>
      </div>
    </Dialog>
  );
}

// ===== Media Information Dialog =====
export function MediaInfoDialog({ open, onClose }) {
  const { player } = usePlayerContext();
  const [tab, setTab] = useState('general');
  const info = player.mediaInfo;
  return (
    <Dialog open={open} onClose={onClose} title="Current Media Information" wide
      footer={<button className="dialog-btn" onClick={onClose}>Close</button>}>
      <div className="dialog-tabs">
        {['general', 'codec', 'statistics'].map(t => (
          <button key={t} className={`dialog-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'general' && (
        <div className="info-grid">
          <div className="info-row"><span className="info-label">File:</span><span className="info-value">{info?.name || '-'}</span></div>
          <div className="info-row"><span className="info-label">Type:</span><span className="info-value">{info?.type || '-'}</span></div>
          <div className="info-row"><span className="info-label">Size:</span><span className="info-value">{info ? formatFileSize(info.size) : '-'}</span></div>
          <div className="info-row"><span className="info-label">Duration:</span><span className="info-value">{formatTime(player.duration)}</span></div>
        </div>
      )}
      {tab === 'codec' && (
        <div className="info-grid">
          <div className="info-row"><span className="info-label">Resolution:</span><span className="info-value">{player.videoSize.w ? `${player.videoSize.w}×${player.videoSize.h}` : 'N/A'}</span></div>
          <div className="info-row"><span className="info-label">Video Codec:</span><span className="info-value">{info?.mimeType || '-'}</span></div>
        </div>
      )}
      {tab === 'statistics' && (
        <div className="info-grid">
          <div className="info-row"><span className="info-label">Current Time:</span><span className="info-value">{formatTime(player.currentTime)}</span></div>
          <div className="info-row"><span className="info-label">Buffered:</span><span className="info-value">{(player.buffered * 100).toFixed(1)}%</span></div>
        </div>
      )}
    </Dialog>
  );
}

// ===== Effects and Filters Dialog =====
export function EffectsDialog({ open, onClose, eqEnabled, setEqEnabled, eqBands, setEqBands, eqPreset, setEqPreset }) {
  const { player } = usePlayerContext();
  const [tab, setTab] = useState('videoEffects');
  const filters = player.videoFilters;

  const updateFilter = (key, value) => {
    player.setVideoFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    player.setVideoFilters({ brightness: 100, contrast: 100, saturation: 100, hue: 0, gamma: 100, rotation: 0, flipH: false, flipV: false });
  };

  const handlePreset = (preset) => {
    setEqPreset(preset);
    const values = EQ_PRESETS[preset];
    if (values) {
      setEqBands([...values]);
      if (eqEnabled) values.forEach((g, i) => player.setEQBand(i, g));
    }
  };

  const handleEqBand = (i, val) => {
    setEqBands(prev => { const n = [...prev]; n[i] = val; return n; });
    if (eqEnabled) player.setEQBand(i, val);
  };

  const handleEqToggle = (checked) => {
    setEqEnabled(checked);
    if (checked) eqBands.forEach((g, i) => player.setEQBand(i, g));
    else eqBands.forEach((_, i) => player.setEQBand(i, 0));
  };

  const sliders = [
    { key: 'brightness', label: 'Brightness', min: 0, max: 200, fmt: v => v + '%' },
    { key: 'contrast', label: 'Contrast', min: 0, max: 200, fmt: v => v + '%' },
    { key: 'saturation', label: 'Saturation', min: 0, max: 200, fmt: v => v + '%' },
    { key: 'hue', label: 'Hue', min: 0, max: 360, fmt: v => v + '°' },
    { key: 'gamma', label: 'Gamma', min: 10, max: 300, fmt: v => (v / 100).toFixed(2) },
    { key: 'rotation', label: 'Rotation', min: 0, max: 360, fmt: v => v + '°' },
  ];

  return (
    <Dialog open={open} onClose={onClose} title="Adjustments and Effects" wide
      footer={<><button className="dialog-btn" onClick={handleReset}>Reset</button><button className="dialog-btn primary" onClick={onClose}>Close</button></>}>
      <div className="dialog-tabs">
        <button className={`dialog-tab${tab === 'videoEffects' ? ' active' : ''}`} onClick={() => setTab('videoEffects')}>Video Effects</button>
        <button className={`dialog-tab${tab === 'audioEffects' ? ' active' : ''}`} onClick={() => setTab('audioEffects')}>Audio Effects</button>
      </div>
      {tab === 'videoEffects' && (
        <>
          <div className="effects-section">
            <h4>Image Adjust</h4>
            {sliders.map(s => (
              <div className="effect-row" key={s.key}>
                <label>{s.label}</label>
                <input type="range" className="effect-slider" min={s.min} max={s.max} value={filters[s.key]}
                  onChange={e => updateFilter(s.key, parseInt(e.target.value))} />
                <span className="effect-value">{s.fmt(filters[s.key])}</span>
              </div>
            ))}
          </div>
          <div className="effects-section">
            <h4>Transform</h4>
            <div className="effect-row checkbox-row">
              <label><input type="checkbox" checked={filters.flipH} onChange={e => updateFilter('flipH', e.target.checked)} /> Flip Horizontal</label>
            </div>
            <div className="effect-row checkbox-row">
              <label><input type="checkbox" checked={filters.flipV} onChange={e => updateFilter('flipV', e.target.checked)} /> Flip Vertical</label>
            </div>
          </div>
        </>
      )}
      {tab === 'audioEffects' && (
        <>
          <div className="effects-section">
            <h4>Equalizer</h4>
            <div className="effect-row checkbox-row">
              <label><input type="checkbox" checked={eqEnabled} onChange={e => handleEqToggle(e.target.checked)} /> Enable</label>
            </div>
            <div className="equalizer-container">
              <div className="eq-bands">
                {EQ_LABELS.map((label, i) => (
                  <div className="eq-band" key={label}>
                    <input type="range" className="eq-slider vertical" min={-20} max={20} value={eqBands[i] || 0}
                      orient="vertical" onChange={e => handleEqBand(i, parseInt(e.target.value))} />
                    <label>{label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="eq-presets">
              <label>Preset:</label>
              <select className="dialog-select" value={eqPreset} onChange={e => handlePreset(e.target.value)}>
                {Object.keys(EQ_PRESETS).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </>
      )}
    </Dialog>
  );
}

// ===== Track Synchronization Dialog =====
export function TrackSyncDialog({ open, onClose, subSyncOffset, setSubSyncOffset }) {
  const [audioSync, setAudioSync] = useState(0);
  return (
    <Dialog open={open} onClose={onClose} title="Track Synchronization"
      footer={<button className="dialog-btn primary" onClick={onClose}>Close</button>}>
      <div className="dialog-section">
        <h4>Audio/Video</h4>
        <div className="sync-row">
          <label>Audio track synchronization:</label>
          <div className="sync-input">
            <button className="sync-btn" onClick={() => setAudioSync(v => +(v - 0.05).toFixed(3))}>−</button>
            <input type="number" className="sync-value-input" value={audioSync.toFixed(3)} step="0.050" readOnly />
            <button className="sync-btn" onClick={() => setAudioSync(v => +(v + 0.05).toFixed(3))}>+</button>
            <span>s</span>
          </div>
        </div>
      </div>
      <div className="dialog-section">
        <h4>Subtitles/Video</h4>
        <div className="sync-row">
          <label>Subtitle track synchronization:</label>
          <div className="sync-input">
            <button className="sync-btn" onClick={() => setSubSyncOffset(v => +(v - 0.05).toFixed(3))}>−</button>
            <input type="number" className="sync-value-input" value={subSyncOffset.toFixed(3)} step="0.050" readOnly />
            <button className="sync-btn" onClick={() => setSubSyncOffset(v => +(v + 0.05).toFixed(3))}>+</button>
            <span>s</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ===== Preferences Dialog =====
export function PreferencesDialog({ open, onClose }) {
  const [category, setCategory] = useState('interface');
  const categories = [
    { key: 'interface', icon: '🖥️', label: 'Interface' },
    { key: 'video', icon: '🎬', label: 'Video' },
    { key: 'audio', icon: '🔊', label: 'Audio' },
    { key: 'subtitles', icon: '💬', label: 'Subtitles' },
    { key: 'hotkeys', icon: '⌨️', label: 'Hotkeys' },
  ];
  const hotkeys = [
    ['Play/Pause', 'Space'], ['Stop', 'S'], ['Next', 'N'], ['Previous', 'P'],
    ['Fullscreen', 'F / F11'], ['Mute', 'M'], ['Volume Up', '↑ / Ctrl+↑'], ['Volume Down', '↓ / Ctrl+↓'],
    ['Seek Forward 10s', '→'], ['Seek Backward 10s', '←'], ['Seek Forward 1min', 'Shift+→'],
    ['Seek Backward 1min', 'Shift+←'], ['Faster', ']'], ['Slower', '['], ['Normal Speed', '='],
    ['Snapshot', 'Shift+S'], ['Open File', 'Ctrl+O'], ['Playlist', 'Ctrl+L'],
    ['Network Stream', 'Ctrl+N'],
    ['Effects', 'Ctrl+E'], ['Media Info', 'Ctrl+I'],
  ];
  return (
    <Dialog open={open} onClose={onClose} title="Simple Preferences" wide
      footer={<><button className="dialog-btn primary" onClick={onClose}>Save</button><button className="dialog-btn" onClick={onClose}>Cancel</button></>}>
      <div className="pref-layout">
        <div className="pref-sidebar">
          {categories.map(c => (
            <div key={c.key} className={`pref-category${category === c.key ? ' active' : ''}`} onClick={() => setCategory(c.key)}>
              {c.icon} {c.label}
            </div>
          ))}
        </div>
        <div className="pref-content">
          {category === 'interface' && (
            <div className="pref-page active">
              <h4>Interface Settings</h4>
              <div className="pref-row checkbox-row"><label><input type="checkbox" /> Start in minimal mode</label></div>
              <div className="pref-row checkbox-row"><label><input type="checkbox" /> Show playlist on startup</label></div>
              <div className="pref-row checkbox-row"><label><input type="checkbox" defaultChecked /> Remember window size</label></div>
            </div>
          )}
          {category === 'video' && (
            <div className="pref-page active">
              <h4>Video Settings</h4>
              <div className="pref-row">
                <label>Default aspect ratio:</label>
                <select className="dialog-select"><option>Auto</option><option>16:9</option><option>4:3</option><option>1:1</option></select>
              </div>
            </div>
          )}
          {category === 'audio' && (
            <div className="pref-page active">
              <h4>Audio Settings</h4>
              <div className="pref-row"><label>Default volume:</label><input type="range" min="0" max="200" defaultValue="100" /></div>
            </div>
          )}
          {category === 'subtitles' && (
            <div className="pref-page active">
              <h4>Subtitle Settings</h4>
              <div className="pref-row"><label>Default encoding:</label>
                <select className="dialog-select"><option>UTF-8</option><option>ISO 8859-1</option></select>
              </div>
              <div className="pref-row"><label>Font size:</label>
                <select className="dialog-select"><option>Small</option><option>Normal</option><option>Large</option></select>
              </div>
            </div>
          )}
          {category === 'hotkeys' && (
            <div className="pref-page active">
              <h4>Keyboard Shortcuts</h4>
              <div className="hotkey-list">
                {hotkeys.map(([action, key]) => (
                  <div className="hotkey-row" key={action}><span>{action}</span><span className="hotkey-key">{key}</span></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

// ===== About Dialog =====
export function AboutDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} title="About"
      footer={<button className="dialog-btn primary" onClick={onClose}>OK</button>}>
      <div className="about-body">
        <AppLogo size={80} />
        <h2>KnickPlayer</h2>
        <p className="about-version">Online Media Player 1.0.0</p>
        <p className="about-desc">A powerful online video and audio player by KnickLab.<br />Play 50+ formats directly in your browser — no uploads, fully private.</p>
        <p className="about-copy">&copy; KnickLab &middot; <a href="https://www.knicklab.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>www.knicklab.com</a></p>
      </div>
    </Dialog>
  );
}
