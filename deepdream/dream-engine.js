/* DeepDream エンジン ── DOMに触らない。だから単体で試験できる。 --------

   v20 までの作りとの違い:

   1. 出力の作り方
      v20 は「原寸のまま全オクターブを回す」。12MPの写真で 19,456 回の
      タイル勾配計算になり、10〜25分かかっていた。
      v21 は作業解像度に上限を置き、**差分（detail）だけを原寸へ戻して
      原画像に足す**。原寸の細部は原画像のまま残るので、解像度は落ちない。

   2. タイル
      96px タイルだと mixed5 の特徴マップが 4×4 しかなく、模様が育たない。
      192〜256px にすると 10×10〜14×14 になり、回数も減る。

   3. 縦横比
      v20 は縦横それぞれ独立にタイル境界へ切り下げていたので、
      オクターブごとに縦横比が変わっていた（模様が伸びる）。
      v21 はオクターブの寸法を比のまま出し、タイル分割の直前にだけ余白を足す。

   4. 後始末
      作ったテンソルは必ず捨てる。捨て漏れがあると二回目で落ちる。
   ------------------------------------------------------------------- */

export const DEFAULTS = {
  tile: 192,
  workMax: 1024,
  octaves: 4,
  octaveScale: 1.4,
  steps: [16, 12, 8, 5],
  stepSize: 0.014,
  jitter: 1.0,
};

export function imageDataToTensor(tf, data) {
  const { width, height } = data;
  const src = data.data;
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < src.length; i += 4) {
    rgb[j++] = src[i] / 127.5 - 1;
    rgb[j++] = src[i + 1] / 127.5 - 1;
    rgb[j++] = src[i + 2] / 127.5 - 1;
  }
  return tf.tensor3d(rgb, [height, width, 3], 'float32');
}

export async function tensorToImageData(tf, t) {
  const rgb = tf.tidy(() => t.add(1).mul(127.5).clipByValue(0, 255));
  const [h, w] = rgb.shape;
  const vals = await rgb.data();
  rgb.dispose();
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < vals.length; i += 3, j += 4) {
    out[j] = vals[i]; out[j + 1] = vals[i + 1]; out[j + 2] = vals[i + 2]; out[j + 3] = 255;
  }
  return new ImageDataCtor(out, w, h);
}
let ImageDataCtor = typeof ImageData !== 'undefined' ? ImageData : null;
export function setImageDataCtor(C) { ImageDataCtor = C; }

export function octaveShapes(h, w, { octaves, octaveScale, tile }) {
  const out = [];
  for (let i = octaves - 1; i >= 0; i--) {
    const s = Math.pow(octaveScale, i);
    let oh = Math.round(h / s);
    let ow = Math.round(w / s);
    const m = Math.min(oh, ow);
    if (m < tile) { const k = tile / m; oh = Math.round(oh * k); ow = Math.round(ow * k); }
    if (!out.length || out[out.length - 1][0] !== oh || out[out.length - 1][1] !== ow) out.push([oh, ow]);
  }
  return out;
}

function roll(tf, t, sy, sx) {
  return tf.tidy(() => {
    const [h, w] = t.shape;
    const y = ((sy % h) + h) % h;
    const x = ((sx % w) + w) % w;
    let r = t;
    if (y) r = tf.concat([r.slice([y, 0, 0], [h - y, -1, -1]), r.slice([0, 0, 0], [y, -1, -1])], 0);
    if (x) r = tf.concat([r.slice([0, x, 0], [-1, w - x, -1]), r.slice([0, 0, 0], [-1, x, -1])], 1);
    return r === t ? t.clone() : r;
  });
}

async function tiledStep(tf, img, gradientFn, opts, onTile, shouldAbort) {
  const { tile, stepSize, jitter } = opts;
  const [h, w] = img.shape;
  const sy = Math.floor(Math.random() * tile * jitter);
  const sx = Math.floor(Math.random() * tile * jitter);
  const shifted = roll(tf, img, sy, sx);
  const ph = (tile - (h % tile)) % tile;
  const pw = (tile - (w % tile)) % tile;
  const padded = ph || pw ? tf.pad(shifted, [[0, ph], [0, pw], [0, 0]], 0) : shifted.clone();
  shifted.dispose();
  const [H, W] = padded.shape;
  const rows = [];
  try {
    for (let y = 0; y < H; y += tile) {
      const cols = [];
      try {
        for (let x = 0; x < W; x += tile) {
          if (shouldAbort && shouldAbort()) return null;
          const stepped = tf.tidy(() => {
            const t = padded.slice([y, x, 0], [tile, tile, 3]);
            const g = gradientFn(t);
            const std = tf.moments(g).variance.sqrt().add(1e-8);
            return t.add(g.div(std).mul(stepSize)).clipByValue(-1, 1);
          });
          cols.push(stepped);
          if (onTile) onTile();
        }
        rows.push(tf.concat(cols, 1));
      } finally {
        for (const c of cols) c.dispose();
      }
      if (typeof requestAnimationFrame !== 'undefined') await new Promise((r) => requestAnimationFrame(r));
    }
    const merged = tf.concat(rows, 0);
    const cropped = ph || pw ? tf.tidy(() => merged.slice([0, 0, 0], [h, w, 3])) : merged.clone();
    merged.dispose();
    const back = roll(tf, cropped, -sy, -sx);
    cropped.dispose();
    return back;
  } finally {
    for (const r of rows) r.dispose();
    padded.dispose();
  }
}

export async function dream(tf, sourceImageData, gradientFn, userOpts = {}, hooks = {}) {
  const opts = { ...DEFAULTS, ...userOpts };
  const { onPhase, onProgress, shouldAbort } = hooks;
  const abort = () => (shouldAbort ? shouldAbort() : false);
  let full = null, work = null, base = null, detail = null, src = null, out = null;
  try {
    onPhase?.('input', '原画像を読み込んでいます');
    full = imageDataToTensor(tf, sourceImageData);
    const [fh, fw] = full.shape;
    const ratio = Math.min(1, opts.workMax / Math.max(fh, fw));
    const wh = Math.max(opts.tile, Math.round(fh * ratio));
    const ww = Math.max(opts.tile, Math.round(fw * ratio));
    work = ratio < 1 ? tf.tidy(() => tf.image.resizeBilinear(full, [wh, ww], true)) : full.clone();
    const shapes = octaveShapes(wh, ww, opts);
    const totalTiles = shapes.reduce((a, [h, w], i) => {
      const th = Math.ceil(h / opts.tile), tw = Math.ceil(w / opts.tile);
      return a + th * tw * opts.steps[Math.min(i, opts.steps.length - 1)];
    }, 0);
    onPhase?.('octave', `${shapes.length}段 / 作業 ${ww}×${wh} / タイル${opts.tile}px / 計${totalTiles}回`);
    let done = 0;
    for (let oi = 0; oi < shapes.length; oi++) {
      if (abort()) break;
      const [h, w] = shapes[oi];
      base = tf.tidy(() => tf.image.resizeBilinear(work, [h, w], true));
      if (detail) {
        const up = tf.tidy(() => tf.image.resizeBilinear(detail, [h, w], true));
        detail.dispose(); detail = up;
        src = tf.tidy(() => base.add(detail).clipByValue(-1, 1));
      } else {
        src = base.clone();
      }
      const steps = opts.steps[Math.min(oi, opts.steps.length - 1)];
      for (let s = 0; s < steps; s++) {
        if (abort()) break;
        const next = await tiledStep(tf, src, gradientFn, opts,
          () => { done++; onProgress?.(done, totalTiles, oi + 1, shapes.length, s + 1, steps); },
          abort);
        if (!next) break;
        src.dispose(); src = next;
      }
      if (detail) detail.dispose();
      detail = tf.tidy(() => src.sub(base));
      src.dispose(); src = null;
      base.dispose(); base = null;
    }
    if (!detail) return null;
    onPhase?.('output', '差分を原寸に戻しています');
    out = tf.tidy(() => {
      const up = tf.image.resizeBilinear(detail, [fh, fw], true);
      return full.add(up).clipByValue(-1, 1);
    });
    const data = await tensorToImageData(tf, out);
    return data;
  } finally {
    for (const t of [full, work, base, detail, src, out]) {
      try { t?.dispose(); } catch {}
    }
  }
}
