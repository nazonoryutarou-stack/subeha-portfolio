#!/usr/bin/env node
import {readFileSync} from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const forIndex = args.indexOf('--for');
const mode = forIndex >= 0 ? args[forIndex + 1] : 'video';

if (!file) {
  console.error('使い方: node scripts/check-vrm.mjs <file.vrm> [--for video|web]');
  process.exit(2);
}

function readGlb(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error('GLB形式ではありません');
  const total = buffer.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let binOffset = null;
  while (offset < total) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('utf8', offset + 4, offset + 8);
    const start = offset + 8;
    if (type === 'JSON') json = JSON.parse(buffer.toString('utf8', start, start + length));
    if (type.startsWith('BIN')) binOffset = start;
    offset = start + length;
  }
  if (!json) throw new Error('glTF JSONチャンクがありません');
  return {json, buffer, binOffset, total};
}

const mouth = ['aa', 'ih', 'ou', 'ee', 'oh'];
const eye = ['blink'];
let glb;
try {
  glb = readGlb(file);
} catch (error) {
  console.error(`読めません: ${error.message}`);
  process.exit(2);
}

const document = glb.json;
const extensions = document.extensions || {};
const vrm = extensions.VRMC_vrm || extensions.VRM;
if (!vrm) {
  console.error('VRM拡張が見当たりません。VRMではない可能性があります。');
  process.exit(2);
}
const version = extensions.VRMC_vrm ? '1.0' : '0.x';

let presets = [];
if (extensions.VRMC_vrm) {
  presets = Object.keys((vrm.expressions && vrm.expressions.preset) || {});
} else {
  presets = ((vrm.blendShapeMaster || {}).blendShapeGroups || [])
    .map((blendShape) => (blendShape.presetName || blendShape.name || '').toLowerCase());
}

const morphNames = new Set();
for (const mesh of document.meshes || []) {
  for (const name of (mesh.extras || {}).targetNames || []) morphNames.add(name);
}

let triangles = 0;
for (const mesh of document.meshes || []) {
  for (const primitive of mesh.primitives || []) {
    if (primitive.indices != null) triangles += Math.floor(document.accessors[primitive.indices].count / 3);
  }
}

const images = document.images || [];
let maxTexture = 0;
let textureBytes = 0;
for (const image of images) {
  if (image.bufferView == null || glb.binOffset == null) continue;
  const view = document.bufferViews[image.bufferView];
  textureBytes += view.byteLength;
  const at = glb.binOffset + (view.byteOffset || 0);
  const header = glb.buffer.subarray(at, at + 32);
  if (header.toString('hex', 0, 8) === '89504e470d0a1a0a') {
    maxTexture = Math.max(maxTexture, header.readUInt32BE(16), header.readUInt32BE(20));
  }
}

const missingMouth = mouth.filter((name) => !presets.includes(name));
const missingEye = eye.filter((name) => !presets.includes(name));
const errors = [];
const warnings = [];

if (mode === 'video') {
  if (missingMouth.length === mouth.length) {
    errors.push(`口の表情が一つも無い（${mouth.join('/')}）。このモデルでは口パクは動かない。`);
  } else if (missingMouth.length) {
    errors.push(`口の表情が足りない: ${missingMouth.join(', ')}`);
  }
  if (missingEye.length) warnings.push(`瞬きの表情が無い: ${missingEye.join(', ')}`);
  if (maxTexture && maxTexture < 1024) {
    errors.push(`テクスチャが最大 ${maxTexture}px。動画用ではなくWeb軽量モデルの可能性があります。`);
  } else if (maxTexture && maxTexture < 2048) {
    warnings.push(`テクスチャ最大 ${maxTexture}px。寄り構図では粗さが出る可能性があります。`);
  }
  if (morphNames.size < 10) warnings.push(`モーフが ${morphNames.size} 種しかありません。`);
} else if (glb.total > 4 * 1024 * 1024) {
  warnings.push(`${(glb.total / 1048576).toFixed(1)}MB。Web初期表示には重い可能性があります。`);
}

console.log(`\n${file}`);
console.log(`  VRM       ${version}`);
console.log(`  サイズ     ${(glb.total / 1048576).toFixed(2)} MB`);
console.log(`  三角形     ${triangles.toLocaleString()}`);
console.log(`  モーフ     ${morphNames.size} 種`);
console.log(`  テクスチャ ${images.length}枚 / ${(textureBytes / 1048576).toFixed(2)} MB / 最大 ${maxTexture || '?'}px`);
console.log(`  表情       ${presets.length ? presets.join(', ') : '(なし)'}`);
console.log(`  口の形     ${mouth.map((name) => (presets.includes(name) ? `${name}✓` : `${name}✗`)).join(' ')}`);

if (warnings.length) {
  console.log('\n  注意:');
  for (const warning of warnings) console.log(`    - ${warning}`);
}
if (errors.length) {
  console.log('\n  不合格:');
  for (const error of errors) console.log(`    - ${error}`);
  console.log(`\n  → ${mode === 'video' ? '動画レンダーには使えません。' : 'Web用基準を満たしません。'}\n`);
  process.exit(1);
}
console.log(`\n  合格 ── ${mode === 'video' ? '動画レンダーに使えます。' : 'Web用に使えます。'}\n`);
