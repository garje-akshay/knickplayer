/**
 * Subtitle parser — SRT, VTT, ASS/SSA
 */
export function parseSRT(text) {
  const cues = [];
  const blocks = text.trim().replace(/\r\n/g, '\n').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    let tsLine = lines.findIndex(l => l.includes('-->'));
    if (tsLine === -1) continue;
    const [startStr, endStr] = lines[tsLine].split('-->').map(s => s.trim());
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    const t = lines.slice(tsLine + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '');
    if (start !== null && end !== null && t) cues.push({ start, end, text: t });
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function parseVTT(text) {
  return parseSRT(text.replace(/^WEBVTT.*\n/, '').trim());
}

export function parseASS(text) {
  const cues = [];
  const lines = text.split(/\r?\n/);
  let inEvents = false;
  let formatFields = [];
  for (const line of lines) {
    if (line.startsWith('[Events]')) { inEvents = true; continue; }
    if (line.startsWith('[') && line.endsWith(']')) { inEvents = false; continue; }
    if (!inEvents) continue;
    if (line.startsWith('Format:')) {
      formatFields = line.substring(7).split(',').map(s => s.trim().toLowerCase());
    } else if (line.startsWith('Dialogue:')) {
      const values = line.substring(9).split(',');
      const si = formatFields.indexOf('start');
      const ei = formatFields.indexOf('end');
      const ti = formatFields.indexOf('text');
      if (si >= 0 && ei >= 0 && ti >= 0) {
        const start = parseASSTimestamp(values[si]?.trim());
        const end = parseASSTimestamp(values[ei]?.trim());
        const raw = values.slice(ti).join(',').trim().replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').replace(/\\n/g, '\n');
        if (start !== null && end !== null && raw) cues.push({ start, end, text: raw });
      }
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

function parseTimestamp(str) {
  if (!str) return null;
  const c = str.replace(',', '.').trim();
  const p = c.split(':');
  if (p.length === 3) return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
  if (p.length === 2) return parseFloat(p[0]) * 60 + parseFloat(p[1]);
  return null;
}

function parseASSTimestamp(str) {
  if (!str) return null;
  const p = str.split(':');
  if (p.length === 3) return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
  return null;
}

export async function loadSubtitleFile(file) {
  const text = await file.text();
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'vtt') return parseVTT(text);
  if (ext === 'ass' || ext === 'ssa') return parseASS(text);
  return parseSRT(text);
}
