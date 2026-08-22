import {extractWavRange, planAudioTranscriptionChunks} from '../audio-chunker.js';
import {getKnownSpeakerReference} from '../known-speaker-store.js';

const STORAGE_KEY = 'vrm-studio-api-base';
const MAX_DIRECT_AUDIO_BYTES = 24 * 1024 * 1024;

const normalizeBase = (value) => String(value || '').trim().replace(/\/$/, '');

export const getApiBase = () => {
  const saved = normalizeBase(localStorage.getItem(STORAGE_KEY));
  if (saved) return saved;
  const injected = normalizeBase(window.VRM_STUDIO_API_BASE);
  if (injected) return injected;
  return '/api';
};

export const setApiBase = (value) => {
  const normalized = normalizeBase(value);
  if (!normalized || normalized === '/api') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, normalized);
  return getApiBase();
};

export const apiBaseIsConfigured = () => getApiBase() !== '/api';

const parseJson = async (response) => {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`API returned non-JSON (${response.status})`);
  }
  if (!response.ok) {
    const message = data?.error || data?.message || `API request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
};

const progress = (detail) => {
  window.dispatchEvent(new CustomEvent('vrm-studio-transcription-progress', {detail}));
};

const appendKnownSpeaker = (form, known) => {
  if (!known?.file) return;
  form.append('knownSpeakerName', known.name || 'HOST');
  form.append('knownSpeakerReference', known.file, known.file.name || 'host-reference.wav');
};

const postTranscription = async (file, known, detail = null) => {
  if (detail) progress({...detail, phase: 'upload'});
  const form = new FormData();
  form.append('audio', file, file.name);
  appendKnownSpeaker(form, known);
  const response = await fetch(`${getApiBase()}/transcribe`, {method: 'POST', body: form});
  return await parseJson(response);
};

const mergeTurns = (captions) => {
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

const namespaceSpeaker = (speaker, chunkIndex) => {
  const value = String(speaker || '').trim() || 'SPEAKER';
  if (value === 'HOST') return 'HOST';
  return `CHUNK_${String(chunkIndex).padStart(3, '0')}_${value}`;
};

export const checkApiHealth = async () => {
  const response = await fetch(`${getApiBase()}/health`, {method: 'GET', cache: 'no-store'});
  return await parseJson(response);
};

export const transcribeAudio = async (file) => {
  const known = await getKnownSpeakerReference().catch(() => null);

  if (file.size <= MAX_DIRECT_AUDIO_BYTES) {
    progress({phase: 'upload', index: 0, count: 1, startSeconds: 0, endSeconds: null});
    const payload = await postTranscription(file, known);
    progress({phase: 'done', index: 1, count: 1});
    return payload;
  }

  if (!known?.file) {
    throw new Error('25MBを超える長尺音声は、先に2〜10秒のHOST声サンプルを登録してください。');
  }

  progress({phase: 'prepare', index: 0, count: 0});
  const plan = await planAudioTranscriptionChunks(file);
  const captions = [];
  const models = new Set();
  let language = null;

  for (const chunk of plan.chunks) {
    progress({
      phase: 'encode',
      index: chunk.index,
      count: chunk.count,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
    });

    // 1区間だけWAV化して送信し、レスポンス取得後は次のループで参照を捨てる。
    // 全WAVを同時保持しないことで長尺配信のピークメモリを抑える。
    const wav = await extractWavRange(file, chunk.startSeconds, chunk.endSeconds);
    const payload = await postTranscription(wav, known, {
      index: chunk.index,
      count: chunk.count,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
    });

    if (payload?.model) models.add(payload.model);
    if (!language && payload?.language) language = payload.language;

    for (const caption of payload?.captions || []) {
      const startMs = Number(caption.startMs);
      const endMs = Number(caption.endMs);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
      captions.push({
        ...caption,
        startMs: Math.round(startMs + chunk.startMs),
        endMs: Math.round(endMs + chunk.startMs),
        speaker: namespaceSpeaker(caption.speaker, chunk.index),
        sourceChunk: chunk.index,
      });
    }
    progress({phase: 'chunk-done', index: chunk.index + 1, count: chunk.count});
  }

  captions.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const speakerTurns = mergeTurns(captions);
  const speakers = [...new Set(captions.map((caption) => caption.speaker))];
  progress({phase: 'done', index: plan.chunks.length, count: plan.chunks.length});

  return {
    model: [...models].join('+') || 'gpt-4o-transcribe-diarize',
    language,
    durationMs: plan.durationMs,
    speakers,
    avatarSpeaker: speakers.includes('HOST') ? 'HOST' : null,
    captions,
    speakerTurns,
    chunked: true,
    chunkCount: plan.chunks.length,
  };
};

export const suggestVisualCues = async (captions) => {
  const response = await fetch(`${getApiBase()}/visual-cues`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({captions}),
  });
  return await parseJson(response);
};

export const importOpenverseImage = async (id) => {
  const response = await fetch(`${getApiBase()}/images/import-openverse`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({id}),
  });
  return await parseJson(response);
};

export const generateReferenceImage = async ({prompt, size = '1024x1024'}) => {
  const response = await fetch(`${getApiBase()}/images/generate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({prompt, size}),
  });
  return await parseJson(response);
};
