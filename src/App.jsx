import React, { useState, useCallback, useEffect, useRef } from 'react';
import { PlayerContext } from './hooks/PlayerContext';
import usePlayer from './hooks/usePlayer';
import usePlaylist from './hooks/usePlaylist';
import useFFmpeg from './hooks/useFFmpeg';
import useScreenCapture from './hooks/useScreenCapture';
import useMediaLibrary from './hooks/useMediaLibrary';
import useStreamPlayer from './hooks/useStreamPlayer';
import usePlugins from './hooks/usePlugins';
import TitleBar from './components/TitleBar';
import MenuBar from './components/MenuBar';
import VideoArea from './components/VideoArea';
import Controls from './components/Controls';
import Playlist from './components/Playlist';
import StatusBar from './components/StatusBar';
import SubtitleDisplay from './components/SubtitleDisplay';
import { NetworkDialog, JumpDialog, MediaInfoDialog, EffectsDialog, TrackSyncDialog, PreferencesDialog, AboutDialog } from './components/Dialogs';
import { TranscodeDialog, ScreenCaptureDialog, MediaLibraryDialog, StreamInfoDialog, PluginManagerDialog } from './components/Phase3Dialogs';
import { loadSubtitleFile } from './utils/subtitleParser';
import { MEDIA_EXTENSIONS } from './utils/helpers';
import { loadPreferences, savePreference } from './utils/preferences';

export default function App() {
  const prefs = useRef(loadPreferences()).current;
  const player = usePlayer();
  const playlist = usePlaylist(player);

  // Phase 3 hooks
  const ffmpeg = useFFmpeg();
  const capture = useScreenCapture();
  const library = useMediaLibrary();
  const stream = useStreamPlayer();
  const plugins = usePlugins();
  // Connect stream player to usePlayer's loadUrl
  useEffect(() => {
    player.streamAttachRef.current = stream.attachStream;
    return () => { player.streamAttachRef.current = null; };
  }, [player.streamAttachRef, stream.attachStream]);

  // Init saved plugins on mount
  useEffect(() => { plugins.initSavedPlugins(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-load FFmpeg WASM during idle time so it's ready when needed
  useEffect(() => { ffmpeg.preload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // UI state
  const [playlistVisible, setPlaylistVisible] = useState(prefs.showPlaylist);
  const [statusBarVisible, setStatusBarVisible] = useState(prefs.showStatusBar);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusText, setStatusText] = useState('Ready — Drop media files or use Media → Open File');
  const [transcodingFile, setTranscodingFile] = useState(null);

  // Dialog state (Phase 1 + 2)
  const [networkOpen, setNetworkOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [mediaInfoOpen, setMediaInfoOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [trackSyncOpen, setTrackSyncOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // Dialog state (Phase 3)
  const [transcodeOpen, setTranscodeOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [streamInfoOpen, setStreamInfoOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  // Subtitle state
  const [subtitleCues, setSubtitleCues] = useState([]);
  const [subSyncOffset, setSubSyncOffset] = useState(0);

  // EQ state
  const [eqEnabled, setEqEnabled] = useState(prefs.eqEnabled);
  const [eqBands, setEqBands] = useState(prefs.eqBands);
  const [eqPreset, setEqPreset] = useState(prefs.eqPreset);

  // Persist preferences on change
  useEffect(() => { savePreference('volume', player.volume); }, [player.volume]);
  useEffect(() => { savePreference('eqEnabled', eqEnabled); }, [eqEnabled]);
  useEffect(() => { savePreference('eqPreset', eqPreset); }, [eqPreset]);
  useEffect(() => { savePreference('eqBands', eqBands); }, [eqBands]);
  useEffect(() => { savePreference('showPlaylist', playlistVisible); }, [playlistVisible]);
  useEffect(() => { savePreference('showStatusBar', statusBarVisible); }, [statusBarVisible]);

  // Apply saved volume on mount
  useEffect(() => { player.setVolume(prefs.volume); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // File input refs
  const fileInputRef = useRef(null);
  const subtitleInputRef = useRef(null);
  const folderInputRef = useRef(null);

  // Title
  const title = player.mediaInfo ? `${player.mediaInfo.name} - KnickPlayer` : 'KnickPlayer';
  const resolution = player.videoSize.w ? `${player.videoSize.w}\u00d7${player.videoSize.h}` : '';

  // Status updates
  useEffect(() => {
    if (player.isPlaying) setStatusText('Playing');
    else if (player.isStopped) setStatusText('Stopped');
    else setStatusText('Paused');
  }, [player.isPlaying, player.isStopped]);

  useEffect(() => {
    if (player.mediaInfo) setStatusText(`Playing: ${player.mediaInfo.name}`);
  }, [player.mediaInfo]);

  // Update playlist item duration once media metadata is loaded
  useEffect(() => {
    if (player.duration > 0 && playlist.currentIndex >= 0) {
      playlist.updateDuration(playlist.currentIndex, player.duration);
    }
  }, [player.duration, playlist.currentIndex, playlist]);

  useEffect(() => {
    // Don't show native player errors while FFmpeg fallback is in progress
    if (player.error && !fallbackActiveRef.current) {
      setStatusText(`Error: ${player.error}`);
    }
  }, [player.error]);

  // Plugin event emission
  useEffect(() => {
    if (player.isPlaying) plugins.emit('onPlay', player.mediaInfo);
    else if (player.isStopped) plugins.emit('onStop');
    else plugins.emit('onPause');
  }, [player.isPlaying, player.isStopped]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track media in library when playing
  useEffect(() => {
    if (player.mediaInfo && player.isPlaying) {
      library.addMedia(
        { ...player.mediaInfo, duration: player.duration },
        player.videoRef.current
      );
    }
  }, [player.mediaInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save playback position every 5 seconds via interval
  useEffect(() => {
    if (!player.mediaInfo || player.isStopped) return;
    const interval = setInterval(() => {
      const v = player.videoRef.current;
      if (v && v.currentTime > 0 && player.mediaInfo) {
        library.savePosition(player.mediaInfo.name, v.currentTime);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [player.mediaInfo, player.isStopped, player.videoRef, library]);

  // Auto-play next on ended — use the video element's 'ended' event directly
  useEffect(() => {
    const v = player.videoRef.current;
    if (!v) return;
    const onEnded = () => {
      playlist.playNext();
    };
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  }, [player.videoRef, playlist]);

  // Track whether we're attempting FFmpeg fallback (suppresses premature error display)
  const fallbackActiveRef = useRef(false);

  // Handle files dropped via drag & drop (with FFmpeg fallback for non-native)
  const loadFileWithFallback = useCallback(async (file) => {
    fallbackActiveRef.current = false;

    // Always try native browser playback first — it's instant
    const result = await player.loadFile(file);
    if (result !== null) return; // Browser handled it natively

    // Browser can't play it — fall back to FFmpeg WASM decode
    fallbackActiveRef.current = true;
    setTranscodingFile(file.name);
    setStatusText(`Decoding ${file.name} via FFmpeg...`);
    try {
      if (!ffmpeg.isLoaded) await ffmpeg.load();
      const decoded = await ffmpeg.decodeForPlayback(file);
      setTranscodingFile(null);
      if (decoded) {
        const url = URL.createObjectURL(decoded.blob);
        await player.loadUrl(url);
        setStatusText(`Playing (transcoded): ${file.name}`);
      } else {
        setStatusText(`Cannot play: ${file.name}`);
      }
    } catch (e) {
      setTranscodingFile(null);
      setStatusText(`Cannot decode: ${file.name} — ${e.message}`);
    } finally {
      fallbackActiveRef.current = false;
      setTranscodingFile(null);
    }
  }, [player, ffmpeg]);

  const handleFilesDropped = useCallback((files) => {
    const newItems = playlist.addFiles(files);
    if (newItems.length > 0 && newItems[0].file) {
      loadFileWithFallback(newItems[0].file).then(() => player.play());
    }
  }, [playlist, player, loadFileWithFallback]);

  // File input handlers
  const handleFileInput = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      playlist.addFiles(files);
      loadFileWithFallback(files[0]).then(() => player.play());
    }
    e.target.value = '';
  }, [playlist, player, loadFileWithFallback]);

  const handleSubtitleInput = useCallback(async (e) => {
    if (e.target.files.length > 0) {
      const cues = await loadSubtitleFile(e.target.files[0]);
      setSubtitleCues(cues);
      setStatusText(`Loaded ${cues.length} subtitle cues`);
    }
    e.target.value = '';
  }, []);

  const handleFolderInput = useCallback((e) => {
    const mediaFiles = Array.from(e.target.files).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return MEDIA_EXTENSIONS.includes(ext);
    });
    if (mediaFiles.length > 0) {
      playlist.addFiles(mediaFiles);
      loadFileWithFallback(mediaFiles[0]).then(() => player.play());
    }
    e.target.value = '';
  }, [playlist, player, loadFileWithFallback]);

  // Play recording from screen capture
  const handlePlayRecording = useCallback((file) => {
    playlist.addFiles([file]);
    player.loadFile(file).then(() => player.play());
  }, [playlist, player]);

  // Play from media library
  const handlePlayFromLibrary = useCallback(async (item) => {
    // Library items don't store the actual file — only metadata.
    // Set status to prompt user to re-open the file.
    setStatusText(`Resume: ${item.name} — re-open the file to continue from ${Math.floor(item.lastPosition || 0)}s`);
    setLibraryOpen(false);
  }, []);

  // Fullscreen
  const fsTimerRef = useRef(null);
  const [fsControlsVisible, setFsControlsVisible] = useState(false);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(f => {
      const next = !f;
      if (next) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
        setFsControlsVisible(false);
      }
      return next;
    });
  }, []);

  // Show/hide controls on mouse move in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleMove = () => {
      setFsControlsVisible(true);
      if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
      fsTimerRef.current = setTimeout(() => setFsControlsVisible(false), 3000);
    };
    document.addEventListener('mousemove', handleMove);
    // Show initially
    handleMove();
    return () => {
      document.removeEventListener('mousemove', handleMove);
      if (fsTimerRef.current) clearTimeout(fsTimerRef.current);
    };
  }, [isFullscreen]);

  useEffect(() => {
    const handler = () => toggleFullscreen();
    document.addEventListener('kp-toggle-fullscreen', handler);
    const fsChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', fsChange);
    const openFile = () => fileInputRef.current?.click();
    document.addEventListener('kp-open-file', openFile);
    return () => {
      document.removeEventListener('kp-toggle-fullscreen', handler);
      document.removeEventListener('fullscreenchange', fsChange);
      document.removeEventListener('kp-open-file', openFile);
    };
  }, [toggleFullscreen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      switch (e.key) {
        case ' ': e.preventDefault(); player.togglePlay(); break;
        case 's': if (!ctrl && shift) { player.takeSnapshot(); } else if (!ctrl && !shift) { player.stop(); } break;
        case 'S': if (!ctrl) player.takeSnapshot(); break;
        case 'f': if (!ctrl) { e.preventDefault(); toggleFullscreen(); } break;
        case 'F11': e.preventDefault(); toggleFullscreen(); break;
        case 'Escape': if (isFullscreen) toggleFullscreen(); break;
        case 'm': case 'M': if (!ctrl) player.toggleMute(); break;
        case 'ArrowUp': e.preventDefault(); player.setVolume(player.volume + 0.05); break;
        case 'ArrowDown': e.preventDefault(); player.setVolume(player.volume - 0.05); break;
        case 'ArrowRight': e.preventDefault(); player.seekRelative(shift ? 60 : 10); break;
        case 'ArrowLeft': e.preventDefault(); player.seekRelative(shift ? -60 : -10); break;
        case 'n': case 'N': if (ctrl) { e.preventDefault(); setNetworkOpen(true); } else if (!shift) playlist.playNext(); break;
        case 'p': case 'P': if (!ctrl && !shift) playlist.playPrev(); break;
        case ']': if (!ctrl) player.setSpeed(Math.min(4, player.playbackRate + 0.25)); break;
        case '[': if (!ctrl) player.setSpeed(Math.max(0.25, player.playbackRate - 0.25)); break;
        case '=': if (!ctrl) player.setSpeed(1); break;
        case 'o': if (ctrl) { e.preventDefault(); fileInputRef.current?.click(); } break;
        case 'l': case 'L': if (ctrl) { e.preventDefault(); setPlaylistVisible(v => !v); } break;
        case 'e': if (ctrl) { e.preventDefault(); setEffectsOpen(true); } else { e.preventDefault(); player.frameStep(1); } break;
        case 'E': if (ctrl) { e.preventDefault(); setEffectsOpen(true); } else { e.preventDefault(); player.frameStep(-1); } break;
        case 'i': case 'I': if (ctrl) { e.preventDefault(); setMediaInfoOpen(true); } break;
        case 't': case 'T': if (ctrl) { e.preventDefault(); setJumpOpen(true); } break;
        case 'a': case 'A': if (!ctrl) { player.cycleAspectRatio(); } break;
        case '0': if (ctrl) { e.preventDefault(); player.resetZoom(); setStatusText('Zoom: 100%'); } break;
        case '+': if (ctrl) { e.preventDefault(); player.zoomIn(); } break;
        case '-': if (ctrl) { e.preventDefault(); player.zoomOut(); } break;
        case 'r': case 'R': if (ctrl) { e.preventDefault(); setCaptureOpen(true); } break;
        case 'j': case 'J': if (ctrl) { e.preventDefault(); setStreamInfoOpen(true); } break;
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [player, playlist, toggleFullscreen, isFullscreen]);

  // Menu action handler
  const handleMenuAction = useCallback((action) => {
    switch (action) {
      case 'openFile': fileInputRef.current?.click(); break;
      case 'openMultiple': fileInputRef.current.multiple = true; fileInputRef.current?.click(); break;
      case 'openFolder': folderInputRef.current?.click(); break;
      case 'openNetwork': setNetworkOpen(true); break;
      case 'quit': if (confirm('Close KnickPlayer?')) window.close(); break;
      case 'jumpForward': player.seekRelative(60); break;
      case 'jumpBackward': player.seekRelative(-60); break;
      case 'jumpSpecific': setJumpOpen(true); break;
      case 'fullscreen': toggleFullscreen(); break;
      case 'aspectDefault': player.setAspectRatio('default'); setStatusText('Display: Default (Letterbox)'); break;
      case 'aspectFit': player.setAspectRatio('fit'); setStatusText('Display: Fit to Window'); break;
      case 'aspectCrop': player.setAspectRatio('crop'); setStatusText('Display: Crop to Fill'); break;
      case 'aspectStretch': player.setAspectRatio('stretch'); setStatusText('Display: Stretch to Fill'); break;
      case 'aspect16:9': player.setAspectRatio('16:9'); setStatusText('Display: Force 16:9'); break;
      case 'aspect4:3': player.setAspectRatio('4:3'); setStatusText('Display: Force 4:3'); break;
      case 'aspect1:1': player.setAspectRatio('1:1'); setStatusText('Display: Force 1:1'); break;
      case 'aspect16:10': player.setAspectRatio('16:10'); setStatusText('Display: Force 16:10'); break;
      case 'aspect2.35:1': player.setAspectRatio('2.35:1'); setStatusText('Display: Force 2.35:1'); break;
      case 'aspect2.39:1': player.setAspectRatio('2.39:1'); setStatusText('Display: Force 2.39:1'); break;
      case 'aspect5:4': player.setAspectRatio('5:4'); setStatusText('Display: Force 5:4'); break;
      case 'zoomIn': player.zoomIn(); setStatusText(`Zoom: ${Math.round((player.zoom + 0.25) * 100)}%`); break;
      case 'zoomOut': player.zoomOut(); setStatusText(`Zoom: ${Math.round(Math.max(0.25, player.zoom - 0.25) * 100)}%`); break;
      case 'zoomReset': player.resetZoom(); setStatusText('Zoom: 100%'); break;
      case 'snapshot': player.takeSnapshot(); setStatusText('Snapshot saved'); break;
      case 'volumeUp': player.setVolume(player.volume + 0.05); break;
      case 'volumeDown': player.setVolume(player.volume - 0.05); break;
      case 'mute': player.toggleMute(); break;
      case 'effects': setEffectsOpen(true); break;
      case 'trackSync': setTrackSyncOpen(true); break;
      case 'mediaInfo': case 'codecInfo': setMediaInfoOpen(true); break;
      case 'preferences': setPreferencesOpen(true); break;
      case 'playlist': setPlaylistVisible(v => !v); break;
      case 'statusBar': setStatusBarVisible(v => !v); break;
      case 'about': setAboutOpen(true); break;
      case 'addSubtitle': subtitleInputRef.current?.click(); break;
      case 'frameNext': player.frameStep(1); break;
      case 'framePrev': player.frameStep(-1); break;
      case 'pip': player.requestPiP(); break;
      // Phase 3 actions
      case 'transcode': setTranscodeOpen(true); break;
      case 'screenCapture': setCaptureOpen(true); break;
      case 'webcamCapture': setCaptureOpen(true); break;
      case 'mediaLibrary': setLibraryOpen(true); break;
      case 'streamInfo': setStreamInfoOpen(true); break;
      case 'pluginManager': setPluginsOpen(true); break;
      case 'recordStream': {
        if (player.videoRef.current) {
          const s = stream.captureStream(player.videoRef.current);
          if (s) {
            setStatusText('Recording stream... (stop via Tools > Screen Capture)');
          } else {
            setStatusText('Stream recording not available');
          }
        }
        break;
      }
      default: setStatusText(`${action} (not available in web version)`);
    }
  }, [player, toggleFullscreen, stream]);

  // Context provider value
  const ctxValue = { player, playlist, ffmpeg, stream, library, transcodingFile };

  return (
    <PlayerContext.Provider value={ctxValue}>
      <div className={`kp-app${isFullscreen ? ' fullscreen' : ''}${fsControlsVisible ? ' fs-controls-visible' : ''}`}>
        <TitleBar title={title} />
        <MenuBar onAction={handleMenuAction} />

        <div className="main-content">
          <VideoArea onFilesDropped={handleFilesDropped} />
          <Playlist visible={playlistVisible} />
        </div>

        <Controls />
        <StatusBar visible={statusBarVisible} text={statusText} resolution={resolution}
          streamInfo={stream.streamInfo} />
        <SubtitleDisplay cues={subtitleCues} currentTime={player.currentTime} syncOffset={subSyncOffset} />

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" accept="video/*,audio/*,.mp4,.m4v,.webm,.mkv,.avi,.mov,.flv,.wmv,.ogv,.ogm,.ogx,.mpg,.mpeg,.mpe,.mpv,.mp2v,.m2v,.m1v,.3gp,.3g2,.ts,.mts,.m2ts,.m2t,.vob,.divx,.xvid,.asf,.rm,.rmvb,.f4v,.f4p,.dv,.gxf,.mxf,.nsv,.roq,.nuv,.bik,.smk,.flc,.fli,.rec,.wtv,.dvr-ms,.vp6,.h264,.h265,.hevc,.av1,.vp8,.vp9,.y4m,.yuv,.ivf,.mp3,.wav,.flac,.ogg,.oga,.aac,.wma,.m4a,.m4b,.opus,.ac3,.dts,.aiff,.aif,.ape,.mka,.wv,.tta,.tak,.shn,.ra,.ram,.mid,.midi,.mod,.s3m,.xm,.it,.amr,.awb,.caf,.au,.snd,.spx,.dsf,.dff,.alac,.mp2,.mp1,.mpc,.aa,.aax,.pcm,.gsm,.adts,.w64,.rf64,.swf,.nut,.mj2,.m3u,.m3u8,.pls,.xspf,.cue,.asx,.wpl,.b4s" multiple style={{ display: 'none' }} onChange={handleFileInput} />
        <input ref={subtitleInputRef} type="file" accept=".srt,.vtt,.ass,.ssa,.sub,.idx,.txt" style={{ display: 'none' }} onChange={handleSubtitleInput} />
        <input ref={folderInputRef} type="file" webkitdirectory="" directory="" style={{ display: 'none' }} onChange={handleFolderInput} />

        {/* Phase 1+2 Dialogs */}
        <NetworkDialog open={networkOpen} onClose={() => setNetworkOpen(false)} />
        <JumpDialog open={jumpOpen} onClose={() => setJumpOpen(false)} />
        <MediaInfoDialog open={mediaInfoOpen} onClose={() => setMediaInfoOpen(false)} />
        <EffectsDialog open={effectsOpen} onClose={() => setEffectsOpen(false)}
          eqEnabled={eqEnabled} setEqEnabled={setEqEnabled}
          eqBands={eqBands} setEqBands={setEqBands}
          eqPreset={eqPreset} setEqPreset={setEqPreset} />
        <TrackSyncDialog open={trackSyncOpen} onClose={() => setTrackSyncOpen(false)}
          subSyncOffset={subSyncOffset} setSubSyncOffset={setSubSyncOffset} />
        <PreferencesDialog open={preferencesOpen} onClose={() => setPreferencesOpen(false)} />
        <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

        {/* Phase 3 Dialogs */}
        <TranscodeDialog open={transcodeOpen} onClose={() => setTranscodeOpen(false)}
          ffmpeg={ffmpeg} currentFile={null} />
        <ScreenCaptureDialog open={captureOpen} onClose={() => setCaptureOpen(false)}
          capture={capture} onPlayRecording={handlePlayRecording} />
        <MediaLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)}
          library={library} onPlayMedia={handlePlayFromLibrary} />
        <StreamInfoDialog open={streamInfoOpen} onClose={() => setStreamInfoOpen(false)}
          stream={stream} />
        <PluginManagerDialog open={pluginsOpen} onClose={() => setPluginsOpen(false)}
          plugins={plugins} />
      </div>
    </PlayerContext.Provider>
  );
}
