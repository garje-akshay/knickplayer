import { useState, useCallback, useRef, useEffect } from 'react';
import { detectMediaType } from '../utils/helpers';

export default function usePlaylist(player) {
  const [items, setItems] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none'); // 'none' | 'all' | 'one'
  const shuffleOrder = useRef([]);
  const itemsRef = useRef(items);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const regenerateShuffle = (length) => {
    const order = Array.from({ length }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    shuffleOrder.current = order;
  };

  const updateDuration = useCallback((index, duration) => {
    setItems(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], duration };
      return next;
    });
  }, []);

  const addFiles = useCallback((files) => {
    const newItems = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      file, name: file.name,
      type: detectMediaType(file.name, file.type),
      size: file.size, url: null, duration: 0,
    }));
    setItems(prev => {
      const next = [...prev, ...newItems];
      regenerateShuffle(next.length);
      return next;
    });
    return newItems;
  }, []);

  const addUrl = useCallback((url, name) => {
    const item = { id: Date.now() + Math.random(), file: null, name: name || url, type: 'video', size: 0, url };
    setItems(prev => {
      const next = [...prev, item];
      regenerateShuffle(next.length);
      return next;
    });
    return item;
  }, []);

  const remove = useCallback((index) => {
    setItems(prev => {
      const next = [...prev];
      next.splice(index, 1);
      regenerateShuffle(next.length);
      return next;
    });
    setCurrentIndex(prev => {
      if (prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setCurrentIndex(-1);
    shuffleOrder.current = [];
  }, []);

  const playIndex = useCallback(async (index, itemsList) => {
    const list = itemsList || itemsRef.current;
    if (index < 0 || index >= list.length) return;
    setCurrentIndex(index);
    const item = list[index];
    if (item.file) await player.loadFile(item.file);
    else if (item.url) await player.loadUrl(item.url);
    player.play();
  }, [player]);

  const playNext = useCallback(async () => {
    const curItems = itemsRef.current;
    const curIndex = currentIndexRef.current;
    if (curItems.length === 0) return;
    if (repeat === 'one') { player.seek(0); player.play(); return; }
    let next;
    if (shuffle) {
      const pos = shuffleOrder.current.indexOf(curIndex);
      const nextPos = pos + 1;
      if (nextPos >= shuffleOrder.current.length) {
        if (repeat === 'all') { regenerateShuffle(curItems.length); next = shuffleOrder.current[0]; }
        else { player.stop(); return; }
      } else next = shuffleOrder.current[nextPos];
    } else {
      next = curIndex + 1;
      if (next >= curItems.length) {
        if (repeat === 'all') next = 0;
        else { player.stop(); return; }
      }
    }
    await playIndex(next);
  }, [shuffle, repeat, player, playIndex]);

  const playPrev = useCallback(async () => {
    const curItems = itemsRef.current;
    const curIndex = currentIndexRef.current;
    if (curItems.length === 0) return;
    if (player.videoRef?.current?.currentTime > 3) { player.seek(0); return; }
    let prev;
    if (shuffle) {
      const pos = shuffleOrder.current.indexOf(curIndex);
      prev = pos > 0 ? shuffleOrder.current[pos - 1] : shuffleOrder.current[shuffleOrder.current.length - 1];
    } else {
      prev = curIndex - 1;
      if (prev < 0) prev = curItems.length - 1;
    }
    await playIndex(prev);
  }, [shuffle, player, playIndex]);

  const toggleShuffle = useCallback(() => {
    setShuffle(s => { if (!s) regenerateShuffle(items.length); return !s; });
  }, [items.length]);

  const cycleRepeat = useCallback(() => {
    setRepeat(r => {
      const modes = ['none', 'all', 'one'];
      return modes[(modes.indexOf(r) + 1) % 3];
    });
  }, []);

  return {
    items, currentIndex, shuffle, repeat,
    addFiles, addUrl, remove, clear, playIndex, playNext, playPrev,
    toggleShuffle, cycleRepeat, setCurrentIndex, updateDuration,
  };
}
