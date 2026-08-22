import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULTS, octaveShapes} from './dream-engine.js';

const presets = {
  light:  {workMax: 768,  tile: 192, octaves: 3, steps: [14, 10, 6]},
  normal: {workMax: 1024, tile: 192, octaves: 4, steps: [16, 12, 8, 5]},
  deep:   {workMax: 1280, tile: 256, octaves: 4, steps: [18, 14, 10, 6]},
};

function plan(width, height, preset) {
  const opts = {...DEFAULTS, ...preset};
  const ratio = Math.min(1, opts.workMax / Math.max(width, height));
  const wh = Math.max(opts.tile, Math.round(height * ratio));
  const ww = Math.max(opts.tile, Math.round(width * ratio));
  const shapes = octaveShapes(wh, ww, opts);
  const tiles = shapes.reduce((sum, [h, w], i) => {
    return sum + Math.ceil(h / opts.tile) * Math.ceil(w / opts.tile) * opts.steps[Math.min(i, opts.steps.length - 1)];
  }, 0);
  return {ww, wh, shapes, tiles};
}

const band = octaveShapes(1000, 5000, {...DEFAULTS, ...presets.normal});
for (const [h, w] of band) {
  assert.ok(Math.abs(w / h - 5) < 0.03, `aspect ratio drifted: ${w}x${h}`);
}

const normal = plan(4032, 3072, presets.normal);
assert.ok(normal.tiles < 600, `normal preset became too heavy: ${normal.tiles}`);
assert.equal(Math.max(normal.ww, normal.wh), 1024);

const deep = plan(4032, 3072, presets.deep);
assert.ok(deep.tiles < 700, `deep preset became too heavy: ${deep.tiles}`);
assert.equal(Math.max(deep.ww, deep.wh), 1280);

const main = fs.readFileSync(new URL('./main-v21.js', import.meta.url), 'utf8');
assert.ok(!/\btf\.disposeVariables\s*\(/.test(main), 'main-v21.js must not call tf.disposeVariables()');

const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
assert.match(html, /main-v21\.js/);
assert.match(html, /data-preset="normal"/);

console.log('DeepDream v21 runtime contract passed');
console.log(`normal 12MP: ${normal.tiles} tile gradients / work ${normal.ww}x${normal.wh}`);
console.log(`deep   12MP: ${deep.tiles} tile gradients / work ${deep.ww}x${deep.wh}`);

class FakeImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

const alive = new Set();
const scopes = [];
let nextTensorId = 1;

class FakeTensor {
  constructor(shape) {
    this.shape = [...shape];
    this.id = nextTensorId++;
    this.disposed = false;
    alive.add(this);
    if (scopes.length) scopes.at(-1).add(this);
  }
  _same() { return new FakeTensor(this.shape); }
  add() { return this._same(); }
  sub() { return this._same(); }
  mul() { return this._same(); }
  div() { return this._same(); }
  sqrt() { return this._same(); }
  clipByValue() { return this._same(); }
  clone() { return this._same(); }
  slice(begin, size) {
    return new FakeTensor(size.map((n, i) => n === -1 ? this.shape[i] - begin[i] : n));
  }
  async data() {
    return new Float32Array(this.shape.reduce((a, b) => a * b, 1));
  }
  dispose() {
    if (this.disposed) throw new Error(`二重破棄 tensor#${this.id}`);
    this.disposed = true;
    alive.delete(this);
  }
}

function returnedTensors(value, out = new Set()) {
  if (value instanceof FakeTensor) out.add(value);
  else if (Array.isArray(value)) value.forEach((x) => returnedTensors(x, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((x) => returnedTensors(x, out));
  return out;
}

const fakeTf = {
  tensor3d(_values, shape) { return new FakeTensor(shape); },
  tidy(fn) {
    const scope = new Set();
    scopes.push(scope);
    let value;
    try { value = fn(); }
    finally { scopes.pop(); }
    const keep = returnedTensors(value);
    for (const tensor of scope) {
      if (!keep.has(tensor) && !tensor.disposed) tensor.dispose();
    }
    if (scopes.length) for (const tensor of keep) scopes.at(-1).add(tensor);
    return value;
  },
  image: {
    resizeBilinear(t, [h, w]) { return new FakeTensor([h, w, t.shape[2]]); },
  },
  pad(t, paddings) {
    return new FakeTensor(t.shape.map((n, i) => n + paddings[i][0] + paddings[i][1]));
  },
  concat(items, axis) {
    const shape = [...items[0].shape];
    shape[axis] = items.reduce((sum, t) => sum + t.shape[axis], 0);
    return new FakeTensor(shape);
  },
  moments() { return {variance: new FakeTensor([])}; },
};

const {dream, setImageDataCtor} = await import('./dream-engine.js');
setImageDataCtor(FakeImageData);
const tinySource = new FakeImageData(new Uint8ClampedArray(32 * 24 * 4), 32, 24);
const tinyOpts = {tile: 8, workMax: 32, octaves: 2, octaveScale: 1.4, steps: [2, 1], stepSize: 0.01, jitter: 1};
const fakeGradient = (t) => t.clone();

for (let i = 1; i <= 3; i++) {
  assert.equal(alive.size, 0, `run ${i} started with leaked tensors`);
  const result = await dream(fakeTf, tinySource, fakeGradient, tinyOpts);
  assert.ok(result instanceof FakeImageData);
  assert.equal(result.width, 32);
  assert.equal(result.height, 24);
  assert.equal(alive.size, 0, `run ${i} leaked tensors`);
}

let progress = 0;
const aborted = await dream(fakeTf, tinySource, fakeGradient, tinyOpts, {
  onProgress() { progress++; },
  shouldAbort() { return progress >= 5; },
});
assert.ok(aborted instanceof FakeImageData, 'abort should return the last complete image state');
assert.equal(alive.size, 0, 'abort leaked tensors');

console.log('DeepDream v21 tensor lifetime stub passed: 3 runs + abort, leaked tensors=0');
