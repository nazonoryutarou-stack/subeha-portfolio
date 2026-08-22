/* DeepDream Lab v21 ── 画面まわり -------------------------------------

   v20 との違い（重さ・再変換の二点が主眼）:

   1. v17のソースをfetchして文字列置換してevalする作りをやめた。
      あれだとエラー行が出ないので、落ちた時に何も分からない。
      いまは dream-engine.js を普通に import する。

   2. GPUテクスチャを都度解放する。
      tfjs の WEBGL_DELETE_TEXTURE_THRESHOLD は既定が -1（＝解放しない）。
      使い終わったテクスチャは再利用のためプールに残り続ける。
      一回目で確保した分が残ったまま二回目を始めるので、二回目で落ちる。

   3. 履歴を「枚数」ではなく「バイト数」で持つ。
      原寸4032×3072のImageDataは1枚47MB。8枚で376MB。これだけで落ちる。

   4. WebGLコンテキストが飛んだら、黙って死なずに作り直す。
   ------------------------------------------------------------------- */

import { dream, DEFAULTS } from './dream-engine.js?v=21';

const BUILD = '2026-08-22 v21';
const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const PRESETS = {
  light:  { label: '軽い',  workMax: 768,  tile: 192, octaves: 3, steps: [14, 10, 6] },
  normal: { label: '標準',  workMax: 1024, tile: 192, octaves: 4, steps: [16, 12, 8, 5] },
  deep:   { label: '濃い',  workMax: 1280, tile: 256, octaves: 4, steps: [18, 14, 10, 6] },
};

const ASSET_BANK_URL = './model/asset-banks.json?v=21';
const HISTORY_BYTES = 96 * 1024 * 1024;   // 履歴に使う上限

let original = null, current = null, history = [];
let dreamModel = null, gradientFn = null, dreamChannels = null;
let loadedLayer = null, activeAsset = null, activeAssetKey = 'animals';
let assetBanks = null, activeBackend = '', busy = false, abort = false;
let preset = 'normal', phase = 'idle';

const status = (t) => { $('status').textContent = `${t} ｜ ${BUILD}`; };
const setPhase = (p, t) => { phase = p; status(t); };
const mb = (n) => (n / 1048576).toFixed(0) + 'MB';

function memNote() {
  try {
    const m = tf.memory();
    const gpu = m.numBytesInGPU ? ` / GPU ${mb(m.numBytesInGPU)}` : '';
    return ` [テンソル${m.numTensors}${gpu}]`;
  } catch { return ''; }
}

/* --- WebGLの後始末を強制する ---------------------------------------- */
function tuneBackend() {
  try {
    /* 既定は -1（解放しない）。0 にすると使い終わり次第すぐ解放する。
       再変換で落ちるのは、ここが効いていないため。 */
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    /* DeepDreamに float32 の精度は要らない。テクスチャが半分になる。 */
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
  } catch (e) { console.warn('WebGL設定を変更できませんでした', e); }
}

/* --- 画像 ------------------------------------------------------------ */

const cloneImageData = (x) => new ImageData(new Uint8ClampedArray(x.data), x.width, x.height);
const bytesOf = (x) => x.width * x.height * 4;

function pushHistory() {
  if (!current) return;
  history.push(cloneImageData(current));
  let total = history.reduce((a, x) => a + bytesOf(x), 0);
  while (history.length && total > HISTORY_BYTES) {
    total -= bytesOf(history.shift());
  }
}

function drawData(data) {
  canvas.width = data.width;
  canvas.height = data.height;
  ctx.putImageData(data, 0, 0);
  current = cloneImageData(data);
  $('drop').classList.add('hidden');
}

async function loadFile(file) {
  try {
    /* EXIFの向きを尊重する。指定しないと機種によって横倒しになる。 */
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    /* 原寸のまま保持する。処理量は作業解像度側で決めるので、ここで縮めない。
       ただし巨大写真は入力Tensorだけで数百MBになるため16MPで保護する。 */
    const MAXPX = 16e6; // 12MPは原寸維持。48MP級はモバイルメモリ保護のため縮小。
    const r = Math.min(1, Math.sqrt(MAXPX / (bmp.width * bmp.height)));
    canvas.width = Math.round(bmp.width * r);
    canvas.height = Math.round(bmp.height * r);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    original = ctx.getImageData(0, 0, canvas.width, canvas.height);
    current = cloneImageData(original);
    history = [];
    $('drop').classList.add('hidden');
    const resized = r < 0.999;
    status(`${canvas.width}×${canvas.height} 読み込み完了${resized ? '（端末保護のため縮小）' : ''}`);
    bmp.close();
  } catch (e) {
    status(`画像読込失敗: ${e.message}`);
  }
}

/* --- アセットとモデル ------------------------------------------------ */

async function loadAssetBanks() {
  if (assetBanks) return assetBanks;
  const r = await fetch(ASSET_BANK_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error('幻覚アセット取得失敗: ' + r.status);
  assetBanks = await r.json();
  if (!assetBanks.assets) throw new Error('幻覚アセット定義が壊れています');
  return assetBanks;
}

function markButtons() {
  document.querySelectorAll('[data-asset]').forEach((b) =>
    b.classList.toggle('active', b.dataset.asset === activeAssetKey));
  document.querySelectorAll('[data-preset]').forEach((b) =>
    b.classList.toggle('active', b.dataset.preset === preset));
}

function disposeModel() {
  try { dreamModel?.dispose(); } catch {}
  dreamModel = null;
  gradientFn = null;
  loadedLayer = null;
}

function lossForGradient(x) {
  const y = dreamModel.apply(x.expandDims(0), { training: false });
  if (Array.isArray(y)) throw new Error('モデルの出力は1つでなければなりません');
  if (!dreamChannels || !dreamChannels.length) return y.mean();
  return tf.concat(dreamChannels.map((c) => y.slice([0, 0, 0, c], [-1, -1, -1, 1])), 3).mean();
}

async function ensureModel() {
  await loadAssetBanks();
  const next = assetBanks.assets[activeAssetKey];
  if (!next) throw new Error('未知の幻覚アセット: ' + activeAssetKey);
  activeAsset = next;
  dreamChannels = next.channels.slice();

  if (dreamModel && loadedLayer === next.layer) {
    gradientFn = tf.grad(lossForGradient);
    return;
  }
  disposeModel();

  for (const backend of ['webgl', 'cpu']) {
    try {
      setPhase('backend', `${backend} を初期化しています…`);
      if (!(await tf.setBackend(backend))) throw new Error(`${backend} が使えません`);
      await tf.ready();
      if (backend === 'webgl') tuneBackend();
      activeBackend = tf.getBackend();

      setPhase('model', `${next.label} / ${next.layer} を読み込んでいます…`);
      dreamModel = await tf.loadLayersModel(
        `./model/dreams/${next.layer}/model.json?v=21`,
        { onProgress: (p) => setPhase('model', `モデル取得 ${Math.round(p * 100)}%`) }
      );
      loadedLayer = next.layer;
      gradientFn = tf.grad(lossForGradient);

      /* 実際に使うのと同じ大きさのタイルで一度回して、通ることを確かめる */
      const opts = { ...DEFAULTS, ...PRESETS[preset] };
      setPhase('selftest', `${opts.tile}×${opts.tile} で動作確認中 (${activeBackend})`);
      const probe = tf.randomUniform([opts.tile, opts.tile, 3], -1, 1, 'float32', 156);
      const out = tf.tidy(() => gradientFn(probe));
      const v = await out.data();
      out.dispose(); probe.dispose();
      if (!v.length || !Number.isFinite(v[0])) throw new Error('動作確認の値が不正です');
      return;
    } catch (e) {
      console.warn(`${backend} で失敗`, e);
      disposeModel();
      if (backend === 'cpu') throw e;
    }
  }
}

/* WebGLが飛んだら黙って死なせない */
function watchContext() {
  try {
    const gl = tf.backend()?.gpgpu?.gl;
    if (!gl || gl.canvas.__ddWatched) return;
    gl.canvas.__ddWatched = true;
    gl.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      abort = true;
      disposeModel();
      status('WebGLが切断されました。もう一度「夢を見る」を押すと作り直します。');
    });
  } catch {}
}

/* --- 実行 ------------------------------------------------------------ */

async function runDream() {
  if (!current) return status('先に画像を選んでください');
  if (busy) return;
  busy = true; abort = false;
  $('run').disabled = true;
  pushHistory();

  const t0 = performance.now();
  try {
    await ensureModel();
    watchContext();

    const opts = { ...DEFAULTS, ...PRESETS[preset] };
    let last = 0;
    const data = await dream(tf, current, gradientFn, opts, {
      onPhase: setPhase,
      onProgress: (done, total, oi, on, si, sn) => {
        const now = performance.now();
        if (now - last < 120) return;
        last = now;
        const pct = Math.round(done / total * 100);
        const eta = done > 4 ? Math.round((now - t0) / done * (total - done) / 1000) : null;
        status(`${activeAsset.label} ${pct}% ・ ${oi}/${on}段 ${si}/${sn}`
          + (eta != null ? ` ・ 残り約${eta}秒` : '') + memNote());
      },
      shouldAbort: () => abort,
    });

    if (!data) { status('停止しました'); return; }
    drawData(data);
    const sec = ((performance.now() - t0) / 1000).toFixed(1);
    status((abort ? '停止（途中まで）' : '完了')
      + ` ${sec}秒 / ${activeAsset.label} / ${data.width}×${data.height} / ${PRESETS[preset].label}`
      + memNote());
  } catch (e) {
    console.error(e);
    status(`エラー [${phase}/${activeBackend || '?'}]: ${e?.message || e}${memNote()}`);
  } finally {
    busy = false;
    $('run').disabled = false;
    /*
      全変数破棄APIは呼ばない。LayersModel の重みも tf.Variable なので、
      ここで全変数を破棄すると dreamModel だけが生き残ったように見えて
      2回目の変換で壊れる。モデルは disposeModel() で明示的に寿命管理し、
      変換中の一時テンソルは dream-engine.js の tidy/dispose に任せる。
    */
  }
}

/* --- 配線 ------------------------------------------------------------ */

$('file').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) loadFile(f); });
$('run').addEventListener('click', runDream);
$('stop').addEventListener('click', () => { abort = true; status('停止しています…'); });
$('undo').addEventListener('click', () => { const x = history.pop(); if (x) drawData(x); });
$('reset').addEventListener('click', () => { if (original) { history = []; drawData(original); } });

$('download').addEventListener('click', () => {
  /* toDataURL は原寸だと数十MBの文字列になり、端末によっては固まる */
  canvas.toBlob((blob) => {
    if (!blob) return status('保存に失敗しました');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deepdream-${activeAssetKey}-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
});

document.querySelectorAll('[data-asset]').forEach((b) => {
  b.addEventListener('click', () => {
    if (busy) return;
    activeAssetKey = b.dataset.asset;
    markButtons();
    status(`アセット: ${b.textContent}`);
  });
});
document.querySelectorAll('[data-preset]').forEach((b) => {
  b.addEventListener('click', () => {
    if (busy) return;
    preset = b.dataset.preset;
    markButtons();
    const p = PRESETS[preset];
    status(`重さ: ${p.label}（作業${p.workMax}px / タイル${p.tile}px / ${p.octaves}段）`);
  });
});

const drop = $('drop');
['dragover', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
document.addEventListener('drop', (e) => { const f = e.dataTransfer?.files?.[0]; if (f) loadFile(f); });
drop.addEventListener('click', () => $('file').click());

markButtons();
status(typeof tf === 'undefined' ? 'TensorFlow.jsの読込に失敗しました' : '画像を選んでください');
