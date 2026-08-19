const source = await fetch('./main-v17.js?v=20260819-v20-engine', { cache: 'no-store' }).then((r) => {
  if (!r.ok) throw new Error(`DeepDream base engine fetch failed: ${r.status}`);
  return r.text();
});

const oldLoss = `function lossForGradient(x) {
  const y = dreamModel.apply(x.expandDims(0), {training: false});
  if (Array.isArray(y)) throw new Error('v17 model must have exactly one output');
  return y.mean();
}`;

const newLoss = `function lossForGradient(x) {
  const y = dreamModel.apply(x.expandDims(0), {training: false});
  if (Array.isArray(y)) throw new Error('v20 model must have exactly one output');
  if (!dreamChannels || !dreamChannels.length) return y.mean();
  const parts = dreamChannels.map((channel) =>
    y.slice([0, 0, 0, channel], [-1, -1, -1, 1])
  );
  return tf.concat(parts, 3).mean();
}`;

if (!source.includes(oldLoss)) {
  throw new Error('v20: reviewed v17 loss block was not found');
}

const prelude = `
const ASSET_BANK_URL = './model/asset-banks.json?v=20260819-v20-assets1';
let assetBanks = null;
let activeAssetKey = 'animals';
let activeAsset = null;
let dreamChannels = null;
let loadedAssetLayer = null;

async function loadAssetBanks() {
  if (assetBanks) return assetBanks;
  const response = await fetch(ASSET_BANK_URL, {cache: 'no-store'});
  if (!response.ok) throw new Error('幻覚アセット取得失敗: ' + response.status);
  assetBanks = await response.json();
  if (!assetBanks.assets) throw new Error('幻覚アセット定義が壊れています');
  return assetBanks;
}

function markAssetButton() {
  document.querySelectorAll('[data-asset]').forEach((button) => {
    button.classList.toggle('active', button.dataset.asset === activeAssetKey);
  });
}

function selectAsset(key) {
  activeAssetKey = key;
  markAssetButton();
  if (assetBanks?.assets?.[key]) {
    const next = assetBanks.assets[key];
    if (loadedAssetLayer && loadedAssetLayer !== next.layer) disposeModel();
    activeAsset = next;
    dreamChannels = next.channels.slice();
    loadedAssetLayer = next.layer;
    gradientFn = dreamModel ? tf.grad(lossForGradient) : null;
    status('アセット: ' + next.label + ' / ' + next.layer);
  }
}

async function configureSelectedAsset() {
  await loadAssetBanks();
  const next = assetBanks.assets[activeAssetKey];
  if (!next) throw new Error('未知の幻覚アセット: ' + activeAssetKey);
  if (loadedAssetLayer && loadedAssetLayer !== next.layer) disposeModel();
  activeAsset = next;
  dreamChannels = next.channels.slice();
  loadedAssetLayer = next.layer;
  MODEL_URL = './model/dreams/' + next.layer + '/model.json?v=20260819-v20-' + next.layer;
  if (dreamModel) gradientFn = tf.grad(lossForGradient);
  markAssetButton();
}

function padToTileGrid(t) {
  const h = t.shape[0];
  const w = t.shape[1];
  const ph = (TILE - (h % TILE)) % TILE;
  const pw = (TILE - (w % TILE)) % TILE;
  if (!ph && !pw) return t.clone();
  return tf.pad(t, [[0, ph], [0, pw], [0, 0]], 0);
}
`;

let patched = prelude + '\n' + source
  .replace("const BUILD = '2026-08-19 v17';", "const BUILD = '2026-08-19 v20';")
  .replace("const MODEL_URL = './model/classic/model.json';", "let MODEL_URL = null;")
  .replace("const STEPS_PER_OCTAVE = [24, 24, 24, 24, 24];", "const STEPS_PER_OCTAVE = [18, 14, 10, 6, 3];")
  .replace(oldLoss, newLoss)
  .replaceAll('v17 model', 'v20 model')
  .replaceAll('v17 WebGL', 'v20 WebGL')
  .replaceAll('v17 failed', 'v20 failed')
  .replaceAll('deepdream-classic-v17.png', 'deepdream-asset-v20.png');

const processStart = patched.indexOf('async function processDreamOnce(sourceImageData) {');
const processEnd = patched.indexOf('\nasync function runDream()', processStart);
if (processStart < 0 || processEnd < 0) {
  throw new Error('v20: processDreamOnce block not found');
}

const nativeProcess = `async function processDreamOnce(sourceImageData) {
  let input = null;
  let base = null;
  let detail = null;
  let result = null;

  try {
    setPhase('input', '原画像を等倍Tensor化 (' + activeBackend + ')');
    input = imageDataToTensor(sourceImageData);
    await input.data();
    const originalH = input.shape[0];
    const originalW = input.shape[1];

    // No WEBGL_MAX / CPU_MAX downscale. Pad only, never shrink the source.
    base = padToTileGrid(input);
    await base.data();
    const baseH = base.shape[0];
    const baseW = base.shape[1];

    const shapes = octaveShapes(baseH, baseW);
    setPhase('octave', shapes.length + ' octave / native ' + originalW + '×' + originalH + ' / 96px tiles');

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
          const next = await tiledStep(src, activeAsset.label + ' ' + (oi + 1) + '/' + shapes.length + ' ・ ' + (step + 1) + '/' + steps);
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
    setPhase('output', '原画像の実解像度で書き出しています…');
    const cropped = result.slice([0, 0, 0], [originalH, originalW, 3]);
    const data = await tensorToImageData(cropped);
    cropped.dispose();
    return data;
  } finally {
    try { input?.dispose(); } catch {}
    try { base?.dispose(); } catch {}
    try { detail?.dispose(); } catch {}
    try { result?.dispose(); } catch {}
  }
}`;

patched = patched.slice(0, processStart) + nativeProcess + patched.slice(processEnd);

const oldRunStart = `  try {
    await ensureModel();
    let data;`;
const newRunStart = `  try {
    await configureSelectedAsset();
    await ensureModel();
    gradientFn = tf.grad(lossForGradient);
    await verifyExactProductionPath();
    setPhase('ready', activeAsset.label + ' / ' + activeAsset.layer + ' / ' + dreamChannels.length + 'ch / native-res / ' + activeBackend);
    let data;`;
if (!patched.includes(oldRunStart)) {
  throw new Error('v20: runDream start block not found');
}
patched = patched.replace(oldRunStart, newRunStart);

const oldDone = "status(abort ? '停止しました' : `完了 (${activeBackend})`);";
const newDone = "status(abort ? '停止しました' : `完了 (${activeBackend}) / ${activeAsset.label} / ${current.width}×${current.height}`);";
if (!patched.includes(oldDone)) {
  throw new Error('v20: completion block not found');
}
patched = patched.replace(oldDone, newDone);

const oldLoad = `    const max = 1400;
    const ratio = Math.min(1, max / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * ratio);
    canvas.height = Math.round(bmp.height * ratio);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);`;
const newLoad = `    // Keep native pixel dimensions. The dream engine tiles the image instead of shrinking it.
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height);`;
if (!patched.includes(oldLoad)) {
  throw new Error('v20: native image load block not found');
}
patched = patched.replace(oldLoad, newLoad);

patched += `

document.querySelectorAll('[data-asset]').forEach((button) => {
  button.addEventListener('click', () => {
    if (busy) return;
    selectAsset(button.dataset.asset);
  });
});
markAssetButton();
`;

// v20 keeps v18's proven BN-fused gradient path, but replaces random dreams
// with fixed semantic asset banks and removes all pre-processing downscaling.
(0, eval)(patched);
