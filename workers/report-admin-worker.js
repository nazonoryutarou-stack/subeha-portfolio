export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method === 'GET' && url.pathname === '/login') {
        const identity = await verifyCloudflareAccess(request, env);
        requireOwnerEmail(identity.email, env);
        const returnUrl = safeReturnUrl(url.searchParams.get('return'), env);
        const token = await signSession({
          email: identity.email,
          role: 'owner',
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        }, env.SESSION_SECRET);
        return Response.redirect(`${returnUrl}#token=${encodeURIComponent(token)}`, 302);
      }

      if (request.method === 'GET' && url.pathname === '/api/me') {
        const owner = await requireOwner(request, env);
        return json({ ok: true, owner: true, email: owner.email }, 200, cors);
      }

      if (request.method === 'GET' && url.pathname === '/api/reports') {
        await requireOwner(request, env);
        const index = await loadReportIndex(env);
        const q = String(url.searchParams.get('q') || '').trim().toLocaleLowerCase('ja-JP');
        const limit = clamp(Number(url.searchParams.get('limit')) || 100, 1, 500);
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

        let rows = index.slice().sort((a, b) => Number(b.episode) - Number(a.episode));
        if (q) {
          rows = rows.filter((row) => {
            const haystack = `${row.episode || ''} ${row.date || ''} ${row.title || ''} ${(row.headings || []).join(' ')} ${row.search_text || ''}`.toLocaleLowerCase('ja-JP');
            return haystack.includes(q);
          });
        }

        const total = rows.length;
        const items = rows.slice(offset, offset + limit).map(stripSearchText);
        return json({
          ok: true,
          total,
          latest_episode: index.reduce((m, row) => Math.max(m, Number(row.episode) || 0), 0),
          items
        }, 200, cors);
      }

      const match = url.pathname.match(/^\/api\/reports\/(\d{1,6})$/);
      if (request.method === 'GET' && match) {
        await requireOwner(request, env);
        const markdown = await githubReadText(`reports/${match[1]}.md`, env);
        if (markdown == null) return json({ error: 'report not found' }, 404, cors);
        return new Response(markdown, {
          status: 200,
          headers: {
            ...cors,
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'private, max-age=60'
          }
        });
      }

      return json({ error: 'not found' }, 404, cors);
    } catch (error) {
      return json({ error: String(error?.message || error) }, Number(error?.status) || 400, cors);
    }
  }
};

async function requireOwner(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw httpError(401, 'owner login required');
  const session = await verifySession(token, env.SESSION_SECRET);
  if (session.role !== 'owner') throw httpError(403, 'owner only');
  requireOwnerEmail(session.email, env);
  return session;
}

function requireOwnerEmail(email, env) {
  const allowed = String(env.ADMIN_EMAILS || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.length) throw new Error('ADMIN_EMAILS is not configured');
  if (!allowed.includes(String(email || '').trim().toLowerCase())) throw httpError(403, 'owner only');
}

async function loadReportIndex(env) {
  const text = await githubReadText('reports/index.json', env);
  if (text) {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  }
  const listing = await githubList('reports', env);
  return (listing || [])
    .filter((item) => /^\d+\.md$/.test(item.name || ''))
    .map((item) => {
      const episode = Number(item.name.replace(/\.md$/, ''));
      return { episode, date: '', title: `Gravity 第${episode}回`, headings: [], search_text: String(episode) };
    });
}

async function githubReadText(path, env) {
  const repo = env.TRANSCRIPTS_REPO || 'nazonoryutarou-stack/subeha-transcripts';
  const branch = env.TRANSCRIPTS_BRANCH || 'main';
  const api = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(api, { headers: githubHeaders(env) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  const file = await response.json();
  return decodeBase64Utf8(String(file.content || '').replace(/\n/g, ''));
}

async function githubList(path, env) {
  const repo = env.TRANSCRIPTS_REPO || 'nazonoryutarou-stack/subeha-transcripts';
  const branch = env.TRANSCRIPTS_BRANCH || 'main';
  const api = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(api, { headers: githubHeaders(env) });
  if (!response.ok) throw new Error(`GitHub list failed: ${response.status}`);
  return response.json();
}

function githubHeaders(env) {
  if (!env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN is not configured');
  return {
    'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'subeha-report-admin-worker'
  };
}

async function verifyCloudflareAccess(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  if (!token) throw httpError(401, 'Cloudflare Access login required');
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) throw new Error('Cloudflare Access is not configured');

  const parts = token.split('.');
  if (parts.length !== 3) throw httpError(401, 'invalid Access token');
  const header = JSON.parse(decodeBase64Url(parts[0]));
  const payload = JSON.parse(decodeBase64Url(parts[1]));

  const certsUrl = `https://${normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN)}/cdn-cgi/access/certs`;
  const certsResponse = await fetch(certsUrl, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!certsResponse.ok) throw new Error(`Access cert fetch failed: ${certsResponse.status}`);
  const certs = await certsResponse.json();
  const jwk = (certs.keys || []).find((key) => key.kid === header.kid);
  if (!jwk) throw httpError(401, 'unknown Access signing key');

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!verified) throw httpError(401, 'invalid Access signature');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw httpError(401, 'Access token expired');
  if (payload.nbf && payload.nbf > now) throw httpError(401, 'Access token not active');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.CF_ACCESS_AUD)) throw httpError(401, 'wrong Access audience');
  const expectedIssuer = `https://${normalizeTeamDomain(env.CF_ACCESS_TEAM_DOMAIN)}`;
  if (payload.iss !== expectedIssuer) throw httpError(401, 'wrong Access issuer');

  const email = String(payload.email || request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim().toLowerCase();
  if (!email || !email.includes('@')) throw httpError(401, 'email missing from Access token');
  return { email };
}

function normalizeTeamDomain(value) {
  return String(value || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function signSession(payload, secret) {
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  const body = base64UrlEncode(JSON.stringify({ v: 1, ...payload }));
  const key = await hmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifySession(token, secret) {
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  const parts = String(token || '').split('.');
  if (parts.length !== 2) throw httpError(401, 'invalid session');
  const key = await hmacKey(secret, ['verify']);
  const verified = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(parts[1]), new TextEncoder().encode(parts[0]));
  if (!verified) throw httpError(401, 'invalid session signature');
  const payload = JSON.parse(decodeBase64Url(parts[0]));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw httpError(401, 'session expired');
  if (!payload.email || payload.role !== 'owner') throw httpError(401, 'invalid session payload');
  return payload;
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

function safeReturnUrl(value, env) {
  const origin = String(env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
  const fallback = `${origin}/members/admin/`;
  if (!origin) throw new Error('ALLOWED_ORIGIN is not configured');
  if (!value) return fallback;
  try {
    const target = new URL(value);
    if (target.origin !== origin) return fallback;
    if (!target.pathname.startsWith('/members/admin')) return fallback;
    return `${target.origin}${target.pathname}`;
  } catch {
    return fallback;
  }
}

function corsHeaders(env) {
  const origin = String(env.ALLOWED_ORIGIN || '');
  return {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Vary': 'Origin'
  };
}

function stripSearchText(row) {
  const { search_text, ...rest } = row;
  return rest;
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeBase64Url(value) {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

function base64UrlEncode(text) {
  return bytesToBase64Url(new TextEncoder().encode(text));
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
  });
}
