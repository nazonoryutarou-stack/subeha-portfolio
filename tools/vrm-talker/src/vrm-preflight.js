const REQUIRED_VISEMES = ['aa', 'ih', 'ou', 'ee', 'oh'];
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;

const readGlbJson = async (file) => {
  const header = await file.slice(0, 20).arrayBuffer();
  if (header.byteLength < 20) throw new Error('VRM/GLBヘッダが短すぎます。');
  const view = new DataView(header);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('VRMがGLB形式ではありません。');
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`未対応のGLB version: ${version}`);
  const declaredLength = view.getUint32(8, true);
  if (declaredLength > file.size || declaredLength < 20) throw new Error('VRM/GLBの長さ情報が不正です。');
  const jsonLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== JSON_CHUNK || jsonLength <= 0) throw new Error('VRM/GLBのJSON chunkがありません。');
  if (20 + jsonLength > file.size) throw new Error('VRM/GLBのJSON chunk長が不正です。');
  const bytes = new Uint8Array(await file.slice(20, 20 + jsonLength).arrayBuffer());
  const text = new TextDecoder('utf-8').decode(bytes).replace(/[\u0000\u0020]+$/g, '');
  return JSON.parse(text);
};

const vrm1Expressions = (json) => {
  const preset = json?.extensions?.VRMC_vrm?.expressions?.preset;
  if (!preset || typeof preset !== 'object') return null;
  return new Set(Object.keys(preset));
};

const vrm0Expressions = (json) => {
  const groups = json?.extensions?.VRM?.blendShapeMaster?.blendShapeGroups;
  if (!Array.isArray(groups)) return null;
  const aliases = new Map([
    ['a', 'aa'],
    ['i', 'ih'],
    ['u', 'ou'],
    ['e', 'ee'],
    ['o', 'oh'],
  ]);
  const names = new Set();
  for (const group of groups) {
    const raw = String(group?.presetName || group?.name || '').trim().toLowerCase();
    if (aliases.has(raw)) names.add(aliases.get(raw));
    if (REQUIRED_VISEMES.includes(raw)) names.add(raw);
  }
  return names;
};

export const inspectVideoVrmFile = async (file) => {
  if (!(file instanceof Blob) || !file.size) throw new Error('VRMファイルがありません。');
  const json = await readGlbJson(file);
  const expressions = vrm1Expressions(json) || vrm0Expressions(json) || new Set();
  const missing = REQUIRED_VISEMES.filter((name) => !expressions.has(name));
  return {
    ok: missing.length === 0,
    missing,
    required: [...REQUIRED_VISEMES],
    vrmVersion: json?.extensions?.VRMC_vrm ? '1' : json?.extensions?.VRM ? '0' : 'unknown',
  };
};

export const requiredVideoVisemes = () => [...REQUIRED_VISEMES];
