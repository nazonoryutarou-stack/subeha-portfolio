import {extractWavRange, planAudioTranscriptionChunks} from '../audio-chunker.js';
import {getKnownSpeakerReference} from '../known-speaker-store.js';

const STORAGE_KEY = 'vrm-studio-api-base';
const MAX_DIRECT_AUDIO_BYTES = 24 * 1024 * 1024;
const VISUAL_BATCH_SIZE = 240;
const VISUAL_BATCH_OVERLAP = 20;

const normalizeBase = (value) => String(value || '').trim().replace(/\/$/, '');
const BUILD_API_BASE = normalizeBase(import.meta.env.VITE_VRM_STUDIO_API_BASE);

export const getApiBase = () => {
  const saved = normalizeBase(localStorage.getItem(STORAGE_KEY));
  if (saved) return saved;
  const runtimeInjected = normalizeBase(window.VRM_STUDIO_API_BASE);
  if (runtimeInjected) return runtimeInjected;
  if (BUILD_API_BASE) return BUILD_API_BASE;
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

const visualProgress = (detail) => {
  window.dispatchEvent(new CustomEvent('vrm-studio-visual-progress', {detail}));
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

const captionBelongsToChunkCore = (startMs, endMs, chunk) => {
  const midpoint = (Number(startMs) + Number(endMs)) / 2;
  const coreStart = Number(chunk.coreStartMs ?? chunk.startMs ?? 0);
  const coreEnd = Number(chunk.coreEndMs ?? chunk.endMs ?? 0);
  if (!Number.isFinite(midpoint) || !Number.isFinite(coreStart) || !Number.isFinite(coreEnd)) return false;
  if (midpoint < coreStart) return false;
  return chunk.index === chunk.count - 1 ? midpoint <= coreEnd : midpoint < coreEnd;
};

export const checkApiHealth = async () => {
  const response = await fetch(`${getApiBase()}/health`, {method: 'GET', cache: 'no-store'});
  return await parseJson(response);
};

export const transcribeAudio = async (file) => {
  const known = await getKnownSpeakerReference().catch(() => null);

  // 容量だけでは長尺判定しない。高圧縮M4Aは長時間でも25MB未満になり得る。
  // 約8分のcoreごとに分け、境界は前後2秒ほど重ねてASRへ文脈を渡す。
  progress({phase: 'prepare', index: 0, count: 0});
  const plan = await planAudioTranscriptionChunks(file);
  const temporalChunking = plan.chunks.length > 1;
  const needsTranscode = file.size > MAX_DIRECT_AUDIO_BYTES;

  if (!temporalChunking && !needsTranscode) {
    progress({phase: 'upload', index: 0, count: 1, startSeconds: 0, endSeconds: plan.durationMs / 1000});
    const payload = await postTranscription(file, known);
    progress({phase: 'done', index: 1, count: 1});
    return payload;
  }

  if (temporalChunking && !known?.file) {
    throw new Error('8分を超える長尺音声は、チャンク間でHOSTを固定するため先に2〜10秒のHOST声サンプルを登録してください。');
  }

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
      const localStartMs = Number(caption.startMs);
      const localEndMs = Number(caption.endMs);
      if (!Number.isFinite(localStartMs) || !Number.isFinite(localEndMs) || localEndMs <= localStartMs) continue;
      const startMs = Math.round(localStartMs + chunk.startMs);
      const endMs = Math.round(localEndMs + chunk.startMs);
      if (temporalChunking && !captionBelongsToChunkCore(startMs, endMs, chunk)) continue;
      captions.push({
        ...caption,
        startMs,
        endMs,
        speaker: temporalChunking ? namespaceSpeaker(caption.speaker, chunk.index) : String(caption.speaker || 'SPEAKER_00'),
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
    chunked: temporalChunking,
    transcoded: true,
    chunkCount: plan.chunks.length,
    chunkOverlapSeconds: plan.overlapSeconds || 0,
  };
};

const postVisualBatch = async (captions) => {
  const response = await fetch(`${getApiBase()}/visual-cues`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({captions}),
  });
  return await parseJson(response);
};

const cueKey = (cue) => [
  cue.mode,
  String(cue.query || '').trim().toLowerCase(),
  String(cue.prompt || '').trim().toLowerCase(),
].join('|');

const overlapRatio = (a, b) => {
  const start = Math.max(Number(a.startMs), Number(b.startMs));
  const end = Math.min(Number(a.endMs), Number(b.endMs));
  if (end <= start) return 0;
  const overlap = end - start;
  const shortest = Math.max(1, Math.min(Number(a.endMs) - Number(a.startMs), Number(b.endMs) - Number(b.startMs)));
  return overlap / shortest;
};

const dedupeVisualCues = (cues) => {
  const out = [];
  for (const cue of [...cues].sort((a, b) => Number(a.startMs) - Number(b.startMs))) {
    const duplicate = out.find((item) => cueKey(item) === cueKey(cue) && overlapRatio(item, cue) >= 0.45);
    if (duplicate) {
      duplicate.startMs = Math.min(Number(duplicate.startMs), Number(cue.startMs));
      duplicate.endMs = Math.max(Number(duplicate.endMs), Number(cue.endMs));
      duplicate.startIndex = Math.min(Number(duplicate.startIndex), Number(cue.startIndex));
      duplicate.endIndex = Math.max(Number(duplicate.endIndex), Number(cue.endIndex));
      continue;
    }
    out.push({...cue});
  }
  return out;
};

export const suggestVisualCues = async (captions) => {
  const all = Array.isArray(captions) ? captions : [];
  if (!all.length) return {model: null, cues: []};

  if (all.length <= 600) {
    visualProgress({phase: 'batch', index: 0, count: 1});
    const payload = await postVisualBatch(all);
    visualProgress({phase: 'done', index: 1, count: 1});
    return payload;
  }

  const stride = VISUAL_BATCH_SIZE - VISUAL_BATCH_OVERLAP;
  const batches = [];
  for (let offset = 0; offset < all.length; offset += stride) {
    const slice = all.slice(offset, offset + VISUAL_BATCH_SIZE);
    if (!slice.length) break;
    batches.push({offset, captions: slice});
    if (offset + VISUAL_BATCH_SIZE >= all.length) break;
  }

  const cues = [];
  const models = new Set();
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    visualProgress({phase: 'batch', index, count: batches.length, offset: batch.offset});
    const payload = await postVisualBatch(batch.captions);
    if (payload?.model) models.add(payload.model);
    for (const cue of payload?.cues || []) {
      cues.push({
        ...cue,
        startIndex: Number(cue.startIndex) + batch.offset,
        endIndex: Number(cue.endIndex) + batch.offset,
      });
    }
  }
  const merged = dedupeVisualCues(cues);
  visualProgress({phase: 'done', index: batches.length, count: batches.length});
  return {
    model: [...models].join('+') || null,
    cues: merged,
    batched: true,
    batchCount: batches.length,
  };
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
