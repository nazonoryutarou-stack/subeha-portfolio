const source = await fetch('./main-v17.js?v=20260819-v19-engine', { cache: 'no-store' }).then((r) => {
  if (!r.ok) throw new Error(`DeepDream engine fetch failed: ${r.status}`);
  return r.text();
});

const oldLoss = `function lossForGradient(x) {
  const y = dreamModel.apply(x.expandDims(0), {training: false});
  if (Array.isArray(y)) throw new Error('v17 model must have exactly one output');
  return y.mean();
}`;

const newLoss = `function lossForGradient(x) {
  const y = dreamModel.apply(x.expandDims(0), {training: false});
  if (Array.isArray(y)) throw new Error('v19 model must have exactly one output');
  if (!dreamChannels || !dreamChannels.length) return y.mean();
  const parts = dreamChannels.map((channel) =>
    y.slice([0, 0, 0, channel], [-1, -1, -1, 1])
  );
  return tf.concat(parts, 3).mean();
}`;

if (!source.includes(oldLoss)) {
  throw new Error('v19: reviewed v17 loss block was not found');
}

const profilePrelude = `
const DREAM_PROFILES = [
  { key: 'mixed3', weight: 0.40, minChannels: 18, maxChannels: 30 },
  { key: 'mixed5', weight: 0.40, minChannels: 14, maxChannels: 24 },
  { key: 'mixed7', weight: 0.20, minChannels: 8,  maxChannels: 16 },
];
let dreamProfile = null;
let dreamChannels = null;
let loadedDreamKey = null;

function pickWeightedProfile() {
  let r = Math.random();
  for (const p of DREAM_PROFILES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return DREAM_PROFILES[DREAM_PROFILES.length - 1];
}

function chooseDreamProfile() {
  const next = pickWeightedProfile();
  dreamProfile = next;
  dreamChannels = null;
  MODEL_URL = \`./model/dreams/\${next.key}/model.json?v=20260819-v19-\${next.key}\`;
  if (loadedDreamKey && loadedDreamKey !== next.key) disposeModel();
  loadedDreamKey = next.key;
}

function chooseDreamChannels() {
  const shape = dreamModel?.outputs?.[0]?.shape;
  const total = Number(shape?.[shape.length - 1]);
  if (!Number.isFinite(total) || total < 2) {
    throw new Error('v19: output channel count unavailable');
  }
  const lo = Math.min(dreamProfile.minChannels, total);
  const hi = Math.min(dreamProfile.maxChannels, total);
  const count = lo + Math.floor(Math.random() * (hi - lo + 1));
  const pool = Array.from({length: total}, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  dreamChannels = pool.slice(0, count).sort((a, b) => a - b);
  gradientFn = tf.grad(lossForGradient);
}
`;

let patched = profilePrelude + '\n' + source
  .replace("const BUILD = '2026-08-19 v17';", "const BUILD = '2026-08-19 v19';")
  .replace("const MODEL_URL = './model/classic/model.json';", "let MODEL_URL = null;")
  .replace(oldLoss, newLoss)
  .replaceAll('v17 model', 'v19 model')
  .replaceAll('v17 WebGL', 'v19 WebGL')
  .replaceAll('v17 failed', 'v19 failed')
  .replaceAll('deepdream-classic-v17.png', 'deepdream-multidream-v19.png');

const oldRunStart = `  try {
    await ensureModel();
    let data;`;
const newRunStart = `  try {
    chooseDreamProfile();
    await ensureModel();
    chooseDreamChannels();
    try {
      await verifyExactProductionPath();
    } catch (featureError) {
      if (activeBackend !== 'webgl') throw featureError;
      setPhase('fallback', \`特徴抽選のWebGL自己診断失敗 / CPUへ移行\`);
      disposeModel();
      await loadModelFresh('cpu');
      chooseDreamChannels();
      await verifyExactProductionPath();
    }
    setPhase('ready', \`夢の種 \${dreamProfile.key} / \${dreamChannels.length} channels / \${activeBackend}\`);
    let data;`;

if (!patched.includes(oldRunStart)) {
  throw new Error('v19: reviewed runDream start block was not found');
}
patched = patched.replace(oldRunStart, newRunStart);

const oldDone = "status(abort ? '停止しました' : `完了 (${activeBackend})`);";
const newDone = "status(abort ? '停止しました' : `完了 (${activeBackend}) / ${dreamProfile.key}・${dreamChannels.length}ch`);";
if (!patched.includes(oldDone)) {
  throw new Error('v19: reviewed completion block was not found');
}
patched = patched.replace(oldDone, newDone);

// v18 proved the BN-fused gradient path. v19 keeps that numerical shell and
// changes only the source layer and a sparse, per-run feature objective.
(0, eval)(patched);
