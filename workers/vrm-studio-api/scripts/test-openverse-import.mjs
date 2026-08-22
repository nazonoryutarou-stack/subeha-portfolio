import assert from 'node:assert/strict';
import {
  fetchImageBytes,
  imageSignatureMatches,
  isPrivateImageHost,
  validateImageImportUrl,
} from '../src/openverse.js';

for (const host of [
  'localhost',
  'api.localhost',
  '127.0.0.1',
  '10.0.0.1',
  '169.254.169.254',
  '172.16.0.1',
  '172.31.255.255',
  '192.168.1.1',
  '100.64.0.1',
  '::1',
  'fc00::1',
  'fd12::1',
  'fe80::1',
]) {
  assert.equal(isPrivateImageHost(host), true, `${host} must be private`);
}
assert.equal(isPrivateImageHost('images.example.com'), false);
assert.equal(validateImageImportUrl('https://images.example.com/a.png').hostname, 'images.example.com');
assert.throws(() => validateImageImportUrl('file:///etc/passwd'), /unsupported image URL scheme/);
assert.throws(() => validateImageImportUrl('https://user:pass@images.example.com/a.png'), /credentials/);
assert.throws(() => validateImageImportUrl('http://127.0.0.1/a.png'), /private\/local/);

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
]);
assert.equal(imageSignatureMatches(png, 'image/png'), true);
assert.equal(imageSignatureMatches(new TextEncoder().encode('<html>nope</html>'), 'image/png'), false);
assert.equal(imageSignatureMatches(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'), true);
assert.equal(imageSignatureMatches(new TextEncoder().encode('GIF89a....'), 'image/gif'), true);
const webp = new Uint8Array(12);
webp.set(new TextEncoder().encode('RIFF'), 0);
webp.set(new TextEncoder().encode('WEBP'), 8);
assert.equal(imageSignatureMatches(webp, 'image/webp'), true);

let calls = 0;
await assert.rejects(
  () => fetchImageBytes('https://images.example.com/start.png', async () => {
    calls += 1;
    return new Response(null, {status: 302, headers: {location: 'http://127.0.0.1/private.png'}});
  }),
  /private\/local/,
);
assert.equal(calls, 1, 'private redirect must be rejected before second fetch');

const imported = await fetchImageBytes('https://images.example.com/a.png', async () => new Response(png, {
  status: 200,
  headers: {'content-type': 'image/png'},
}));
assert.equal(imported.mime, 'image/png');
assert.deepEqual([...imported.bytes], [...png]);

await assert.rejects(
  () => fetchImageBytes('https://images.example.com/fake.png', async () => new Response('<html>fake</html>', {
    status: 200,
    headers: {'content-type': 'image/png'},
  })),
  /image signature/,
);

const tooLarge = new Uint8Array(6 * 1024 * 1024 + 1);
tooLarge.set(png.subarray(0, 8));
await assert.rejects(
  () => fetchImageBytes('https://images.example.com/huge.png', async () => new Response(tooLarge, {
    status: 200,
    headers: {'content-type': 'image/png'},
  })),
  /size limit/,
);

console.log('Openverse import safety tests passed');
