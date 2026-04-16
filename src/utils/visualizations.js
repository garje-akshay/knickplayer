/**
 * Audio Visualization Renderers
 * Each renderer receives: (ctx, canvas, freqData, waveData, time)
 */

// 1. Classic Bars — Orange VLC-style frequency bars
export function drawBars(ctx, canvas, freq) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const barW = (canvas.width / freq.length) * 2;
  let x = 0;
  for (let i = 0; i < freq.length; i++) {
    const h = (freq[i] / 255) * canvas.height;
    const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
    grad.addColorStop(0, '#ff6600');
    grad.addColorStop(0.5, '#ff8800');
    grad.addColorStop(1, '#ffaa00');
    ctx.fillStyle = grad;
    ctx.fillRect(x, canvas.height - h, barW - 1, h);
    x += barW;
  }
}

// 2. Waveform — Green oscilloscope line
export function drawWaveform(ctx, canvas, freq, wave) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!wave) return;
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const sliceW = canvas.width / wave.length;
  let x = 0;
  for (let i = 0; i < wave.length; i++) {
    const y = (wave[i] / 255) * canvas.height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceW;
  }
  ctx.stroke();
}

// 3. Circular — Radial frequency bars in a circle
export function drawCircular(ctx, canvas, freq) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) * 0.35;
  const bars = freq.length / 2;
  for (let i = 0; i < bars; i++) {
    const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const h = (freq[i] / 255) * radius * 1.8;
    const x1 = cx + Math.cos(angle) * radius;
    const y1 = cy + Math.sin(angle) * radius;
    const x2 = cx + Math.cos(angle) * (radius + h);
    const y2 = cy + Math.sin(angle) * (radius + h);
    const hue = (i / bars) * 360;
    ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // Inner circle glow
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(108, 92, 231, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// 4. Spectrum — Gradient filled frequency curve
export function drawSpectrum(ctx, canvas, freq) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, '#ff0066');
  grad.addColorStop(0.33, '#ff6600');
  grad.addColorStop(0.66, '#00ccff');
  grad.addColorStop(1, '#6c5ce7');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  const step = canvas.width / freq.length;
  for (let i = 0; i < freq.length; i++) {
    const h = (freq[i] / 255) * canvas.height * 0.9;
    ctx.lineTo(i * step, canvas.height - h);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
  // Top line
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < freq.length; i++) {
    const h = (freq[i] / 255) * canvas.height * 0.9;
    const x = i * step;
    const y = canvas.height - h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// 5. Particles — Dots that bounce to the beat
const particles = [];
function ensureParticles(count, w, h) {
  while (particles.length < count) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      r: Math.random() * 3 + 1,
      hue: Math.random() * 360,
    });
  }
}

export function drawParticles(ctx, canvas, freq) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const avg = freq.reduce((a, b) => a + b, 0) / freq.length;
  const energy = avg / 255;
  ensureParticles(120, canvas.width, canvas.height);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx * (1 + energy * 4);
    p.y += p.vy * (1 + energy * 4);
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    p.x = Math.max(0, Math.min(canvas.width, p.x));
    p.y = Math.max(0, Math.min(canvas.height, p.y));
    const sz = p.r * (1 + energy * 3);
    ctx.beginPath();
    ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(p.hue + avg) % 360}, 100%, 60%, ${0.5 + energy * 0.5})`;
    ctx.fill();
  }
}

// 6. Mirror Bars — Bars mirrored from center
export function drawMirrorBars(ctx, canvas, freq) {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mid = canvas.height / 2;
  const barW = (canvas.width / freq.length) * 2;
  let x = 0;
  for (let i = 0; i < freq.length; i++) {
    const h = (freq[i] / 255) * mid * 0.9;
    const hue = 200 + (i / freq.length) * 160;
    ctx.fillStyle = `hsl(${hue}, 80%, 55%)`;
    ctx.fillRect(x, mid - h, barW - 1, h);
    ctx.fillStyle = `hsl(${hue}, 80%, 40%)`;
    ctx.fillRect(x, mid, barW - 1, h);
    x += barW;
  }
  // Center line
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(canvas.width, mid);
  ctx.stroke();
}

// 7. Galaxy — Spiral pattern reacting to bass
export function drawGalaxy(ctx, canvas, freq) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const bass = (freq[0] + freq[1] + freq[2] + freq[3]) / (4 * 255);
  const time = Date.now() / 1000;
  for (let i = 0; i < 200; i++) {
    const angle = (i / 200) * Math.PI * 8 + time * 0.5;
    const dist = (i / 200) * Math.min(cx, cy) * 0.9 * (0.5 + bass * 0.8);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const fidx = Math.floor((i / 200) * freq.length);
    const brightness = freq[fidx] / 255;
    const sz = 1 + brightness * 3;
    const hue = (i * 2 + time * 50) % 360;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.3 + brightness * 0.7})`;
    ctx.fill();
  }
}

// 8. Neon Wave — Glowing multi-layered waveform
export function drawNeonWave(ctx, canvas, freq, wave) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!wave) return;
  const colors = ['#ff006640', '#00ccff40', '#ff660040'];
  const widths = [6, 4, 2];
  const topColors = ['#ff0066', '#00ccff', '#ff6600'];
  for (let layer = 0; layer < 3; layer++) {
    const offset = layer * 15;
    ctx.strokeStyle = colors[layer];
    ctx.lineWidth = widths[layer];
    ctx.beginPath();
    const sliceW = canvas.width / wave.length;
    for (let i = 0; i < wave.length; i++) {
      const y = ((wave[i] + offset) / 255) * canvas.height;
      const x = i * sliceW;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = topColors[layer];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < wave.length; i++) {
      const y = ((wave[i] + offset) / 255) * canvas.height;
      const x = i * sliceW;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Registry
export const VISUALIZATIONS = [
  { id: 'bars', name: 'Classic Bars', draw: drawBars },
  { id: 'waveform', name: 'Waveform', draw: drawWaveform },
  { id: 'spectrum', name: 'Spectrum', draw: drawSpectrum },
  { id: 'circular', name: 'Circular', draw: drawCircular },
  { id: 'mirror', name: 'Mirror Bars', draw: drawMirrorBars },
  { id: 'particles', name: 'Particles', draw: drawParticles },
  { id: 'galaxy', name: 'Galaxy', draw: drawGalaxy },
  { id: 'neon', name: 'Neon Wave', draw: drawNeonWave },
];
