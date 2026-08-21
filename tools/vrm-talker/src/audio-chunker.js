import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  Output,
  WavOutputFormat,
} from 'mediabunny';

export const DEFAULT_TRANSCRIPTION_CHUNK_SECONDS = 8 * 60;

const makeInput = (file) => new Input({
  formats: ALL_FORMATS,
  source: new BlobSource(file),
});

export const getMediaDuration = async (file) => {
  const input = makeInput(file);
  try {
    return await input.computeDuration();
  } finally {
    await input.dispose?.();
  }
};

export const extractWavRange = async (file, startSeconds, endSeconds) => {
  const start = Math.max(0, Number(startSeconds) || 0);
  const end = Math.max(start, Number(endSeconds) || 0);
  if (!(end > start)) throw new Error('音声抽出区間が不正です。');

  const input = makeInput(file);
  const target = new BufferTarget();
  const output = new Output({
    format: new WavOutputFormat(),
    target,
  });

  try {
    const conversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: {discard: true},
      audio: {
        numberOfChannels: 1,
        sampleRate: 16000,
        sampleFormat: 's16',
        forceTranscode: true,
      },
      trim: {start, end},
      tags: {},
      showWarnings: false,
    });

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks.map((item) => item.reason || 'unknown').join(', ');
      throw new Error(`このブラウザで音声を変換できません${reasons ? `: ${reasons}` : ''}`);
    }

    await conversion.execute();
    const buffer = target.buffer;
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) {
      throw new Error('WAV変換結果が空です。');
    }

    const filename = `chunk-${start.toFixed(3)}-${end.toFixed(3)}.wav`;
    return new File([buffer], filename, {type: 'audio/wav'});
  } finally {
    await input.dispose?.();
  }
};

export const splitAudioForTranscription = async (file, {
  chunkSeconds = DEFAULT_TRANSCRIPTION_CHUNK_SECONDS,
  onProgress = null,
} = {}) => {
  const duration = await getMediaDuration(file);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('音声の長さを取得できません。');

  const size = Math.max(60, Math.min(10 * 60, Number(chunkSeconds) || DEFAULT_TRANSCRIPTION_CHUNK_SECONDS));
  const chunks = [];
  const count = Math.ceil(duration / size);

  for (let index = 0; index < count; index++) {
    const startSeconds = index * size;
    const endSeconds = Math.min(duration, startSeconds + size);
    onProgress?.({phase: 'encode', index, count, startSeconds, endSeconds});
    const fileChunk = await extractWavRange(file, startSeconds, endSeconds);
    chunks.push({
      index,
      count,
      startMs: Math.round(startSeconds * 1000),
      endMs: Math.round(endSeconds * 1000),
      file: fileChunk,
    });
  }

  return {durationMs: Math.round(duration * 1000), chunks};
};
