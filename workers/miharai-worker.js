export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '*';
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || origin,
      'Access-Control-Allow-Headers': 'authorization,content-type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Vary': 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/records') return json({ error: 'not found' }, 404, cors);

    const auth = request.headers.get('Authorization') || '';
    if (!env.ADMIN_KEY || auth !== `Bearer ${env.ADMIN_KEY}`) return json({ error: 'unauthorized' }, 401, cors);

    try {
      const body = await request.json();
      validate(body);

      const repo = env.GITHUB_REPO || 'nazonoryutarou-stack/subeha-portfolio';
      const branch = env.GITHUB_BRANCH || 'main';
      const path = env.DATA_PATH || 'miharai/data.json';
      if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured');

      const api = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
      const headers = {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'miharai-map-worker'
      };

      const current = await fetch(api, { headers });
      if (!current.ok) throw new Error(`GitHub read failed: ${current.status}`);
      const file = await current.json();
      const text = decodeBase64Utf8(file.content.replace(/\n/g, ''));
      const records = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error('data.json is not an array');

      const now = new Date();
      const id = String(body.id || '').trim() || nextId(records, now);
      if (records.some(r => r.id === id)) throw new Error(`record id already exists: ${id}`);

      const blurred = blurCoordinate(Number(body.lat), Number(body.lng), clamp(Number(body.blur) || 1000, 100, 10000));
      const record = {
        id,
        name: clean(body.name, 120),
        area: clean(body.area, 120),
        lat: round(blurred.lat, 5),
        lng: round(blurred.lng, 5),
        type: clean(body.type || '未分類', 60),
        status: clean(body.status || '観測中', 60),
        risk: clamp(Math.round(Number(body.risk) || 1), 1, 5),
        observed: dateOnly(body.observed) || now.toISOString().slice(0, 10),
        updated: dateOnly(body.updated) || now.toISOString().slice(0, 10),
        description: clean(body.description, 3000),
        reason: clean(body.reason, 500)
      };

      records.push(record);
      records.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')) || String(a.id).localeCompare(String(b.id)));
      const content = encodeBase64Utf8(JSON.stringify(records, null, 2) + '\n');
      const write = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Add miharai record ${id}`, content, sha: file.sha, branch })
      });
      if (!write.ok) {
        const detail = await write.text();
        throw new Error(`GitHub write failed: ${write.status} ${detail.slice(0, 300)}`);
      }
      const result = await write.json();
      return json({ ok: true, record, commit: result.commit?.sha || null }, 200, cors);
    } catch (error) {
      return json({ error: String(error?.message || error) }, 400, cors);
    }
  }
};

function validate(x) {
  if (!x || typeof x !== 'object') throw new Error('invalid body');
  if (!String(x.name || '').trim()) throw new Error('name is required');
  const lat = Number(x.lat), lng = Number(x.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('invalid latitude');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('invalid longitude');
}
function clean(v, max) { return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
function round(n, d) { const p = 10 ** d; return Math.round(n * p) / p; }
function dateOnly(v) { const s = String(v || ''); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function nextId(records, now) {
  const year = now.getUTCFullYear();
  let max = 0;
  for (const r of records) {
    const m = String(r.id || '').match(/^MHR-(\d{4})-(\d{4})$/);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  }
  return `MHR-${year}-${String(max + 1).padStart(4, '0')}`;
}
function blurCoordinate(lat, lng, radiusMeters) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radiusMeters;
  const dLat = (distance * Math.cos(angle)) / 111320;
  const cos = Math.max(0.15, Math.cos(lat * Math.PI / 180));
  const dLng = (distance * Math.sin(angle)) / (111320 * cos);
  return { lat: lat + dLat, lng: lng + dLng };
}
function decodeBase64Utf8(b64) {
  const binary = atob(b64); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes);
}
function encodeBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text); let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(binary);
}
function json(value, status, headers) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } }); }
