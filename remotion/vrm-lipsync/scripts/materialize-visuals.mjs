import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, 'public');
const clipPath = path.join(publicDir, 'clip.json');
const visualsDir = path.join(publicDir, 'visuals');
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

if (!fs.existsSync(clipPath)) {
  console.error('public/clip.json がありません。先にStudio projectをimportしてください。');
  process.exit(1);
}

const clip = JSON.parse(fs.readFileSync(clipPath, 'utf8'));
const refs = Array.isArray(clip.visualReferences) ? clip.visualReferences : [];
const backgroundDataUrl = String(clip.backgroundDataUrl || '').trim();
if (!refs.length && !backgroundDataUrl) {
  console.log('Visual references/background: 0 / materialize skip');
  process.exit(0);
}

fs.mkdirSync(visualsDir, {recursive: true});

const extForMime = (mime) => {
  const value = String(mime || '').toLowerCase().split(';')[0].trim();
  if (value === 'image/png') return 'png';
  if (value === 'image/jpeg' || value === 'image/jpg') return 'jpg';
  if (value === 'image/webp') return 'webp';
  if (value === 'image/gif') return 'gif';
  return null;
};

const safeStem = (value) => String(value || 'visual')
  .replace(/[^a-zA-Z0-9_-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48) || 'visual';

const parseDataUrl = (value) => {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-zA-Z0-9+/=\s]+)$/.exec(String(value || ''));
  if (!match) return null;
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length) throw new Error('画像data URLが空です。');
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`画像が大きすぎます: ${(bytes.length / 1048576).toFixed(1)}MB`);
  return {bytes, mime: match[1]};
};

const assertSafeRemoteUrl = (raw) => {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`未対応URL scheme: ${url.protocol}`);
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '::1' || /^127\./.test(host)) {
    throw new Error('ローカルアドレスは画像取得元にできません。');
  }
  return url;
};

const fetchImage = async (raw) => {
  const url = assertSafeRemoteUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8',
        'user-agent': 'subeha-vrm-studio/1.0',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mime.startsWith('image/')) throw new Error(`画像ではないContent-Type: ${mime || 'unknown'}`);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > MAX_IMAGE_BYTES) throw new Error(`画像が大きすぎます: ${(declared / 1048576).toFixed(1)}MB`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) throw new Error('画像レスポンスが空です。');
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`画像が大きすぎます: ${(bytes.length / 1048576).toFixed(1)}MB`);
    return {bytes, mime};
  } finally {
    clearTimeout(timer);
  }
};

const materializeCandidates = async (candidates, stem) => {
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const data = candidate.startsWith('data:') ? parseDataUrl(candidate) : await fetchImage(candidate);
      if (!data) throw new Error('未対応のdata URLです。');
      const ext = extForMime(data.mime);
      if (!ext) throw new Error(`未対応画像形式: ${data.mime}`);
      const fingerprint = createHash('sha256').update(data.bytes).digest('hex').slice(0, 12);
      const filename = `${safeStem(stem)}-${fingerprint}.${ext}`;
      fs.writeFileSync(path.join(visualsDir, filename), data.bytes);
      return `visuals/${filename}`;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || '画像を固定化できませんでした。'));
};

const updated = [];
for (let index = 0; index < refs.length; index++) {
  const ref = refs[index];
  const candidates = [ref.url, ref.thumbnailUrl]
    .map((value) => String(value || '').trim())
    .filter((value, i, all) => value && all.indexOf(value) === i);
  if (!candidates.length) throw new Error(`画像 #${index + 1} にURL/dataがありません。`);
  try {
    const renderFile = await materializeCandidates(candidates, `${String(index + 1).padStart(2, '0')}-${ref.id || ref.kind}`);
    updated.push({...ref, renderFile});
    console.log(`Visual ${index + 1}/${refs.length}: ${renderFile}`);
  } catch (error) {
    throw new Error(`画像 #${index + 1} を固定化できません: ${error instanceof Error ? error.message : String(error)}`);
  }
}
clip.visualReferences = updated;

if (backgroundDataUrl) {
  try {
    clip.backgroundFile = await materializeCandidates([backgroundDataUrl], 'background');
    console.log(`Background: ${clip.backgroundFile}`);
  } catch (error) {
    throw new Error(`背景画像を固定化できません: ${error instanceof Error ? error.message : String(error)}`);
  }
} else {
  clip.backgroundFile = null;
}
delete clip.backgroundDataUrl;

fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2) + '\n');
console.log(`Visual references materialized: ${updated.length}`);
