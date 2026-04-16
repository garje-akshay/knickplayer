import React, { useMemo } from 'react';

function findCue(cues, time) {
  // Binary search for the active cue at the given time
  let lo = 0, hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid];
    if (time < c.start) hi = mid - 1;
    else if (time > c.end) lo = mid + 1;
    else return c;
  }
  return null;
}

export default function SubtitleDisplay({ cues, currentTime, syncOffset }) {
  // Ensure cues are sorted by start time (should already be, but defensive)
  const sortedCues = useMemo(() => {
    if (!cues || cues.length === 0) return [];
    const sorted = [...cues];
    sorted.sort((a, b) => a.start - b.start);
    return sorted;
  }, [cues]);

  if (sortedCues.length === 0) return null;
  const adjTime = currentTime + (syncOffset || 0);
  const cue = findCue(sortedCues, adjTime);
  if (!cue) return null;
  return (
    <div className="subtitle-display">{cue.text}</div>
  );
}
