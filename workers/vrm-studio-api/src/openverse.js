const OPENVERSE_API = 'https://api.openverse.org/v1/images';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

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

const fetchImageBytes = async (rawUrl) => {
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`unsupported image URL scheme: ${url.protocol}`);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {'accept': 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8'},
  });
  if (!response.ok) throw new Error(`image fetch HTTP ${response.status}`);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new Error('image exceeds import size limit');
  const mime = imageMimeAllowed(response.headers.get('content-type'));
  if (!mime) throw new Error(`unsupported image type: ${response.headers.get('content-type') || 'unknown'}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error('image response is empty');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('image exceeds import size limit');
  return {bytes, mime};
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
  });
};
