import {
  AutoModel,
  AutoModelForAudioFrameClassification,
  AutoProcessor,
  cos_sim,
  pipeline,
} from '@huggingface/transformers';

const ASR_MODEL = 'onnx-community/whisper-base_timestamped';
const SEGMENTATION_MODEL = 'onnx-community/pyannote-segmentation-3.0';
const SPEAKER_MODEL = 'Xenova/wavlm-base-sv';

const DEVICE_CONFIG = {
  webgpu: {
    device: 'webgpu',
    dtype: {encoder_model: 'fp32', decoder_model_merged: 'q4'},
  },
  wasm: {device: 'wasm', dtype: 'q8'},
};

class LocalModels {
  static device = null;
  static asr = null;
  static segmentationProcessor = null;
  static segmentationModel = null;
  static speakerProcessor = null;
  static speakerModel = null;
  static hostEmbedding = null;

  static async ensureCore(device = 'wasm', progressCallback = null) {
    const selected = device === 'webgpu' ? 'webgpu' : 'wasm';
    if (this.device && this.device !== selected) {
      this.asr = null;
      this.device = null;
    }
    this.device = selected;

    this.asr ??= await pipeline('automatic-speech-recognition', ASR_MODEL, {
      ...DEVICE_CONFIG[selected],
      progress_callback: progressCallback,
    });
    this.segmentationProcessor ??= await AutoProcessor.from_pretrained(SEGMENTATION_MODEL, {
      progress_callback: progressCallback,
    });
    this.segmentationModel ??= await AutoModelForAudioFrameClassification.from_pretrained(SEGMENTATION_MODEL, {
      device: 'wasm',
      dtype: 'fp32',
      progress_callback: progressCallback,
    });
    return [this.asr, this.segmentationProcessor, this.segmentationModel];
  }

  static async ensureSpeaker(progressCallback = null) {
    this.speakerProcessor ??= await AutoProcessor.from_pretrained(SPEAKER_MODEL, {
      progress_callback: progressCallback,
    });
    this.speakerModel ??= await AutoModel.from_pretrained(SPEAKER_MODEL, {
      device: 'wasm',
      dtype: 'q8',
      progress_callback: progressCallback,
    });
    return [this.speakerProcessor, this.speakerModel];
  }
}

const progress = (detail) => self.postMessage({status: 'progress', detail});

const computeSpeakerEmbedding = async (audio, progressCallback = null) => {
  const [processor, model] = await LocalModels.ensureSpeaker(progressCallback);
  const inputs = await processor(audio);
  const output = await model(inputs);
  const tensor = output?.embeddings || output?.logits;
  if (!tensor?.data) throw new Error('話者埋め込みモデルからベクトルが返りませんでした。');
  return Float32Array.from(tensor.data);
};

const normalizeSegments = (processor, model, logits, audioLength) => {
  const raw = processor.post_process_speaker_diarization(logits, audioLength)?.[0] || [];
  return raw.map((segment) => ({
    start: Number(segment.start),
    end: Number(segment.end),
    id: Number(segment.id),
    label: model.config.id2label?.[segment.id] || `SPEAKER_${String(segment.id).padStart(2, '0')}`,
    confidence: Number(segment.confidence ?? 0),
  })).filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start);
};

const representativeSlice = (audio, segments, label) => {
  const candidates = segments
    .filter((segment) => segment.label === label)
    .map((segment) => ({
      start: Math.max(0, Math.floor(segment.start * 16000)),
      end: Math.min(audio.length, Math.ceil(segment.end * 16000)),
      duration: segment.end - segment.start,
    }))
    .filter((item) => item.end > item.start)
    .sort((a, b) => b.duration - a.duration);
  if (!candidates.length) return null;
  const chosen = candidates.find((item) => item.duration >= 1.2) || candidates[0];
  const maxSamples = 8 * 16000;
  return audio.slice(chosen.start, Math.min(chosen.end, chosen.start + maxSamples));
};

const detectHostLabel = async (audio, segments, progressCallback = null) => {
  if (!LocalModels.hostEmbedding) return {hostLabel: null, hostScores: []};
  const labels = [...new Set(segments.map((segment) => segment.label))];
  const scores = [];
  for (const label of labels) {
    const sample = representativeSlice(audio, segments, label);
    if (!sample || sample.length < 8000) continue;
    const embedding = await computeSpeakerEmbedding(sample, progressCallback);
    const score = Number(cos_sim(LocalModels.hostEmbedding, embedding));
    if (Number.isFinite(score)) scores.push({label, score});
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const second = scores[1];
  const confident = best && best.score >= 0.80 && (!second || best.score - second.score >= 0.04);
  return {hostLabel: confident ? best.label : null, hostScores: scores};
};

const load = async ({device = 'wasm'} = {}) => {
  self.postMessage({status: 'loading', detail: {message: `ローカル音声モデルを読込中 (${device})…`}});
  const callback = (item) => self.postMessage({status: 'model-progress', detail: item});
  const [transcriber] = await LocalModels.ensureCore(device, callback);
  if (device === 'webgpu') {
    self.postMessage({status: 'loading', detail: {message: 'WebGPUモデルをウォームアップ中…'}});
    await transcriber(new Float32Array(16000), {language: 'ja'});
  }
  self.postMessage({status: 'loaded', detail: {device, asrModel: ASR_MODEL, segmentationModel: SEGMENTATION_MODEL}});
};

const setHost = async ({audio} = {}) => {
  if (!(audio instanceof Float32Array) || audio.length < 16000) {
    LocalModels.hostEmbedding = null;
    self.postMessage({status: 'host-ready', detail: {enabled: false}});
    return;
  }
  self.postMessage({status: 'loading', detail: {message: 'HOST話者モデルを読込中…'}});
  const callback = (item) => self.postMessage({status: 'model-progress', detail: item});
  LocalModels.hostEmbedding = await computeSpeakerEmbedding(audio, callback);
  self.postMessage({status: 'host-ready', detail: {enabled: true, speakerModel: SPEAKER_MODEL}});
};

const run = async ({runId, audio, language = 'ja', device = 'wasm'} = {}) => {
  if (!(audio instanceof Float32Array) || !audio.length) throw new Error('ローカル解析音声が空です。');
  const [transcriber, segmentationProcessor, segmentationModel] = await LocalModels.ensureCore(device, (item) => {
    self.postMessage({status: 'model-progress', runId, detail: item});
  });

  progress({runId, task: 'transcription', phase: 'start'});
  const start = performance.now();
  const [transcript, segmentationOutput] = await Promise.all([
    transcriber(audio, {
      language,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 29,
      stride_length_s: 5,
    }),
    (async () => {
      progress({runId, task: 'diarization', phase: 'start'});
      const inputs = await segmentationProcessor(audio);
      const {logits} = await segmentationModel(inputs);
      return normalizeSegments(segmentationProcessor, segmentationModel, logits, audio.length);
    })(),
  ]);

  const host = await detectHostLabel(audio, segmentationOutput, (item) => {
    self.postMessage({status: 'model-progress', runId, detail: item});
  });
  const elapsedMs = Math.round(performance.now() - start);
  self.postMessage({
    status: 'complete',
    runId,
    result: {
      transcript,
      segments: segmentationOutput,
      hostLabel: host.hostLabel,
      hostScores: host.hostScores,
      elapsedMs,
      device,
      models: {
        asr: ASR_MODEL,
        diarization: SEGMENTATION_MODEL,
        speakerVerification: LocalModels.hostEmbedding ? SPEAKER_MODEL : null,
      },
    },
  });
};

self.addEventListener('message', async (event) => {
  const {type, data} = event.data || {};
  try {
    if (type === 'load') await load(data);
    else if (type === 'set-host') await setHost(data);
    else if (type === 'run') await run(data);
  } catch (error) {
    self.postMessage({
      status: 'error',
      runId: data?.runId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
