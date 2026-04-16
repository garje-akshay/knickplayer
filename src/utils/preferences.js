const STORAGE_KEY = 'kp-preferences';

const DEFAULTS = {
  volume: 0.8,
  playbackRate: 1,
  eqEnabled: false,
  eqPreset: 'flat',
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  subtitleFontSize: 'normal',
  subtitleColor: '#ffffff',
  showPlaylist: false,
  showStatusBar: true,
};

export function loadPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch (e) {
    console.warn('Failed to load preferences:', e);
  }
  return { ...DEFAULTS };
}

export function savePreference(key, value) {
  try {
    const current = loadPreferences();
    current[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Failed to save preference:', e);
  }
}

export function savePreferences(prefs) {
  try {
    const current = loadPreferences();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch (e) {
    console.warn('Failed to save preferences:', e);
  }
}
