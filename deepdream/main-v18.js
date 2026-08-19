const source = await fetch('./main-v17.js?v=20260819-v18-shell', { cache: 'no-store' }).then((r) => {
  if (!r.ok) throw new Error(`DeepDream shell fetch failed: ${r.status}`);
  return r.text();
});

const patched = source
  .replace("const BUILD = '2026-08-19 v17';", "const BUILD = '2026-08-19 v18';")
  .replace("const MODEL_URL = './model/classic/model.json';", "const MODEL_URL = './model/classic/model.json?v=20260819-fusedbn1';")
  .replaceAll('v17 model', 'v18 model')
  .replaceAll('v17 WebGL', 'v18 WebGL')
  .replaceAll('v17 failed', 'v18 failed')
  .replaceAll('deepdream-classic-v17.png', 'deepdream-classic-v18.png');

// main-v17.js contains no imports/exports; execute the reviewed shell after the
// two deliberate substitutions above. Keeping the numerical pipeline identical
// isolates this release to the model fix: BatchNorm is fused out at build time.
(0, eval)(patched);
