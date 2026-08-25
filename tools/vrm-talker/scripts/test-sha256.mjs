import assert from 'node:assert/strict';
import {Sha256, sha256Blob} from '../src/sha256.js';

const enc = new TextEncoder();
const vectors = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['The quick brown fox jumps over the lazy dog', 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'],
];

for (const [text, expected] of vectors) {
  const direct = new Sha256().update(enc.encode(text)).digestHex();
  assert.equal(direct, expected, `direct SHA-256 mismatch for ${JSON.stringify(text)}`);

  const hash = new Sha256();
  const bytes = enc.encode(text);
  for (let i = 0; i < bytes.length; i++) hash.update(bytes.subarray(i, i + 1));
  assert.equal(hash.digestHex(), expected, `chunked SHA-256 mismatch for ${JSON.stringify(text)}`);
}

const blob = new Blob([enc.encode('abc')]);
assert.equal(
  await sha256Blob(blob, {chunkSize: 1}),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'sha256Blob chunked result mismatch',
);

console.log('SHA-256 streaming tests passed');
