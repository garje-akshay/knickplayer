import { useState, useCallback, useEffect, useRef } from 'react';
import { openDB } from 'idb';

/**
 * useMediaLibrary — IndexedDB-backed media library with metadata, thumbnails,
 * playback positions, and recent history.
 *
 * Stores:
 *   - media: { id, name, type, size, mimeType, duration, thumbnail, lastPlayed, playCount, lastPosition, dateAdded }
 *   - history: { id, mediaId, timestamp, position }
 */

const DB_NAME = 'kp-media-library';
const DB_VERSION = 1;

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('media')) {
        const mediaStore = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        mediaStore.createIndex('name', 'name');
        mediaStore.createIndex('lastPlayed', 'lastPlayed');
        mediaStore.createIndex('dateAdded', 'dateAdded');
        mediaStore.createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('history')) {
        const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
        historyStore.createIndex('mediaId', 'mediaId');
        historyStore.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

function generateThumbnail(videoEl) {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, 160, 90);
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.6);
    } catch {
      resolve(null);
    }
  });
}

export default function useMediaLibrary() {
  const [items, setItems] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('lastPlayed'); // 'name' | 'lastPlayed' | 'dateAdded' | 'type'
  const dbRef = useRef(null);

  const ensureDB = useCallback(async () => {
    if (!dbRef.current) dbRef.current = await getDB();
    return dbRef.current;
  }, []);

  // Load all library items
  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await ensureDB();
      const all = await db.getAll('media');
      // Sort
      all.sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
        if (sortBy === 'dateAdded') return (b.dateAdded || 0) - (a.dateAdded || 0);
        if (sortBy === 'type') return (a.type || '').localeCompare(b.type || '');
        return (b.lastPlayed || 0) - (a.lastPlayed || 0); // lastPlayed default
      });
      setItems(all);
    } catch (e) {
      console.warn('Failed to load media library:', e);
    }
    setIsLoading(false);
  }, [ensureDB, sortBy]);

  // Load recent history
  const loadHistory = useCallback(async (limit = 20) => {
    try {
      const db = await ensureDB();
      const all = await db.getAllFromIndex('history', 'timestamp');
      setRecentHistory(all.slice(-limit).reverse());
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
  }, [ensureDB]);

  // Add or update a media entry
  const addMedia = useCallback(async (mediaInfo, videoEl) => {
    try {
      const db = await ensureDB();
      // Check if already exists by name
      const existing = await db.getFromIndex('media', 'name', mediaInfo.name);
      const thumbnail = videoEl ? await generateThumbnail(videoEl) : null;

      if (existing) {
        // Update existing
        existing.lastPlayed = Date.now();
        existing.playCount = (existing.playCount || 0) + 1;
        if (thumbnail) existing.thumbnail = thumbnail;
        if (mediaInfo.duration) existing.duration = mediaInfo.duration;
        await db.put('media', existing);
      } else {
        // Add new
        await db.add('media', {
          name: mediaInfo.name,
          type: mediaInfo.type || 'video',
          size: mediaInfo.size || 0,
          mimeType: mediaInfo.mimeType || '',
          duration: mediaInfo.duration || 0,
          thumbnail,
          lastPlayed: Date.now(),
          playCount: 1,
          lastPosition: 0,
          dateAdded: Date.now(),
        });
      }
      await loadLibrary();
    } catch (e) {
      console.warn('Failed to add media:', e);
    }
  }, [ensureDB, loadLibrary]);

  // Save playback position
  const savePosition = useCallback(async (name, position) => {
    try {
      const db = await ensureDB();
      const existing = await db.getFromIndex('media', 'name', name);
      if (existing) {
        existing.lastPosition = position;
        await db.put('media', existing);
      }
    } catch (e) {
      console.warn('Failed to save position:', e);
    }
  }, [ensureDB]);

  // Get saved position for a media item
  const getPosition = useCallback(async (name) => {
    try {
      const db = await ensureDB();
      const existing = await db.getFromIndex('media', 'name', name);
      return existing?.lastPosition || 0;
    } catch {
      return 0;
    }
  }, [ensureDB]);

  // Add to play history
  const addToHistory = useCallback(async (name, position) => {
    try {
      const db = await ensureDB();
      const existing = await db.getFromIndex('media', 'name', name);
      await db.add('history', {
        mediaId: existing?.id || null,
        mediaName: name,
        timestamp: Date.now(),
        position: position || 0,
      });
      await loadHistory();
    } catch (e) {
      console.warn('Failed to add to history:', e);
    }
  }, [ensureDB, loadHistory]);

  // Delete a media entry
  const deleteMedia = useCallback(async (id) => {
    try {
      const db = await ensureDB();
      await db.delete('media', id);
      await loadLibrary();
    } catch (e) {
      console.warn('Failed to delete media:', e);
    }
  }, [ensureDB, loadLibrary]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    try {
      const db = await ensureDB();
      await db.clear('history');
      setRecentHistory([]);
    } catch (e) {
      console.warn('Failed to clear history:', e);
    }
  }, [ensureDB]);

  // Clear entire library
  const clearLibrary = useCallback(async () => {
    try {
      const db = await ensureDB();
      await db.clear('media');
      await db.clear('history');
      setItems([]);
      setRecentHistory([]);
    } catch (e) {
      console.warn('Failed to clear library:', e);
    }
  }, [ensureDB]);

  // Get stats
  const getStats = useCallback(() => {
    const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
    const videoCount = items.filter(i => i.type === 'video').length;
    const audioCount = items.filter(i => i.type === 'audio').length;
    return { total: items.length, videoCount, audioCount, totalSize };
  }, [items]);

  // Filter items by search
  const filteredItems = searchQuery
    ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : items;

  // Load on mount
  useEffect(() => {
    loadLibrary();
    loadHistory();
  }, [loadLibrary, loadHistory]);

  return {
    items: filteredItems, recentHistory, isLoading,
    searchQuery, setSearchQuery, sortBy, setSortBy,
    addMedia, savePosition, getPosition, addToHistory, deleteMedia,
    clearHistory, clearLibrary, getStats, loadLibrary,
  };
}
