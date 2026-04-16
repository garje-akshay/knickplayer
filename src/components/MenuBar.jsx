import React, { useState, useEffect, useRef } from 'react';

const MENUS = {
  media: {
    label: <><u>M</u>edia</>,
    items: [
      { action: 'openFile', label: <>Open <u>F</u>ile...</>, shortcut: 'Ctrl+O' },
      { action: 'openMultiple', label: <>Open <u>M</u>ultiple Files...</>, shortcut: 'Ctrl+Shift+O' },
      { action: 'openFolder', label: <>Open Fol<u>d</u>er...</> },
      { action: 'openNetwork', label: <>Open <u>N</u>etwork Stream...</>, shortcut: 'Ctrl+N' },
      'separator',
      { action: 'transcode', label: <>Convert / <u>T</u>ranscode...</> },
      { action: 'screenCapture', label: <>Screen <u>C</u>apture...</>, shortcut: 'Ctrl+R' },
      { action: 'webcamCapture', label: <>Open Capture <u>D</u>evice (Webcam)...</> },
      'separator',
      { action: 'mediaLibrary', label: <>Media <u>L</u>ibrary...</> },
      'separator',
      { action: 'quit', label: <><u>Q</u>uit</>, shortcut: 'Ctrl+Q' },
    ],
  },
  playback: {
    label: <><u>P</u>layback</>,
    items: [
      { action: 'jumpForward', label: 'Jump Forward', shortcut: 'Shift+→' },
      { action: 'jumpBackward', label: 'Jump Backward', shortcut: 'Shift+←' },
      { action: 'jumpSpecific', label: 'Jump to Specific Time', shortcut: 'Ctrl+T' },
      'separator',
      { action: 'frameNext', label: 'Next Frame', shortcut: 'E' },
      { action: 'framePrev', label: 'Previous Frame', shortcut: 'Shift+E' },
      'separator',
      { action: 'recordStream', label: 'Record Playing Stream' },
    ],
  },
  audio: {
    label: <><u>A</u>udio</>,
    items: [
      { action: 'volumeUp', label: 'Increase Volume', shortcut: 'Ctrl+↑' },
      { action: 'volumeDown', label: 'Decrease Volume', shortcut: 'Ctrl+↓' },
      { action: 'mute', label: <><u>M</u>ute</>, shortcut: 'M' },
    ],
  },
  video: {
    label: <><u>V</u>ideo</>,
    items: [
      { action: 'fullscreen', label: <><u>F</u>ullscreen</>, shortcut: 'F' },
      { action: 'pip', label: 'Picture-in-Picture' },
      'separator',
      { action: 'aspectDefault', label: 'Default (Letterbox)', radioGroup: 'aspect' },
      { action: 'aspectFit', label: 'Fit to Window', radioGroup: 'aspect' },
      { action: 'aspectCrop', label: 'Crop to Fill', radioGroup: 'aspect' },
      { action: 'aspectStretch', label: 'Stretch to Fill', radioGroup: 'aspect' },
      'separator',
      { action: 'aspect16:9', label: 'Force 16:9', radioGroup: 'aspect' },
      { action: 'aspect4:3', label: 'Force 4:3', radioGroup: 'aspect' },
      { action: 'aspect1:1', label: 'Force 1:1 (Square)', radioGroup: 'aspect' },
      { action: 'aspect16:10', label: 'Force 16:10', radioGroup: 'aspect' },
      { action: 'aspect2.35:1', label: 'Force 2.35:1 (Cinemascope)', radioGroup: 'aspect' },
      { action: 'aspect2.39:1', label: 'Force 2.39:1 (Anamorphic)', radioGroup: 'aspect' },
      { action: 'aspect5:4', label: 'Force 5:4', radioGroup: 'aspect' },
      'separator',
      { action: 'zoomIn', label: 'Zoom In', shortcut: 'Ctrl+Scroll ↑' },
      { action: 'zoomOut', label: 'Zoom Out', shortcut: 'Ctrl+Scroll ↓' },
      { action: 'zoomReset', label: 'Reset Zoom', shortcut: 'Ctrl+0' },
      'separator',
      { action: 'snapshot', label: <>Take <u>S</u>napshot</>, shortcut: 'Shift+S' },
    ],
  },
  subtitle: {
    label: <><u>S</u>ubtitle</>,
    items: [
      { action: 'addSubtitle', label: <><u>A</u>dd Subtitle File...</> },
    ],
  },
  tools: {
    label: <><u>T</u>ools</>,
    items: [
      { action: 'effects', label: <><u>E</u>ffects and Filters</>, shortcut: 'Ctrl+E' },
      { action: 'trackSync', label: <>Track <u>S</u>ynchronization</> },
      { action: 'mediaInfo', label: <>Media <u>I</u>nformation</>, shortcut: 'Ctrl+I' },
      { action: 'codecInfo', label: <><u>C</u>odec Information</>, shortcut: 'Ctrl+J' },
      { action: 'streamInfo', label: <>Stream <u>Q</u>uality / Info</> },
      'separator',
      { action: 'pluginManager', label: <>Extensions / <u>P</u>lugins...</> },
      'separator',
      { action: 'preferences', label: <>Pr<u>e</u>ferences</>, shortcut: 'Ctrl+P' },
    ],
  },
  view: {
    label: <>V<u>i</u>ew</>,
    items: [
      { action: 'playlist', label: <><u>P</u>laylist</>, shortcut: 'Ctrl+L' },
      'separator',
      { action: 'statusBar', label: <>Status <u>B</u>ar</>, checkable: true, defaultChecked: true },
    ],
  },
  help: {
    label: <><u>H</u>elp</>,
    items: [
      { action: 'about', label: <><u>A</u>bout</> },
    ],
  },
};

export default function MenuBar({ onAction }) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const barRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      const inBar = barRef.current && barRef.current.contains(e.target);
      const inOverlay = overlayRef.current && overlayRef.current.contains(e.target);
      if (!inBar && !inOverlay) {
        setActiveMenu(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);

  const handleMenuClick = (key) => {
    setActiveMenu(prev => (prev === key ? null : key));
  };

  const handleMenuEnter = (key) => {
    if (activeMenu) setActiveMenu(key);
  };

  const handleAction = (action) => {
    setActiveMenu(null);
    setMobileMenuOpen(false);
    onAction(action);
  };

  return (
    <>
      <div className="menu-bar" ref={barRef}>
        <div className="menu-main">
          {Object.entries(MENUS).map(([key, menu]) => (
            <div
              key={key}
              className={`menu-item${activeMenu === key ? ' active' : ''}`}
              onClick={() => handleMenuClick(key)}
              onMouseEnter={() => handleMenuEnter(key)}
            >
              <span className="menu-label">{menu.label}</span>
              {activeMenu === key && (
                <div className="menu-dropdown" onClick={(e) => e.stopPropagation()}>
                  {menu.items.map((item, i) =>
                    item === 'separator' ? (
                      <div key={i} className="menu-separator" />
                    ) : (
                      <div
                        key={item.action}
                        className={`menu-entry${item.checkable ? ' checkable' : ''}${item.defaultChecked ? ' checked' : ''}`}
                        onClick={() => handleAction(item.action)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                        {item.arrow && <span className="arrow">&#9654;</span>}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(open => !open)} aria-label="Open menu">
          <span>☰</span>
        </button>
      </div>

      <div
        className={`mobile-menu-overlay${mobileMenuOpen ? ' open' : ''}`}
        ref={overlayRef}
        onClick={(e) => { if (e.target === e.currentTarget) setMobileMenuOpen(false); }}
      >
        <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
          <div className="mobile-menu-header">
            <span>Menu</span>
            <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
              ✕
            </button>
          </div>
          {Object.entries(MENUS).map(([key, menu]) => (
            <div key={key} className="mobile-menu-section">
              <div className="mobile-menu-section-title">{menu.label}</div>
              {menu.items.map((item, i) =>
                item === 'separator' ? (
                  <div key={i} className="mobile-menu-separator" />
                ) : (
                  <button
                    key={item.action}
                    className="mobile-menu-item"
                    onClick={() => handleAction(item.action)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="mobile-menu-shortcut">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
