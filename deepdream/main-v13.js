const $ = (id) => document.getElementById(id);
const BUILD = '2026-08-19 v14';
const MODEL_URL = './model/classic/model.json';

// Fixed recipe from supplied DeepDream.ipynb + Google Research dream.ipynb.
const OCTAVE_N = 5;
const OCTAVE_SCALE = 1.30;
const STEPS_PER_OCTAVE = [50, 50, 40, 35, 30];
const STEP_SIZE = 0.01;
const JITTER = 32;
const WEBGL_MAX = 384;
const CPU_MAX = 224;

const canvas = $('stage');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
let original = null;
let current = null;
let history = [];
let abort = false;
let busy = false;
let dreamModel = null;
let activeBackend = null;

function status(text) {
  $('status').textContent = `${text} ｜ ${BUILD}`;
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
}

async function loadModelFresh(backend) {
  disposeModel();
  status(`${backend} を初期化しています…`);
  const ok = await tf.setBackend(backend);
  if (!ok) throw new Error(`${backend} バックエンドを有効化できません`);
  await tf.ready();
  activeBackend = tf.getBackend();

  status(`InceptionV3を読み込んでいます… (${activeBackend})`);
  dreamModel = await withTimeout(
    tf.loadLayersModel(MODEL_URL, {
      onProgress: (p) => status(`InceptionV3取得中 ${Math.round(p * 100)}% (${activeBackend})`),
    }),
    120000,
    'InceptionV3取得が120秒を超えました'
  );
}

function lossNoTidy(x) {
  const batch = x.expandDims(0);
  const output = dreamModel.apply(batch, {training: false});
  const acts = Array.isArray(output) ? output : [output];
  const means = acts.map((act) => act.mean());
  return tf.addN(means);
}

async function verifyGradientPath() {
  status(`勾配経路を自己診断しています… (${activeBackend})`);
  const probe = tf.randomUniform([96, 96, 3], -1, 1, 'float32', 156);
  try {
    const forward = tf.tidy(() => {
      const y = dreamModel.apply(probe.expandDims(0), {training: false});
      const ys = Array.isArray(y) ? y : [y];
      if (ys.length !== 2) throw new Error(`モデル出力が${ys.length}個です（期待値2）`);
      return ys.map(t => t.mean());
    });
    await Promise.all(forward.map(t => t.data()));
    forward.forEach(t => t.dispose());

    const gradFn = tf.grad((x) => lossNoTidy(x));
    const g = gradFn(probe);
    if (!g || !g.shape || g.size === 0) throw new Error('勾配テンソルを生成できません');
    const sample = await g.data();
    if (!sample.length || !Number.isFinite(sample[0])) throw new Error('勾配が不正です');
    g.dispose();
  } finally {
    probe.dispose();
  }
}

async function ensureModel() {
  if (dreamModel) return;
  if (typeof tf === 'undefined') throw new Error('TensorFlow.jsの読込に失敗しました');

  status('TensorFlowを準備しています…');
  await withTimeout(tf.ready(), 15000, 'TensorFlow初期化が15秒を超えました');

  // WebGL is preferred, but only after a real forward+gradient self-test.
  try {
    await loadModelFresh('webgl');
    await verifyGradientPath();
    status(`準備完了 / mixed3 + mixed5 / ${activeBackend}`);
    return;
  } catch (webglError) {
    console.warn('DeepDream WebGL self-test failed; retrying on CPU', webglError);
    status(`WebGL勾配失敗。CPUへ退避中…`);
    disposeModel();
    try { tf.disposeVariables(); } catch {}
  }

  // CPU is slower but much less dependent on GPU driver quirks.
  await loadModelFresh('cpu');
  await verifyGradientPath();
  status(`準備完了 / mixed3 + mixed5 / CPU互換モード`);
}

function imageDataToDreamTensor(data) {
  return tf.tidy(() => tf.browser.fromPixels(data).toFloat().div(127.5).sub(1));
}

async function dreamTensorToImageData(t) {
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
    [Math.max(75, Math.round(h)), Math.max(75, Math.round(w))],
    true
  ));
}

function roll(t, sy, sx) {
  return tf.tidy(() => {
    const [h, w, c] = t.shape;
    const y = ((sy % h) + h) % h;
    const x = ((sx % w) + w) % w;
    let r = t;
    if (y) {
      r = tf.concat([
        r.slice([h - y, 0, 0], [y, w, c]),
        r.slice([0, 0, 0], [h - y, w, c]),
      ], 0);
    }
    if (x) {
      r = tf.concat([
        r.slice([0, w - x, 0], [h, x, c]),
        r.slice([0, 0, 0], [h, w - x, c]),
      ], 1);
    }
    return r;
  });
}

function dreamLoss(x) {
  return tf.tidy(() => lossNoTidy(x));
}

async function makeStep(img) {
  const ox = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER;
  const oy = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER;
  const shifted = roll(img, oy, ox);

  let grad = null;
  try {
    grad = tf.tidy(() => {
      const raw = tf.grad((x) => dreamLoss(x))(shifted);
      if (!raw) throw new Error('勾配の生成に失敗しました');
      const mean = raw.mean();
      const std = raw.sub(mean).square().mean().sqrt();
      return raw.div(std.add(1e-8));
    });

    const stepped = tf.tidy(() => shifted.add(grad.mul(STEP_SIZE)).clipByValue(-1, 1));
    const restored = roll(stepped, -oy, -ox);
    stepped.dispose();
    return restored;
  } finally {
    try { grad?.dispose(); } catch {}
    shifted.dispose();
  }
}

function buildOctaves(base) {
  const octaves = [base.clone()];
  for (let i = 1; i < OCTAVE_N; i++) {
    const prev = octaves[octaves.length - 1];
    octaves.push(resize(prev, prev.shape[0] / OCTAVE_SCALE, prev.shape[1] / OCTAVE_SCALE));
  }
  return octaves;
}

async function runDream() {
  if (!current) return status('先に画像を選んでください');
  if (busy) return;

  busy = true;
  abort = false;
  $('run').disabled = true;
  let base = null;
  let detail = null;
  let result = null;
  const octaves = [];

  try {
    await ensureModel();
    pushHistory();
    status(`入力画像を準備しています… (${activeBackend})`);
    base = imageDataToDreamTensor(current);

    const internalMax = activeBackend === 'cpu' ? CPU_MAX : WEBGL_MAX;
    const maxSide = Math.max(base.shape[0], base.shape[1]);
    if (maxSide > internalMax) {
      const ratio = internalMax / maxSide;
      const smaller = resize(base, base.shape[0] * ratio, base.shape[1] * ratio);
      base.dispose();
      base = smaller;
    }

    octaves.push(...buildOctaves(base));
    const ordered = [...octaves].reverse();
    detail = tf.zerosLike(ordered[0]);

    for (let oi = 0; oi < ordered.length && !abort; oi++) {
      const octaveBase = ordered[oi];
      const [h, w] = octaveBase.shape;

      if (oi > 0) {
        const up = resize(detail, h, w);
        detail.dispose();
        detail = up;
      }

      let src = tf.tidy(() => octaveBase.add(detail).clipByValue(-1, 1));
      const steps = STEPS_PER_OCTAVE[oi] ?? 35;

      for (let step = 0; step < steps && !abort; step++) {
        const next = await makeStep(src);
        src.dispose();
        src = next;
        status(`夢見中 ${oi + 1}/${ordered.length} ・ ${step + 1}/${steps} (${activeBackend})`);
        if ((step + 1) % 2 === 0) await tf.nextFrame();
      }

      detail.dispose();
      detail = tf.tidy(() => src.sub(octaveBase));
      if (result) result.dispose();
      result = src;
    }

    if (!result) throw new Error('DeepDream処理を開始できません');
    status('夢を原寸へ戻しています…');
    const full = resize(result, original.height, original.width);
    const data = await dreamTensorToImageData(full);
    full.dispose();
    drawData(data);
    status(abort ? '停止しました' : `完了 (${activeBackend})`);
  } catch (e) {
    console.error(e);
    const msg = e?.message || String(e);
    status(`エラー: ${msg}`);
  } finally {
    for (const o of octaves) { try { o.dispose(); } catch {} }
    try { base?.dispose(); } catch {}
    try { detail?.dispose(); } catch {}
    try { result?.dispose(); } catch {}
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
  a.download = 'deepdream-classic-v14.png';
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
