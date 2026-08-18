const $ = id => document.getElementById(id);
const BUILD = '2026-08-19 v9';
const HUB_URL = 'https://tfhub.dev/google/imagenet/inception_v3/classification/5';
const OCTAVE_SCALE = 1.30;
const OCTAVE_LEVELS = [-2, -1, 0, 1, 2];
const STEPS_PER_OCTAVE = 30;
const STEP_SIZE = 0.012;
const JITTER = 24;

const canvas = $('stage');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
let original = null;
let current = null;
let history = [];
let abort = false;
let busy = false;
let model = null;
let dreamNodes = [];

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
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}

function graphNodeNames() {
  const graph = model?.executor?.graph;
  if (!graph) return [];
  if (graph.nodes) {
    if (Array.isArray(graph.nodes)) return graph.nodes.map(n => n?.name).filter(Boolean);
    return Object.keys(graph.nodes);
  }
  if (graph.nodeMap) {
    if (graph.nodeMap instanceof Map) return [...graph.nodeMap.keys()];
    return Object.keys(graph.nodeMap);
  }
  return [];
}

function rankNode(name, token) {
  let score = 0;
  if (name.includes(token)) score += 20;
  if (/concat|output/i.test(name)) score += 8;
  if (/InceptionV3/i.test(name)) score += 4;
  if (/Identity|ReadVariable|weights|kernel|bias|Const/i.test(name)) score -= 20;
  score -= name.length * 0.001;
  return score;
}

async function findWorkingNode(token, probe) {
  const names = graphNodeNames()
    .filter(n => n.includes(token))
    .sort((a, b) => rankNode(b, token) - rankNode(a, token));

  for (const name of names.slice(0, 16)) {
    try {
      const out = model.execute(probe, name);
      const tensor = Array.isArray(out) ? out[0] : out;
      if (tensor && tensor.rank >= 3) {
        await tensor.data();
        if (Array.isArray(out)) out.forEach(t => t.dispose()); else tensor.dispose();
        return name;
      }
      if (Array.isArray(out)) out.forEach(t => t.dispose()); else out?.dispose?.();
    } catch (e) {
      console.debug('node rejected', name, e);
    }
  }
  return null;
}

async function discoverDreamNodes() {
  const probe = tf.zeros([1, 299, 299, 3]);
  try {
    // Keras InceptionV3: mixed3 ≒ Mixed_6a, mixed5 ≒ Mixed_6c.
    // Reference notebook explicitly maximizes mixed3 + mixed5.
    const n1 = await findWorkingNode('Mixed_6a', probe);
    const n2 = await findWorkingNode('Mixed_6c', probe);
    const nodes = [n1, n2].filter(Boolean);
    if (nodes.length === 2) return nodes;

    // SavedModel naming can vary. Search nearby Inception mixed blocks as a robust fallback,
    // but never fall back to the final classifier: DeepDream requires spatial feature maps.
    const names = graphNodeNames().filter(n => /Mixed_6[abc]/.test(n) && /concat|output/i.test(n));
    const unique = [...new Set(names)];
    for (const name of unique) {
      if (nodes.includes(name)) continue;
      try {
        const out = model.execute(probe, name);
        const t = Array.isArray(out) ? out[0] : out;
        if (t && t.rank >= 3) {
          await t.data();
          if (Array.isArray(out)) out.forEach(x => x.dispose()); else t.dispose();
          nodes.push(name);
          if (nodes.length === 2) break;
        } else {
          if (Array.isArray(out)) out.forEach(x => x.dispose()); else out?.dispose?.();
        }
      } catch {}
    }
    if (nodes.length < 2) {
      throw new Error('InceptionV3のmixed3/mixed5相当層を取得できませんでした');
    }
    return nodes.slice(0, 2);
  } finally {
    probe.dispose();
  }
}

async function ensureModel() {
  if (model && dreamNodes.length === 2) return;
  if (typeof tf === 'undefined') throw new Error('TensorFlow.jsの読込に失敗しました');

  status('TensorFlowを準備しています…');
  await withTimeout(tf.ready(), 15000, 'TensorFlow初期化が15秒を超えました');

  if (tf.getBackend() !== 'webgl') {
    try {
      await withTimeout(tf.setBackend('webgl'), 8000, 'WebGL初期化失敗');
      await tf.ready();
    } catch {
      await tf.setBackend('cpu');
      await tf.ready();
    }
  }

  status('InceptionV3 / ImageNet を読み込んでいます…');
  model = await withTimeout(
    tf.loadGraphModel(HUB_URL, {fromTFHub: true}),
    90000,
    'InceptionV3取得が90秒を超えました'
  );

  status('mixed3 / mixed5 相当層を探しています…');
  dreamNodes = await discoverDreamNodes();
  console.log('DeepDream nodes:', dreamNodes);
  status(`準備完了 / ${tf.getBackend()} / mixed3+mixed5`);
}

function imageDataToTensor(data) {
  return tf.tidy(() => tf.browser.fromPixels(data).toFloat().div(255));
}

async function tensorToData(t) {
  const clipped = tf.tidy(() => t.clipByValue(0, 1).mul(255));
  const [h, w] = clipped.shape;
  const vals = await clipped.data();
  clipped.dispose();
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < vals.length; i += 3, j += 4) {
    out[j] = vals[i]; out[j + 1] = vals[i + 1]; out[j + 2] = vals[i + 2]; out[j + 3] = 255;
  }
  return new ImageData(out, w, h);
}

function resizeTensor(t, h, w) {
  return tf.tidy(() => tf.image.resizeBilinear(t, [Math.max(75, Math.round(h)), Math.max(75, Math.round(w))], true));
}

function roll2d(t, sy, sx) {
  return tf.tidy(() => {
    const [h, w, c] = t.shape;
    const y = ((sy % h) + h) % h;
    const x = ((sx % w) + w) % w;
    let r = t;
    if (y) r = tf.concat([r.slice([h - y, 0, 0], [y, w, c]), r.slice([0, 0, 0], [h - y, w, c])], 0);
    if (x) r = tf.concat([r.slice([0, w - x, 0], [h, x, c]), r.slice([0, 0, 0], [h, w - x, c])], 1);
    return r;
  });
}

function calcLoss(img) {
  // TF Hub Inception modules use [0,1] RGB input. We optimize the spatial activations
  // of mixed3/mixed5 equivalents, matching the supplied Keras notebook's mean-activation objective.
  const batch = img.expandDims(0);
  const outputs = model.execute(batch, dreamNodes);
  const arr = Array.isArray(outputs) ? outputs : [outputs];
  let loss = tf.scalar(0);
  for (const act of arr) loss = loss.add(act.mean());
  return loss;
}

function gradientStd(g) {
  return tf.tidy(() => {
    const {variance} = tf.moments(g);
    return variance.sqrt().add(1e-8);
  });
}

async function dreamStep(img) {
  const sx = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER;
  const sy = Math.floor(Math.random() * (JITTER * 2 + 1)) - JITTER;
  const shifted = roll2d(img, sy, sx);

  const grad = tf.tidy(() => {
    const g = tf.grad(x => calcLoss(x))(shifted);
    const std = gradientStd(g);
    return g.div(std);
  });

  const stepped = tf.tidy(() => shifted.add(grad.mul(STEP_SIZE)).clipByValue(0, 1));
  grad.dispose();
  shifted.dispose();
  const restored = roll2d(stepped, -sy, -sx);
  stepped.dispose();
  return restored;
}

function buildOctaves(base) {
  const [baseH, baseW] = base.shape;
  return OCTAVE_LEVELS.map(n => {
    const scale = Math.pow(OCTAVE_SCALE, n);
    return resizeTensor(base, baseH * scale, baseW * scale);
  });
}

async function runDream() {
  if (!current) return status('先に画像を選んでください');
  if (busy) return;
  busy = true;
  abort = false;
  $('run').disabled = true;

  let base = null;
  let result = null;
  let detail = null;
  let octaves = [];

  try {
    await ensureModel();
    pushHistory();
    base = imageDataToTensor(current);

    // Keep the browser sane while preserving enough spatial room for classic DeepDream motifs.
    const maxSide = 640;
    const [bh, bw] = base.shape;
    if (Math.max(bh, bw) > maxSide) {
      const r = maxSide / Math.max(bh, bw);
      const resized = resizeTensor(base, bh * r, bw * r);
      base.dispose();
      base = resized;
    }

    octaves = buildOctaves(base);
    detail = tf.zerosLike(octaves[0]);

    for (let oi = 0; oi < octaves.length; oi++) {
      if (abort) break;
      const octaveBase = octaves[oi];
      const [h, w] = octaveBase.shape;

      if (oi > 0) {
        const up = resizeTensor(detail, h, w);
        detail.dispose();
        detail = up;
      }

      if (result) result.dispose();
      result = tf.tidy(() => octaveBase.add(detail).clipByValue(0, 1));

      for (let step = 0; step < STEPS_PER_OCTAVE; step++) {
        if (abort) break;
        const next = await dreamStep(result);
        result.dispose();
        result = next;
        status(`夢見中 ${oi + 1}/${octaves.length} ・ ${step + 1}/${STEPS_PER_OCTAVE}`);
        if ((step + 1) % 2 === 0) await tf.nextFrame();
      }

      const newDetail = tf.tidy(() => result.sub(octaveBase));
      detail.dispose();
      detail = newDetail;
    }

    if (!result) throw new Error('DeepDream処理を開始できませんでした');
    const final = resizeTensor(result, original.height, original.width);
    const data = await tensorToData(final);
    final.dispose();
    drawData(data);
    status(abort ? '停止しました' : '完了');
  } catch (e) {
    console.error(e);
    status(`エラー: ${e.message}`);
  } finally {
    try { result?.dispose(); } catch {}
    try { detail?.dispose(); } catch {}
    try { base?.dispose(); } catch {}
    for (const t of octaves) { try { t.dispose(); } catch {} }
    busy = false;
    $('run').disabled = false;
  }
}

async function loadFile(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1400;
    const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * r);
    canvas.height = Math.round(bmp.height * r);
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

function downloadCanvas() {
  const a = document.createElement('a');
  a.download = 'deepdream-inception-v9.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

$('file').onchange = e => e.target.files[0] && loadFile(e.target.files[0]);
$('run').onclick = runDream;
$('stop').onclick = () => { abort = true; status('停止要求'); };
$('undo').onclick = () => { const x = history.pop(); if (x) drawData(x); };
$('reset').onclick = () => { if (original) { pushHistory(); drawData(original); } };
$('download').onclick = downloadCanvas;
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadFile(f);
});
status('画像を選んでください');