const OPENVERSE_API = 'https://api.openverse.org/v1/images';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_REDIRECTS = 5;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
});

const imageMimeAllowed = (value) => {
  const mime = String(value || '').toLowerCase().split(';')[0].trim();
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(mime) ? mime : null;
};

const toBase64 = (bytes) => {
  let binary = '';
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) binary += String.fromCharCode(...bytes.subarray(i, i + block));
  return btoa(binary);
};

const privateIpv4 = (host) => {
  const parts = String(host || '').split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
};

export const isPrivateImageHost = (hostname) => {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (privateIpv4(host)) return true;
  if (host === '::' || host === '::1') return true;
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return true;
  if (host.startsWith('::ffff:')) {
    const mapped = host.slice('::ffff:'.length);
    if (privateIpv4(mapped)) return true;
  }
  return false;
};

export const validateImageImportUrl = (rawUrl, baseUrl = undefined) => {
  const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`unsupported image URL scheme: ${url.protocol}`);
  }
  if (url.username || url.password) throw new Error('image URL credentials are not allowed');
  if (isPrivateImageHost(url.hostname)) throw new Error('private/local image host is not allowed');
  return url;
};

const readLimitedBody = async (response, maxBytes = MAX_IMAGE_BYTES) => {
  if (!response.body) throw new Error('image response has no body');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('image exceeds import size limit').catch(() => {});
        throw new Error('image exceeds import size limit');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  if (!total) throw new Error('image response is empty');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const ascii = (bytes, start, end) => String.fromCharCode(...bytes.subarray(start, end));

export const imageSignatureMatches = (bytes, mime) => {
  if (!(bytes instanceof Uint8Array)) return false;
  const type = String(mime || '').toLowerCase();
  if (type === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= 8 && signature.every((value, index) => bytes[index] === value);
  }
  if (type === 'image/jpeg' || type === 'image/jpg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === 'image/gif') {
    return bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6));
  }
  if (type === 'image/webp') {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
  }
  return false;
};

export const fetchImageBytes = async (rawUrl, fetchImpl = fetch) => {
  let url = validateImageImportUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    for (let redirectCount = 0; redirectCount <= MAX_IMAGE_REDIRECTS; redirectCount++) {
      const response = await fetchImpl(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {'accept': 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8'},
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount >= MAX_IMAGE_REDIRECTS) throw new Error('too many image redirects');
        const location = response.headers.get('location');
        if (!location) throw new Error('image redirect has no location');
        url = validateImageImportUrl(location, url);
        continue;
      }

      if (!response.ok) throw new Error(`image fetch HTTP ${response.status}`);
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_IMAGE_BYTES) throw new Error('image exceeds import size limit');
      const mime = imageMimeAllowed(response.headers.get('content-type'));
      if (!mime) throw new Error(`unsupported image type: ${response.headers.get('content-type') || 'unknown'}`);
      const bytes = await readLimitedBody(response);
      if (!imageSignatureMatches(bytes, mime)) throw new Error(`image signature does not match ${mime}`);
      return {bytes, mime, finalUrl: url.href};
    }
    throw new Error('too many image redirects');
  } finally {
    clearTimeout(timer);
  }
};

export const handleImportOpenverseImage = async (request) => {
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  if (!id) return json({error: 'Openverse image id is required'}, 400);
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return json({error: 'invalid Openverse image id'}, 400);

  const metadataResponse = await fetch(`${OPENVERSE_API}/${encodeURIComponent(id)}/`, {
    headers: {'accept': 'application/json'},
  });
  if (!metadataResponse.ok) return json({error: `Openverse metadata HTTP ${metadataResponse.status}`}, metadataResponse.status === 404 ? 404 : 502);
  const metadata = await metadataResponse.json();
  const candidates = [metadata?.thumbnail, metadata?.url]
    .map((value) => String(value || '').trim())
    .filter((value, index, all) => value && all.indexOf(value) === index);
  if (!candidates.length) return json({error: 'Openverse record has no image URL'}, 422);

  let imported = null;
  let lastError = null;
  for (const candidate of candidates) {
    try {
      imported = await fetchImageBytes(candidate);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!imported) return json({error: `Openverse image import failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`}, 502);

  return json({
    id,
    dataUrl: `data:${imported.mime};base64,${toBase64(imported.bytes)}`,
    mime: imported.mime,
    title: metadata?.title || null,
    creator: metadata?.creator || null,
    license: metadata?.license || null,
    sourceUrl: metadata?.foreign_landing_url || null,
    originalUrl: metadata?.url || null,
    thumbnailUrl: metadata?.thumbnail || null,
    importedFromUrl: imported.finalUrl,
  });
};
