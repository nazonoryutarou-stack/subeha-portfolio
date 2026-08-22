import assert from 'node:assert/strict';
import {inspectVideoVrmFile} from '../src/vrm-preflight.js';

const makeGlb = (preset) => {
  const json = JSON.stringify({
    asset: {version: '2.0'},
    extensions: {
      VRMC_vrm: {
        specVersion: '1.0',
        expressions: {preset},
      },
    },
  });
  const encoder = new TextEncoder();
  const source = encoder.encode(json);
  const paddedLength = Math.ceil(source.byteLength / 4) * 4;
  const jsonBytes = new Uint8Array(paddedLength);
  jsonBytes.fill(0x20);
  jsonBytes.set(source);

  const totalLength = 12 + 8 + paddedLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).set(jsonBytes);
  return new Blob([buffer], {type: 'model/gltf-binary'});
};

const valid = await inspectVideoVrmFile(makeGlb({aa: {}, ih: {}, ou: {}, ee: {}, oh: {}}));
assert.equal(valid.ok, true);
assert.deepEqual(valid.missing, []);
assert.equal(valid.vrmVersion, '1');

const missing = await inspectVideoVrmFile(makeGlb({aa: {}, ih: {}, ee: {}}));
assert.equal(missing.ok, false);
assert.deepEqual(missing.missing, ['ou', 'oh']);

await assert.rejects(
  () => inspectVideoVrmFile(new Blob([new Uint8Array([1, 2, 3])])),
  /ヘッダが短すぎます/,
);

console.log('Browser VRM preflight fixtures passed');
