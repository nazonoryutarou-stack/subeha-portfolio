import {handleImportOpenverseImage} from './openverse.js';

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {'content-type': 'application/json; charset=utf-8', ...headers},
});

const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const allowedOrigin = (request, env) => {
  const origin = request.headers.get('origin') || '';
  if (isLocalOrigin(origin)) return origin;
  const configured = String(env.ALLOWED_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (configured.includes(origin)) return origin;
  if (!configured.length && /^https:\/\/[^/]+\.github\.io$/.test(origin)) return origin;
  return null;
};

const corsHeaders = (request, env) => {
  const origin = allowedOrigin(request, env);
  return {
    ...(origin ? {'access-control-allow-origin': origin} : {}),
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
  };
};

const requireOrigin = (request, env) => {
  const origin = request.headers.get('origin');
  if (!origin) return;
  if (!allowedOrigin(request, env)) throw new Response('Origin not allowed', {status: 403});
};

const withCors = (response, cors) => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, {status: response.status, headers});
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});

    try {
      requireOrigin(request, env);
      const url = new URL(request.url);

      if (request.method === 'GET' && (url.pathname.endsWith('/api/health') || url.pathname === '/health')) {
        return json({
          ok: true,
          version: 7,
          freeOnly: true,
          paidAI: false,
          openverseImport: true,
          canonicalPipeline: 'chatgpt-edit-plan-to-github-remotion',
        }, 200, cors);
      }

      if (request.method !== 'POST') return json({error: 'Not found'}, 404, cors);

      if (url.pathname.endsWith('/api/images/import-openverse') || url.pathname === '/images/import-openverse') {
        return withCors(await handleImportOpenverseImage(request), cors);
      }

      if (
        url.pathname.endsWith('/api/transcribe') || url.pathname === '/transcribe' ||
        url.pathname.endsWith('/api/visual-cues') || url.pathname === '/visual-cues' ||
        url.pathname.endsWith('/api/images/generate') || url.pathname === '/images/generate'
      ) {
        return json({
          error: 'Paid AI route removed. Use ChatGPT to create assistant edit-plan.json, then GitHub/Remotion render:assistant.',
          paidAI: false,
        }, 410, cors);
      }

      return json({error: 'Not found'}, 404, cors);
    } catch (error) {
      if (error instanceof Response) return withCors(error, cors);
      console.error(JSON.stringify({
        event: 'vrm-studio-free-proxy-error',
        message: error instanceof Error ? error.message : String(error),
      }));
      return json({error: error instanceof Error ? error.message : String(error)}, 500, cors);
    }
  },
};
