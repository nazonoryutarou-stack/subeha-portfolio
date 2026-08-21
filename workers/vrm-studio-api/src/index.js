const OPENAI_BASE = 'https://api.openai.com/v1';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {'content-type': 'application/json; charset=utf-8', ...headers},
});

const allowedOrigin = (request, env) => {
  const origin = request.headers.get('origin') || '';
  const configured = String(env.ALLOWED_ORIGIN || '').trim();
  if (configured) return origin === configured ? origin : null;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  if (/^https:\/\/[^/]+\.github\.io$/.test(origin)) return origin;
  return null;
};

const corsHeaders = (request, env) => {
  const origin = allowedOrigin(request, env);
  return {
    ...(origin ? {'access-control-allow-origin': origin} : {}),
    'access-control-allow-methods': 'POST,OPTIONS',
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

const openAI = async (env, path, init) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const response = await fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = {error: {message: text || `OpenAI HTTP ${response.status}`}};
  }
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
};

const normalizeSpeaker = (value, map) => {
  const raw = String(value ?? 'speaker').trim() || 'speaker';
  if (!map.has(raw)) map.set(raw, `SPEAKER_${String(map.size).padStart(2, '0')}`);
  return map.get(raw);
};

const mergeSpeakerTurns = (captions) => {
  const turns = [];
  for (const caption of captions) {
    const previous = turns[turns.length - 1];
    if (previous && previous.speaker === caption.speaker && caption.startMs - previous.endMs <= 250) {
      previous.endMs = Math.max(previous.endMs, caption.endMs);
      continue;
    }
    turns.push({speaker: caption.speaker, startMs: caption.startMs, endMs: caption.endMs});
  }
  return turns;
};

const handleTranscribe = async (request, env) => {
  const incoming = await request.formData();
  const audio = incoming.get('audio');
  if (!(audio instanceof File)) return json({error: 'audio file is required'}, 400);
  if (!audio.size) return json({error: 'audio file is empty'}, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({error: 'audio file exceeds the 25MB transcription upload limit'}, 413);

  const form = new FormData();
  form.append('file', audio, audio.name || 'audio.m4a');
  form.append('model', 'gpt-4o-transcribe-diarize');
  form.append('response_format', 'diarized_json');
  form.append('chunking_strategy', 'auto');

  const payload = await openAI(env, '/audio/transcriptions', {method: 'POST', body: form});
  const segments = Array.isArray(payload?.segments) ? payload.segments : [];
  const speakerMap = new Map();
  const captions = segments.map((segment) => {
    const start = Number(segment.start);
    const end = Number(segment.end);
    const text = String(segment.text || '').trim();
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return {
      text,
      startMs: Math.max(0, Math.round(start * 1000)),
      endMs: Math.max(1, Math.round(end * 1000)),
      speaker: normalizeSpeaker(segment.speaker, speakerMap),
      confidence: segment.confidence == null ? null : Number(segment.confidence),
    };
  }).filter(Boolean);

  const speakerTurns = mergeSpeakerTurns(captions);
  const durationMs = Math.max(0, Math.round(Number(payload?.duration || 0) * 1000), ...captions.map((caption) => caption.endMs));
  return json({
    model: 'gpt-4o-transcribe-diarize',
    language: payload?.language || null,
    durationMs,
    speakers: [...new Set(captions.map((caption) => caption.speaker))],
    avatarSpeaker: null,
    captions,
    speakerTurns,
  });
};

const handleGenerateImage = async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const prompt = String(body?.prompt || '').trim();
  if (!prompt) return json({error: 'prompt is required'}, 400);
  if (prompt.length > 6000) return json({error: 'prompt is too long'}, 400);
  const size = String(body?.size || '1024x1024');
  const quality = String(body?.quality || 'low');
  const payload = await openAI(env, '/images/generations', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({model: 'gpt-image-2', prompt, size, quality}),
  });
  const item = payload?.data?.[0];
  if (!item?.b64_json) throw new Error('Image API returned no b64_json');
  return json({model: 'gpt-image-2', data: [{b64_json: item.b64_json, revised_prompt: item.revised_prompt || null}]});
};

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    try {
      requireOrigin(request, env);
      const url = new URL(request.url);
      if (request.method !== 'POST') return json({error: 'Not found'}, 404, cors);
      let response;
      if (url.pathname.endsWith('/api/transcribe') || url.pathname === '/transcribe') {
        response = await handleTranscribe(request, env);
      } else if (url.pathname.endsWith('/api/images/generate') || url.pathname === '/images/generate') {
        response = await handleGenerateImage(request, env);
      } else {
        response = json({error: 'Not found'}, 404);
      }
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value);
      return new Response(response.body, {status: response.status, headers});
    } catch (error) {
      if (error instanceof Response) {
        const headers = new Headers(error.headers);
        for (const [key, value] of Object.entries(cors)) headers.set(key, value);
        return new Response(error.body, {status: error.status, headers});
      }
      console.error(JSON.stringify({event: 'vrm-studio-api-error', message: error instanceof Error ? error.message : String(error)}));
      const status = Number(error?.status) || 500;
      return json({error: error instanceof Error ? error.message : String(error)}, status, cors);
    }
  },
};
