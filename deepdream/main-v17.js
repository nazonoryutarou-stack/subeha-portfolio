const $ = (id) => document.getElementById(id);
const BUILD = '2026-08-19 v17';
const MODEL_URL = './model/classic/model.json';

// Fixed classic recipe. All gradient work is performed on one fixed tile size,
// so the real run and the self-test exercise the exact same TensorFlow.js path.
const TILE = 96;
const OCTAVE_N = 5;
const OCTAVE_SCALE = 1.30;
const STEPS_PER_OCTAVE = [24, 24, 24, 24, 24];
const STEP_SIZE = 0.01;
const JITTER = 16;
const WEBGL_MAX = 288;
const CPU_MAX = 192;

const canvas = $('stage');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
let original = null;
let current = null;
let history = [];
let abort = false;
let busy = false;
let dreamModel = null;
let gradientFn = null;
let activeBackend = null;
let phase = 'idle';

function status(text) {
  $('status').textContent = `${text} ｜ ${BUILD}`;
}

function setPhase(name, text = name) {
  phase = name;
  status(`[${name}] ${text}`);
}

function cloneImageData(x) {
  return new ImageData(new Uint8ClampedArray(x.data), x.width, x.height);
}

function drawData(data) {
  canvas.width = data.width;
  canvas.height = data.height;
  ctx.putImageData(data, 0, 0);
  current = cloneImageData(data);
  $('drop').classList.add('hidden');
}

function pushHistory() {
  if (!current) return;
  history.push(cloneImageData(current));
  if (history.length > 8) history.shift();
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

function disposeModel() {
  try { dreamModel?.dispose(); } catch {}
  dreamModel = null;
  gradientFn = null;
}

function lossForGradient(x) {
  const y = dreamModel.apply(x.expandDims(0), {training: false});
  if (Array.isArray(y)) throw new Error('v17 model must have exactly one output');
  return y.mean();
}

function dreamTile(tile) {
  // One tidy encloses one complete, synchronous gradient step. The loss itself
  // is NOT wrapped in another tidy, so backprop intermediates survive until
  // tf.grad has finished and are then released together here.
  return tf.tidy(() => {
    const raw = gradientFn(tile);
    if (!raw) throw new Error('96px tile gradient was not produced');
    const mean = raw.mean();
    const std = raw.sub(mean).square().mean().sqrt();
    const normalized = raw.div(std.add(1e-8));
    return tile.add(normalized.mul(STEP_SIZE)).clipByValue(-1, 1);
  });
}

async function verifyExactProductionPath() {
  setPhase('selftest', `96×96 production tile self-test (${activeBackend})`);
  const probe = tf.randomUniform([TILE, TILE, 3], -1, 1, 'float32', 156);
  let out = null;
  try {
    out = dreamTile(probe);
    const values = await out.data();
    if (!values.length || !Number.isFinite(values[0])) {
      throw new Error('tile self-test returned invalid values');
    }
  } finally {
    try { out?.dispose(); } catch {}
    probe.dispose();
  }
}

async function loadModelFresh(backend) {
  disposeModel();
  setPhase('backend', `${backend} を初期化しています…`);
  const ok = await tf.setBackend(backend);
  if (!ok) throw new Error(`${backend} backend unavailable`);
  await tf.ready();
  activeBackend = tf.getBackend();

  setPhase('model', `InceptionV3 mixed5 を読み込んでいます… (${activeBackend})`);
  dreamModel = await withTimeout(
    tf.loadLayersModel(MODEL_URL, {
      onProgress: (p) => setPhase('model', `モデル取得 ${Math.round(p * 100)}% (${activeBackend})`),
    }),
    120000,
    'モデル取得が120秒を超えました'
  );
  gradientFn = tf.grad(lossForGradient);
  await verifyExactProductionPath();
  setPhase('ready', `mixed5 / 96px tile / ${activeBackend}`);
}

async function ensureModel() {
  if (dreamModel && gradientFn) return;
  if (typeof tf === 'undefined') throw new Error('TensorFlow.jsの読込に失敗しました');
  await withTimeout(tf.ready(), 15000, 'TensorFlow初期化が15秒を超えました');
  try {
    await loadModelFresh('webgl');
  } catch (webglError) {
    console.warn('v17 WebGL self-test failed; switching to CPU', webglError);
    disposeModel();
    await loadModelFresh('cpu');
  }
}

function imageDataToTensor(data) {
  const {width, height} = data;
  const src = data.data;
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < src.length; i += 4) {
    rgb[j++] = src[i] / 127.5 - 1;
    rgb[j++] = src[i + 1] / 127.5 - 1;
    rgb[j++] = src[i + 2] / 127.5 - 1;
  }
  return tf.tensor3d(rgb, [height, width, 3], 'float32');
}

async function tensorToImageData(t) {
  const rgb = tf.tidy(() => t.add(1).mul(127.5).clipByValue(0, 255));
  const [h, w] = rgb.shape;
  const vals = await rgb.data();
  rgb.dispose();
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < vals.length; i += 3, j += 4) {
    out[j] = vals[i];
    out[j + 1] = vals[i + 1];
    out[j + 2] = vals[i + 2];
    out[j + 3] = 255;
  }
  return new ImageData(out, w, h);
}

function resize(t, h, w) {
  return tf.tidy(() => tf.image.resizeBilinear(
    t,
    [Math.max(TILE, Math.round(h)), Math.max(TILE, Math.round(w))],
    true
  ));
}

function roll(t, sy, sx) {
  return tf.tidy(() => {
    const [h, w, c] = t.shape;
    const y = ((sy % h) + h) % h;
    const x = ((sx % w) + w) % w;
    let r = t.clone();
    if (y) {
      const next = tf.concat([
        r.slice([h - y, 0, 0], [y, w, c]),
        r.slice([0, 0, 0], [h - y, w, c]),
      ], 0);
      r.dispose();
      r = next;
    }
    if (x) {
      const next = tf.concat([
        r.slice([0, w - x, 0], [h, x, c]),
        r.slice([0, 0, 0], [h, w - x, c]),
      ], 1);
      r.dispose();
      r = next;
    }
    return r;
  });
}

function floorTile(n) {
  return Math.max(TILE, Math.floor(n / TILE) * TILE);
}

function fitInsideTileGrid(h, w, maxSide) {
  const ratio = Math.min(1, maxSide / Math.max(h, w));
  let nh = Math.max(TILE, Math.round(h * ratio));
  let nw = Math.max(TILE, Math.round(w * ratio));
  nh = floorTile(nh);
  nw = floorTile(nw);
  return [nh, nw];
}

function octaveShapes(h, w) {
  const shapes = [];
  for (let i = OCTAVE_N - 1; i >= 0; i--) {
    const scale = Math.pow(OCTAVE_SCALE, i);
    shapes.push([
      floorTile(h / scale),
      floorTile(w / scale),
    ]);
  }
  // remove duplicate adjacent shapes caused by the 96px grid
  return shapes.filter((s, i) => i === 0 || s[0] !== shapes[i - 1][0] || s[1] !== shapes[i - 1][1]);
}

async function tiledStep(img, label) {
  const ox = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER;
  const oy = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER;
  const shifted = roll(img, oy, ox);
  const [h, w] = shifted.shape;
  const rows = [];
  let merged = null;
  let restored = null;

  try {
    for (let y = 0; y < h; y += TILE) {
      const tiles = [];
      try {
        for (let x = 0; x < w; x += TILE) {
          const tile = shifted.slice([y, x, 0], [TILE, TILE, 3]);
          let stepped = null;
          try {
            stepped = dreamTile(tile);
            tiles.push(stepped);
          } finally {
            tile.dispose();
          }
        }
        const row = tf.concat(tiles, 1);
        rows.push(row);
      } finally {
        tiles.forEach((t) => { try { t.dispose(); } catch {} });
      }
      setPhase('dream', `${label} / tile row ${y / TILE + 1}/${h / TILE} (${activeBackend})`);
      await tf.nextFrame();
    }

    merged = tf.concat(rows, 0);
    restored = roll(merged, -oy, -ox);
    return restored;
  } finally {
    rows.forEach((r) => { try { r.dispose(); } catch {} });
    try { merged?.dispose(); } catch {}
    shifted.dispose();
  }
}

async function processDreamOnce(sourceImageData) {
  let input = null;
  let base = null;
  let detail = null;
  let result = null;

  try {
    setPhase('input', `画像をTensor化 (${activeBackend})`);
    input = imageDataToTensor(sourceImageData);
    await input.data();

    const maxSide = activeBackend === 'cpu' ? CPU_MAX : WEBGL_MAX;
    const [baseH, baseW] = fitInsideTileGrid(input.shape[0], input.shape[1], maxSide);
    base = resize(input, baseH, baseW);
    await base.data();

    const shapes = octaveShapes(baseH, baseW);
    setPhase('octave', `${shapes.length} octave / 96px tile grid`);

    for (let oi = 0; oi < shapes.length && !abort; oi++) {
      const [h, w] = shapes[oi];
      const octaveBase = resize(base, h, w);
      let src = null;
      try {
        if (detail) {
          const up = resize(detail, h, w);
          detail.dispose();
          detail = up;
          src = tf.tidy(() => octaveBase.add(detail).clipByValue(-1, 1));
        } else {
          src = octaveBase.clone();
        }

        const steps = STEPS_PER_OCTAVE[Math.min(oi, STEPS_PER_OCTAVE.length - 1)];
        for (let step = 0; step < steps && !abort; step++) {
          const next = await tiledStep(src, `${oi + 1}/${shapes.length} ・ ${step + 1}/${steps}`);
          src.dispose();
          src = next;
        }

        if (detail) detail.dispose();
        detail = tf.tidy(() => src.sub(octaveBase));
        if (result) result.dispose();
        result = src.clone();
      } finally {
        try { src?.dispose(); } catch {}
        octaveBase.dispose();
      }
    }

    if (!result) throw new Error('DeepDream処理を開始できません');
    setPhase('output', '夢を原寸へ戻しています…');
    const full = resize(result, sourceImageData.height, sourceImageData.width);
    const data = await tensorToImageData(full);
    full.dispose();
    return data;
  } finally {
    try { input?.dispose(); } catch {}
    try { base?.dispose(); } catch {}
    try { detail?.dispose(); } catch {}
    try { result?.dispose(); } catch {}
  }
}

async function runDream() {
  if (!current) return status('先に画像を選んでください');
  if (busy) return;
  busy = true;
  abort = false;
  $('run').disabled = true;
  pushHistory();
  const source = cloneImageData(current);

  try {
    await ensureModel();
    let data;
    try {
      data = await processDreamOnce(source);
    } catch (firstError) {
      const msg = firstError?.message || String(firstError);
      console.error(`v17 failed in ${phase}/${activeBackend}`, firstError);
      if (activeBackend !== 'webgl' || abort) throw firstError;
      setPhase('fallback', `WebGL失敗: ${msg} / CPUで全工程を再実行`);
      disposeModel();
      await loadModelFresh('cpu');
      data = await processDreamOnce(source);
    }
    drawData(data);
    status(abort ? '停止しました' : `完了 (${activeBackend})`);
  } catch (e) {
    console.error(e);
    const msg = e?.message || String(e);
    status(`エラー [${phase}/${activeBackend || 'unknown'}]: ${msg}`);
  } finally {
    busy = false;
    $('run').disabled = false;
  }
}

async function loadFile(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1400;
    const ratio = Math.min(1, max / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * ratio);
    canvas.height = Math.round(bmp.height * ratio);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    original = ctx.getImageData(0, 0, canvas.width, canvas.height);
    current = cloneImageData(original);
    history = [];
    $('drop').classList.add('hidden');
    status(`${canvas.width}×${canvas.height} 読み込み完了`);
    bmp.close();
  } catch (e) {
    status(`画像読込失敗: ${e.message}`);
  }
}

$('file').onchange = (e) => e.target.files[0] && loadFile(e.target.files[0]);
$('run').onclick = runDream;
$('stop').onclick = () => { abort = true; status('停止要求'); };
$('undo').onclick = () => { const x = history.pop(); if (x) drawData(x); };
$('reset').onclick = () => { if (original) { pushHistory(); drawData(original); } };
$('download').onclick = () => {
  const a = document.createElement('a');
  a.download = 'deepdream-classic-v17.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
};
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});

status('画像を選んでください');