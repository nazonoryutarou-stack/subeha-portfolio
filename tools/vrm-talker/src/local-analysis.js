import {extractWavRange, planAudioTranscriptionChunks} from './audio-chunker.js';
import {getKnownSpeakerReference} from './known-speaker-store.js';

const LOCAL_CHUNK_SECONDS = 4 * 60;
const LOCAL_OVERLAP_SECONDS = 8;

let worker = null;
let workerReady = null;
let activeRun = null;
let runCounter = 0;
let hostFingerprintKey = null;

const emit = (detail) => window.dispatchEvent(new CustomEvent('vrm-studio-transcription-progress', {detail}));

export const wavFileToFloat32 = async (file) => {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (buffer.byteLength < 44 || view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
    throw new Error('ローカル解析用WAVが不正です。');
  }

  let offset = 12;
  let format = null;
  let dataOffset = -1;
  let dataLength = 0;
  while (offset + 8 <= buffer.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + size > buffer.byteLength) break;
    if (id === 0x666d7420) {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 0x64617461) {
      dataOffset = body;
      dataLength = size;
      break;
    }
    offset = body + size + (size % 2);
  }

  if (!format || dataOffset < 0) throw new Error('WAVのfmt/dataチャンクを読めませんでした。');
  if (format.audioFormat !== 1 || format.channels !== 1 || format.sampleRate !== 16000 || format.bitsPerSample !== 16) {
    throw new Error(`ローカル解析は16kHz mono s16 WAVが必要です: ${format.sampleRate}Hz/${format.channels}ch/${format.bitsPerSample}bit`);
  }

  const count = Math.floor(dataLength / 2);
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index++) samples[index] = view.getInt16(dataOffset + index * 2, true) / 32768;
  return samples;
};

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

const chooseDevice = async () => {
  if (isMobile() || !navigator.gpu) return 'wasm';
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
};

const ensureWorker = async () => {
  if (workerReady) return workerReady;
  worker = new Worker(new URL('./local-analysis-worker.js', import.meta.url), {type: 'module'});
  const device = await chooseDevice();

  workerReady = new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = event.data || {};
      if (message.status === 'model-progress') {
        const progress = Number(message.detail?.progress);
        emit({phase: 'model-load', modelFile: message.detail?.file || '', progress: Number.isFinite(progress) ? progress : null});
      } else if (message.status === 'loading') {
        emit({phase: 'model-load', message: message.detail?.message || 'ローカルモデル読込中…'});
      } else if (message.status === 'loaded') {
        worker.removeEventListener('message', onMessage);
        resolve({device, ...message.detail});
      } else if (message.status === 'error') {
        worker.removeEventListener('message', onMessage);
        reject(new Error(message.error || 'ローカルモデル読込に失敗しました。'));
      }
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({type: 'load', data: {device}});
  });
  return workerReady;
};

const setHostReference = async () => {
  const known = await getKnownSpeakerReference().catch(() => null);
  if (!known?.file) {
    hostFingerprintKey = null;
    return false;
  }
  const key = `${known.file.name}:${known.file.size}:${known.file.lastModified || 0}`;
  if (hostFingerprintKey === key) return true;
  await ensureWorker();
  const audio = await wavFileToFloat32(known.file);
  await new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = event.data || {};
      if (message.status === 'model-progress') {
        const progress = Number(message.detail?.progress);
        emit({phase: 'host-model-load', modelFile: message.detail?.file || '', progress: Number.isFinite(progress) ? progress : null});
      } else if (message.status === 'loading') {
        emit({phase: 'host-model-load', message: message.detail?.message || 'HOST話者モデル読込中…'});
      } else if (message.status === 'host-ready') {
        worker.removeEventListener('message', onMessage);
        resolve();
      } else if (message.status === 'error') {
        worker.removeEventListener('message', onMessage);
        reject(new Error(message.error || 'HOST話者モデルに失敗しました。'));
      }
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({type: 'set-host', data: {audio}}, [audio.buffer]);
  });
  hostFingerprintKey = key;
  return true;
};

const runChunk = async (audio, language, device) => {
  const runId = ++runCounter;
  if (activeRun) throw new Error('ローカル解析は同時に1件だけ実行できます。');
  activeRun = runId;
  try {
    return await new Promise((resolve, reject) => {
      const onMessage = (event) => {
        const message = event.data || {};
        if (message.runId && message.runId !== runId) return;
        if (message.status === 'progress') emit({phase: 'local-model', ...message.detail});
        else if (message.status === 'model-progress') {
          const progress = Number(message.detail?.progress);
          emit({phase: 'model-load', modelFile: message.detail?.file || '', progress: Number.isFinite(progress) ? progress : null});
        } else if (message.status === 'complete') {
          worker.removeEventListener('message', onMessage);
          resolve(message.result);
        } else if (message.status === 'error') {
          worker.removeEventListener('message', onMessage);
          reject(new Error(message.error || 'ローカル音声解析に失敗しました。'));
        }
      };
      worker.addEventListener('message', onMessage);
      worker.postMessage({type: 'run', data: {runId, audio, language, device}}, [audio.buffer]);
    });
  } finally {
    activeRun = null;
  }
};

const localSpeakerAt = (segments, startSeconds, endSeconds) => {
  const start = Number(startSeconds);
  const end = Number(endSeconds);
  const midpoint = (start + end) / 2;
  const containing = segments
    .filter((segment) => segment.start <= midpoint && segment.end >= midpoint)
    .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  if (containing[0]) return containing[0].label;
  let best = null;
  let bestOverlap = 0;
  for (const segment of segments) {
    const overlap = Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = segment.label;
    }
  }
  return best || 'SPEAKER_00';
};

const normalizeWords = (result, chunk, temporalChunking) => {
  const transcriptChunks = Array.isArray(result?.transcript?.chunks) ? result.transcript.chunks : [];
  const hostLabel = result?.hostLabel || null;
  const segments = Array.isArray(result?.segments) ? result.segments : [];
  const words = [];
  for (const item of transcriptChunks) {
    const timestamp = Array.isArray(item?.timestamp) ? item.timestamp : [];
    const localStart = Number(timestamp[0]);
    const localEnd = Number(timestamp[1]);
    const text = String(item?.text || '').trim();
    if (!text || !Number.isFinite(localStart) || !Number.isFinite(localEnd) || localEnd <= localStart) continue;
    const startMs = Math.round(chunk.startMs + localStart * 1000);
    const endMs = Math.round(chunk.startMs + localEnd * 1000);
    const midpoint = (startMs + endMs) / 2;
    if (temporalChunking) {
      if (midpoint < chunk.coreStartMs) continue;
      if (chunk.index === chunk.count - 1 ? midpoint > chunk.coreEndMs : midpoint >= chunk.coreEndMs) continue;
    }
    const localSpeaker = localSpeakerAt(segments, localStart, localEnd);
    words.push({
      text,
      startMs,
      endMs,
      speaker: hostLabel && localSpeaker === hostLabel
        ? 'HOST'
        : `CHUNK_${String(chunk.index).padStart(3, '0')}_${localSpeaker}`,
      sourceChunk: chunk.index,
    });
  }
  return words;
};

const shouldCloseCaption = (caption, nextWord) => {
  if (!caption) return false;
  if (caption.speaker !== nextWord.speaker) return true;
  if (nextWord.startMs - caption.endMs > 650) return true;
  if (nextWord.endMs - caption.startMs >= 4200) return true;
  if (caption.text.length >= 46) return true;
  return /[。！？!?]$/.test(caption.text);
};

export const wordsToCaptions = (words) => {
  const captions = [];
  let current = null;
  for (const word of words) {
    if (current && shouldCloseCaption(current, word)) {
      captions.push(current);
      current = null;
    }
    if (!current) {
      current = {...word, text: word.text};
      continue;
    }
    const spacer = /[\x00-\x7F]$/.test(current.text) && /^[\x00-\x7F]/.test(word.text) ? ' ' : '';
    current.text += spacer + word.text;
    current.endMs = word.endMs;
  }
  if (current) captions.push(current);
  return captions.filter((caption) => caption.text.trim() && caption.endMs > caption.startMs);
};

export const mergeSpeakerTurns = (captions) => {
  const turns = [];
  for (const caption of captions) {
    const previous = turns[turns.length - 1];
    if (previous && previous.speaker === caption.speaker && caption.startMs - previous.endMs <= 250) {
      previous.endMs = Math.max(previous.endMs, caption.endMs);
    } else {
      turns.push({speaker: caption.speaker, startMs: caption.startMs, endMs: caption.endMs});
    }
  }
  return turns;
};

export const transcribeAudioLocally = async (file, {language = 'ja'} = {}) => {
  emit({phase: 'prepare', index: 0, count: 0, message: '完全無料のローカル解析を準備中…'});
  const plan = await planAudioTranscriptionChunks(file, {
    chunkSeconds: LOCAL_CHUNK_SECONDS,
    overlapSeconds: LOCAL_OVERLAP_SECONDS,
  });
  const temporalChunking = plan.chunks.length > 1;
  const hasHostReference = await setHostReference();
  if (temporalChunking && !hasHostReference) {
    throw new Error('長尺音声では各チャンクのHOSTを安全に照合するため、先に本人だけの2〜10秒HOSTサンプルを登録してください。');
  }

  const loaded = await ensureWorker();
  const words = [];
  const hostScoreLog = [];

  for (const chunk of plan.chunks) {
    emit({
      phase: 'encode',
      index: chunk.index,
      count: chunk.count,
      startSeconds: chunk.startSeconds,
      endSeconds: chunk.endSeconds,
      message: `ローカル解析 ${chunk.index + 1}/${chunk.count}: WAV変換中…`,
    });
    const wav = await extractWavRange(file, chunk.startSeconds, chunk.endSeconds);
    const audio = await wavFileToFloat32(wav);
    emit({phase: 'local-run', index: chunk.index, count: chunk.count, message: `ローカル解析 ${chunk.index + 1}/${chunk.count}: Whisper＋話者分離…`});
    const result = await runChunk(audio, language, loaded.device);
    words.push(...normalizeWords(result, chunk, temporalChunking));
    hostScoreLog.push({chunk: chunk.index, hostLabel: result.hostLabel || null, scores: result.hostScores || []});
    emit({phase: 'chunk-done', index: chunk.index + 1, count: chunk.count});
  }

  words.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const captions = wordsToCaptions(words);
  const speakerTurns = mergeSpeakerTurns(captions);
  const speakers = [...new Set(captions.map((caption) => caption.speaker))];
  emit({phase: 'done', index: plan.chunks.length, count: plan.chunks.length});

  return {
    model: 'local:whisper-base_timestamped+pyannote-segmentation-3.0',
    language,
    durationMs: plan.durationMs,
    speakers,
    avatarSpeaker: speakers.includes('HOST') ? 'HOST' : null,
    captions,
    speakerTurns,
    chunked: temporalChunking,
    chunkCount: plan.chunks.length,
    chunkOverlapSeconds: plan.overlapSeconds,
    device: loaded.device,
    hostVerification: hasHostReference,
    hostScoreLog,
    free: true,
  };
};
