const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === 'GET' && url.pathname === '/login') {
        const identity = await verifyCloudflareAccess(request, env);
        const entitlement = await findEntitlementByEmail(identity.email, env);
        const returnUrl = safeReturnUrl(url.searchParams.get('return'), env);

        if (!entitlement.active) {
          return Response.redirect(`${returnUrl}#error=not-member`, 302);
        }

        const token = await signSession({
          email: identity.email,
          customer: entitlement.customer,
          subscription: entitlement.subscription,
          exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
        }, env.SESSION_SECRET);

        return Response.redirect(`${returnUrl}#token=${encodeURIComponent(token)}`, 302);
      }

      if (request.method === 'GET' && url.pathname === '/api/me') {
        const member = await requireMember(request, env);
        return json({
          ok: true,
          member: true,
          email: member.email,
          subscription_status: member.subscriptionStatus
        }, 200, cors);
      }

      if (request.method === 'GET' && url.pathname === '/api/reports') {
        await requireMember(request, env);
        const index = await loadReportIndex(env);
        const q = String(url.searchParams.get('q') || '').trim().toLocaleLowerCase('ja-JP');
        const limit = clamp(Number(url.searchParams.get('limit')) || 50, 1, 200);
        const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

        let rows = index;
        if (q) {
          rows = rows.filter((row) => {
            const haystack = `${row.episode || ''} ${row.date || ''} ${row.title || ''} ${(row.headings || []).join(' ')} ${row.search_text || ''}`.toLocaleLowerCase('ja-JP');
            return haystack.includes(q);
          });
        }

        rows = rows.slice().sort((a, b) => Number(b.episode) - Number(a.episode));
        const total = rows.length;
        const items = rows.slice(offset, offset + limit).map(stripSearchText);
        return json({ ok: true, total, items }, 200, cors);
      }

      const reportMatch = url.pathname.match(/^\/api\/reports\/(\d{1,6})$/);
      if (request.method === 'GET' && reportMatch) {
        await requireMember(request, env);
        const episode = reportMatch[1];
        const markdown = await githubReadText(`reports/${episode}.md`, env);
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

      if (request.method === 'POST' && url.pathname === '/api/portal') {
        const member = await requireMember(request, env);
        const portal = await createPortalSession(member.customer, env);
        return json({ ok: true, url: portal.url }, 200, cors);
      }

      return json({ error: 'not found' }, 404, cors);
    } catch (error) {
      const status = Number(error?.status) || 400;
      return json({ error: String(error?.message || error) }, status, cors);
    }
  }
};

async function requireMember(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) throw httpError(401, 'login required');

  const session = await verifySession(token, env.SESSION_SECRET);
  const entitlement = await findEntitlementByCustomer(session.customer, env);
  if (!entitlement.active) throw httpError(403, 'membership inactive');

  return {
    email: session.email,
    customer: session.customer,
    subscription: entitlement.subscription,
    subscriptionStatus: entitlement.status
  };
}

async function findEntitlementByEmail(email, env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured');
  if (!env.MEMBERSHIP_PRODUCT_ID) throw new Error('MEMBERSHIP_PRODUCT_ID is not configured');

  const customers = await stripeGet('/v1/customers', { email, limit: 10 }, env);
  for (const customer of customers.data || []) {
    const entitlement = await findEntitlementByCustomer(customer.id, env);
    if (entitlement.active) return entitlement;
  }
  return { active: false, customer: null, subscription: null, status: null };
}

async function findEntitlementByCustomer(customerId, env) {
  const cacheKey = `member:${customerId}`;
  if (env.MEMBER_CACHE) {
    const cached = await env.MEMBER_CACHE.get(cacheKey, 'json');
    if (cached && Number(cached.expires || 0) > Date.now()) return cached.value;
  }

  const subscriptions = await stripeGet('/v1/subscriptions', {
    customer: customerId,
    status: 'all',
    limit: 100,
    'expand[]': 'data.items.data.price.product'
  }, env);

  let result = { active: false, customer: customerId, subscription: null, status: null };
  for (const sub of subscriptions.data || []) {
    if (!ACTIVE_STATUSES.has(sub.status)) continue;
    const matches = (sub.items?.data || []).some((item) => {
      const product = item.price?.product;
      const productId = typeof product === 'string' ? product : product?.id;
      return productId === env.MEMBERSHIP_PRODUCT_ID;
    });
    if (matches) {
      result = { active: true, customer: customerId, subscription: sub.id, status: sub.status };
      break;
    }
  }

  if (env.MEMBER_CACHE) {
    await env.MEMBER_CACHE.put(cacheKey, JSON.stringify({ expires: Date.now() + 5 * 60 * 1000, value: result }), { expirationTtl: 300 });
  }
  return result;
}

async function createPortalSession(customer, env) {
  const returnUrl = `${String(env.ALLOWED_ORIGIN || '').replace(/\/$/, '')}/members/`;
  const body = new URLSearchParams({ customer, return_url: returnUrl });
  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe portal failed: ${response.status}`);
  return data;
}

async function stripeGet(path, params, env) {
  const url = new URL(`https://api.stripe.com${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
  }
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe read failed: ${response.status}`);
  return data;
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
      return {
        episode,
        date: '',
        title: `Gravity 第${episode}回`,
        headings: [],
        search_text: String(episode)
      };
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
    'User-Agent': 'subeha-membership-worker'
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

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
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
  return String(value || '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
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
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(parts[1]),
    new TextEncoder().encode(parts[0])
  );
  if (!verified) throw httpError(401, 'invalid session signature');
  const payload = JSON.parse(decodeBase64Url(parts[0]));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw httpError(401, 'session expired');
  if (!payload.customer || !payload.email) throw httpError(401, 'invalid session payload');
  return payload;
}

async function hmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

function safeReturnUrl(value, env) {
  const origin = String(env.ALLOWED_ORIGIN || '').replace(/\/$/, '');
  const fallback = `${origin}/members/`;
  if (!origin) throw new Error('ALLOWED_ORIGIN is not configured');
  if (!value) return fallback;
  try {
    const target = new URL(value);
    if (target.origin !== origin) return fallback;
    if (!target.pathname.startsWith('/members')) return fallback;
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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}
