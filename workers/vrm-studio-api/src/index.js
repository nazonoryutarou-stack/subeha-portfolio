import {handleImportOpenverseImage} from './openverse.js';

const OPENAI_BASE = 'https://api.openai.com/v1';
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;

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

const openAI = async (env, path, init) => {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const response = await fetch(`${OPENAI_BASE}${path}`, {
    ...init,
    headers: {authorization: `Bearer ${env.OPENAI_API_KEY}`, ...(init?.headers || {})},
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = {error: {message: text || `OpenAI HTTP ${response.status}`}}; }
  if (!response.ok) {
    const message = payload?.error?.message || `OpenAI HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
};

const fileToDataUrl = async (file) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    binary += String.fromCharCode(...bytes.subarray(i, i + block));
  }
  return `data:${file.type || 'audio/wav'};base64,${btoa(binary)}`;
};

const normalizeSpeaker = (value, map, knownNames = new Set()) => {
  const raw = String(value ?? 'speaker').trim() || 'speaker';
  if (knownNames.has(raw)) return raw;
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

  const knownSpeakerName = String(incoming.get('knownSpeakerName') || '').trim();
  const knownSpeakerReference = incoming.get('knownSpeakerReference');
  if ((knownSpeakerName && !(knownSpeakerReference instanceof File)) || (!knownSpeakerName && knownSpeakerReference instanceof File)) {
    return json({error: 'knownSpeakerName and knownSpeakerReference must be provided together'}, 400);
  }
  if (knownSpeakerReference instanceof File && knownSpeakerReference.size > MAX_REFERENCE_BYTES) {
    return json({error: 'known speaker reference is too large'}, 413);
  }

  const form = new FormData();
  form.append('file', audio, audio.name || 'audio.m4a');
  form.append('model', 'gpt-4o-transcribe-diarize');
  form.append('response_format', 'diarized_json');
  form.append('chunking_strategy', 'auto');

  const knownNames = new Set();
  if (knownSpeakerName && knownSpeakerReference instanceof File) {
    knownNames.add(knownSpeakerName);
    form.append('known_speaker_names[]', knownSpeakerName);
    form.append('known_speaker_references[]', await fileToDataUrl(knownSpeakerReference));
  }

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
      speaker: normalizeSpeaker(segment.speaker, speakerMap, knownNames),
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
    avatarSpeaker: knownNames.has('HOST') ? 'HOST' : null,
    captions,
    speakerTurns,
  });
};

const responseText = (payload) => {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
};

const parseModelJson = (text) => {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
};

const handleVisualCues = async (request, env) => {
  const body = await request.json().catch(() => ({}));
  const captions = Array.isArray(body?.captions) ? body.captions : [];
  if (!captions.length) return json({error: 'captions are required'}, 400);
  if (captions.length > 600) return json({error: 'too many captions for one visual-cue request'}, 413);

  const indexed = captions.map((caption, index) => ({
    index,
    text: String(caption?.text || '').trim(),
    speaker: caption?.speaker || null,
  })).filter((item) => item.text);

  const instructions = `あなたは短尺動画の映像編集者です。字幕列を読み、視覚補助を入れる価値が高い箇所だけ選んでください。\n\n重要ルール:\n- 時刻や秒数を生成してはいけません。startIndex/endIndexだけ返してください。\n- 実在する人物、場所、物、歴史資料、作品資料などは mode=search。\n- 実在資料では表現できない抽象概念、比喩、架空物、演出的イメージは mode=generate。\n- 単なる相槌や説明不要な発話には何も出さない。\n- 検索語は検索エンジン向けに簡潔に。生成promptは具体的な画面素材の指示にする。\n- 最大8件。重複する隣接区間はまとめる。\n\n次のJSONだけを返してください。\n{"cues":[{"startIndex":0,"endIndex":1,"mode":"search","query":"...","prompt":null,"reason":"..."}]}\n\n字幕:\n${JSON.stringify(indexed)}`;

  const payload = await openAI(env, '/responses', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({model: 'gpt-5.6-luna', input: instructions}),
  });

  const parsed = parseModelJson(responseText(payload));
  const rawCues = Array.isArray(parsed?.cues) ? parsed.cues : [];
  const cues = [];
  for (const raw of rawCues.slice(0, 8)) {
    const startIndex = Math.trunc(Number(raw?.startIndex));
    const endIndex = Math.trunc(Number(raw?.endIndex));
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) continue;
    if (startIndex < 0 || endIndex < startIndex || endIndex >= captions.length) continue;
    const startCaption = captions[startIndex];
    const endCaption = captions[endIndex];
    const startMs = Number(startCaption?.startMs);
    const endMs = Number(endCaption?.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const mode = raw?.mode === 'generate' ? 'generate' : 'search';
    const query = mode === 'search' ? String(raw?.query || '').trim() : null;
    const prompt = mode === 'generate' ? String(raw?.prompt || '').trim() : null;
    if (mode === 'search' && !query) continue;
    if (mode === 'generate' && !prompt) continue;
    cues.push({
      id: crypto.randomUUID(), startIndex, endIndex,
      startMs: Math.round(startMs), endMs: Math.round(endMs),
      mode, query, prompt,
      reason: String(raw?.reason || '').trim() || null,
    });
  }
  return json({model: 'gpt-5.6-luna', cues});
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
      if (request.method === 'GET' && (url.pathname.endsWith('/api/health') || url.pathname === '/health')) {
        return json({ok: true, version: 4, openaiConfigured: Boolean(env.OPENAI_API_KEY), openverseImport: true}, 200, cors);
      }
      if (request.method !== 'POST') return json({error: 'Not found'}, 404, cors);
      let response;
      if (url.pathname.endsWith('/api/transcribe') || url.pathname === '/transcribe') {
        response = await handleTranscribe(request, env);
      } else if (url.pathname.endsWith('/api/visual-cues') || url.pathname === '/visual-cues') {
        response = await handleVisualCues(request, env);
      } else if (url.pathname.endsWith('/api/images/import-openverse') || url.pathname === '/images/import-openverse') {
        response = await handleImportOpenverseImage(request);
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
