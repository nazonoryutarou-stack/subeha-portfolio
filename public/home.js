const canvas = document.querySelector('#crestCanvas');
const button = document.querySelector('#crestButton');
const live = document.querySelector('#crestMode');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const source = new Image();
source.src = './hitotsu-ore-choji.png';

const MODES = [
  '原型',
  '墨版',
  '反転写真',
  '新聞網点',
  '輪郭標本',
  '三色ずれ',
  '残像',
  '複写機'
];

// ただ順番に回すより、印が別の媒体へ転生していくように見える順序。
const MODE_SEQUENCE = [0, 5, 1, 6, 3, 2, 7, 4];
const HEARTBEAT_MS = 2400;
const CHANGE_AT_MS = 310;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let sequenceIndex = 0;
let basePixels = null;
let heartbeatTimer = 0;
let changeTimer = 0;
let releaseTimer = 0;

function fitSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = canvas.getBoundingClientRect();
  const size = Math.max(220, Math.round(Math.min(css.width, css.height) * dpr));
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
}

function drawBase() {
  fitSize();
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const pad = w * .14;
  ctx.drawImage(source, pad, pad, w - pad * 2, h - pad * 2);
  basePixels = ctx.getImageData(0, 0, w, h);
}

function copyBase() {
  ctx.putImageData(basePixels, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function luminance(r, g, b) {
  return r * .299 + g * .587 + b * .114;
}

function renderClean() {
  ctx.putImageData(basePixels, 0, 0);
}

function renderInk() {
  const img = copyBase();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const y = luminance(d[i], d[i + 1], d[i + 2]);
    const v = y < 190 ? 14 : 242;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = y < 225 ? 255 : Math.max(0, 255 - (y - 225) * 8);
  }
  ctx.putImageData(img, 0, 0);
}

function renderInvert() {
  const img = copyBase();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(img, 0, 0);
}

function renderHalftone() {
  const w = canvas.width;
  const h = canvas.height;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const t = tmp.getContext('2d');
  t.putImageData(basePixels, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#11110f';
  const step = Math.max(6, Math.round(w / 52));
  const sample = t.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (Math.min(h - 1, y) * w + Math.min(w - 1, x)) * 4;
      if (sample[i + 3] < 20) continue;
      const dark = 1 - luminance(sample[i], sample[i + 1], sample[i + 2]) / 255;
      const r = Math.max(.6, dark * step * .55);
      if (r < 1) continue;
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderEdges() {
  const src = basePixels.data;
  const out = ctx.createImageData(canvas.width, canvas.height);
  const d = out.data;
  const w = canvas.width;
  const h = canvas.height;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const ir = (y * w + x + 1) * 4;
      const ib = ((y + 1) * w + x) * 4;
      const a = src[i + 3];
      if (a < 10) continue;
      const here = luminance(src[i], src[i + 1], src[i + 2]);
      const dx = Math.abs(here - luminance(src[ir], src[ir + 1], src[ir + 2]));
      const dy = Math.abs(here - luminance(src[ib], src[ib + 1], src[ib + 2]));
      const edge = Math.min(255, (dx + dy) * 3.2);
      d[i] = d[i + 1] = d[i + 2] = 16;
      d[i + 3] = edge;
    }
  }
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(out, 0, 0);
}

function renderRgbSplit() {
  const w = canvas.width;
  const h = canvas.height;
  const offset = Math.max(3, Math.round(w * .018));
  const src = basePixels.data;
  const makeLayer = channel => {
    const layer = ctx.createImageData(w, h);
    const d = layer.data;
    for (let i = 0; i < src.length; i += 4) {
      if (!src[i + 3]) continue;
      const dark = 255 - luminance(src[i], src[i + 1], src[i + 2]);
      d[i + channel] = 255;
      d[i + 3] = Math.min(src[i + 3], dark);
    }
    return layer;
  };
  ctx.clearRect(0, 0, w, h);
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tc = temp.getContext('2d');
  [0, 1, 2].forEach((channel, idx) => {
    tc.clearRect(0, 0, w, h);
    tc.putImageData(makeLayer(channel), 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(temp, (idx - 1) * offset, 0);
  });
  ctx.globalCompositeOperation = 'source-over';
}

function renderGhost() {
  const w = canvas.width;
  const h = canvas.height;
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  temp.getContext('2d').putImageData(basePixels, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const offsets = [[-18, 8, .10], [-9, 4, .16], [0, 0, .65], [9, -4, .16], [18, -8, .10]];
  offsets.forEach(([x, y, a]) => {
    ctx.globalAlpha = a;
    ctx.drawImage(temp, x * (w / 320), y * (w / 320));
  });
  ctx.globalAlpha = 1;
}

function renderCopy() {
  const img = copyBase();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let y = luminance(d[i], d[i + 1], d[i + 2]);
    y += (Math.random() - .5) * 38;
    y = y < 105 ? 8 : y < 190 ? 110 : 244;
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = .13;
  ctx.fillStyle = '#11110f';
  for (let i = 0; i < 28; i++) {
    const y = Math.random() * canvas.height;
    ctx.fillRect(0, y, canvas.width, Math.random() * 1.5 + .35);
  }
  ctx.globalAlpha = 1;
}

const renderers = [renderClean, renderInk, renderInvert, renderHalftone, renderEdges, renderRgbSplit, renderGhost, renderCopy];

function currentMode() {
  return MODE_SEQUENCE[sequenceIndex];
}

function renderMode(index, announce = false) {
  if (!basePixels) return;
  renderers[index]();
  live.textContent = `一つ折れ丁子・${MODES[index]}`;
  if (announce) button.setAttribute('aria-label', `一つ折れ丁子・${MODES[index]}。押すと次の姿へ`);
}

function advanceMode(announce = false) {
  sequenceIndex = (sequenceIndex + 1) % MODE_SEQUENCE.length;
  renderMode(currentMode(), announce);
}

function pulseOnce({ manual = false } = {}) {
  clearTimeout(changeTimer);
  clearTimeout(releaseTimer);

  if (!reduceMotion.matches) {
    button.classList.remove('is-beating');
    void button.offsetWidth;
    button.classList.add('is-beating');
  }

  changeTimer = window.setTimeout(() => {
    button.classList.add('is-changing');
    advanceMode(manual);
    releaseTimer = window.setTimeout(() => button.classList.remove('is-changing'), 190);
  }, reduceMotion.matches ? 0 : CHANGE_AT_MS);
}

function startHeartbeat() {
  clearInterval(heartbeatTimer);
  pulseOnce();
  heartbeatTimer = window.setInterval(() => pulseOnce(), HEARTBEAT_MS);
}

function restartHeartbeatAfterManualPulse() {
  clearInterval(heartbeatTimer);
  pulseOnce({ manual: true });
  heartbeatTimer = window.setInterval(() => pulseOnce(), HEARTBEAT_MS);
}

source.addEventListener('load', () => {
  drawBase();
  renderMode(currentMode(), true);
  startHeartbeat();
});

button.addEventListener('click', restartHeartbeatAfterManualPulse);
button.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    restartHeartbeatAfterManualPulse();
  }
});

reduceMotion.addEventListener?.('change', startHeartbeat);

window.addEventListener('resize', () => {
  if (!source.complete) return;
  drawBase();
  renderMode(currentMode());
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(heartbeatTimer);
  } else if (basePixels) {
    startHeartbeat();
  }
});
