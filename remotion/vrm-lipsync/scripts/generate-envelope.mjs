import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const FPS = 30;
const SAMPLE_RATE = 48000;
const SAMPLES_PER_FRAME = Math.round(SAMPLE_RATE / FPS);
// prepare-clip.mjs は同期精度のため voice.wav を生成する。旧AACが残っていてもWAVを優先する。
const AUDIO_CANDIDATES = ['voice.wav', 'voice.m4a', 'voice.mp3'];
const publicDir = resolve('public');
const audioName = AUDIO_CANDIDATES.find((name) => existsSync(resolve(publicDir, name)));
const speakerTurnsPath = resolve(publicDir, 'speaker-turns.json');
const requireSpeakerTurns = process.env.REQUIRE_SPEAKER_TURNS === '1';

if (!audioName) {
  console.error('音声が見つかりません。public/voice.wav（または m4a / mp3）を置いてください。');
  process.exit(1);
}

const audioPath = resolve(publicDir, audioName);
const ffmpeg = spawnSync(
  'ffmpeg',
  ['-v', 'error', '-i', audioPath, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', 'pipe:1'],
  {encoding: null, maxBuffer: 1024 * 1024 * 512},
);

if (ffmpeg.error) {
  console.error('ffmpeg を起動できません。PATH に ffmpeg があるか確認してください。');
  console.error(ffmpeg.error.message);
  process.exit(1);
}
if (ffmpeg.status !== 0) {
  console.error(Buffer.from(ffmpeg.stderr ?? []).toString('utf8'));
  process.exit(ffmpeg.status ?? 1);
}

const bytes = ffmpeg.stdout;
const usableBytes = bytes.length - (bytes.length % 4);
const floats = new Float32Array(bytes.buffer, bytes.byteOffset, usableBytes / 4);
const frameCount = Math.max(1, Math.ceil(floats.length / SAMPLES_PER_FRAME));
const rms = new Array(frameCount).fill(0);

for (let frame = 0; frame < frameCount; frame++) {
  const start = frame * SAMPLES_PER_FRAME;
  const end = Math.min(floats.length, start + SAMPLES_PER_FRAME);
  let sum = 0;
  for (let i = start; i < end; i++) sum += floats[i] * floats[i];
  rms[frame] = Math.sqrt(sum / Math.max(1, end - start));
}

const sorted = [...rms].sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
const noiseFloor = percentile(0.15);
const speechPeak = Math.max(noiseFloor + 0.001, percentile(0.95));

const normalized = rms.map((value) => {
  const n = (value - noiseFloor) / (speechPeak - noiseFloor);
  return Math.max(0, Math.min(1, Math.pow(n, 0.72)));
});

const buildSpeakerMask = () => {
  if (!existsSync(speakerTurnsPath)) {
    if (requireSpeakerTurns) {
      throw new Error('public/speaker-turns.json がありません。本人と相談者を分離する話者区間を作成してから本番レンダーしてください。');
    }
    console.warn('警告: speaker-turns.json が無いため、全話者の音声で口パクします。QC用途以外では使用しないでください。');
    return new Array(frameCount).fill(1);
  }

  const payload = JSON.parse(readFileSync(speakerTurnsPath, 'utf8'));
  const avatarSpeaker = String(payload.avatarSpeaker ?? 'HOST');
  const turns = Array.isArray(payload.turns) ? payload.turns : [];
  if (turns.length === 0) throw new Error('speaker-turns.json の turns が空です。');

  const mask = new Array(frameCount).fill(0);
  let hostTurnCount = 0;

  for (const turn of turns) {
    const speaker = String(turn.speaker ?? '');
    if (speaker !== avatarSpeaker) continue;
    const startMs = Number(turn.startMs);
    const endMs = Number(turn.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs) {
      throw new Error(`speaker-turns.json に不正な区間があります: ${JSON.stringify(turn)}`);
    }
    hostTurnCount += 1;
    const startFrame = Math.max(0, Math.floor((startMs / 1000) * FPS));
    const endFrame = Math.min(frameCount, Math.ceil((endMs / 1000) * FPS));
    for (let frame = startFrame; frame < endFrame; frame++) mask[frame] = 1;
  }

  if (hostTurnCount === 0 || !mask.some(Boolean)) {
    throw new Error(`speaker-turns.json に avatarSpeaker=${avatarSpeaker} の区間がありません。`);
  }

  return mask;
};

let speakerMask;
try {
  speakerMask = buildSpeakerMask();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// 3-frame moving average。口パクの細かすぎる震えを抑える。
// 話者マスクを前後の参照値にも掛け、相談者の音が境界を越えて口パクへ漏れないようにする。
const maskedNormalized = normalized.map((value, i) => value * speakerMask[i]);
const values = maskedNormalized.map((_, i) => {
  if (!speakerMask[i]) return 0;
  const a = maskedNormalized[Math.max(0, i - 1)];
  const b = maskedNormalized[i];
  const c = maskedNormalized[Math.min(maskedNormalized.length - 1, i + 1)];
  return Number(((a + b * 2 + c) / 4).toFixed(4));
});

const clipped = values.filter((v) => v >= 0.995).length;
const clippedRatio = values.length ? clipped / values.length : 0;
const durationSeconds = floats.length / SAMPLE_RATE;
const activeSpeakerFrames = speakerMask.filter(Boolean).length;
const payload = {
  version: 3,
  audio: audioName,
  fps: FPS,
  durationSeconds: Number(durationSeconds.toFixed(3)),
  durationInFrames: frameCount,
  noiseFloor: Number(noiseFloor.toFixed(6)),
  speechPeak: Number(speechPeak.toFixed(6)),
  speakerGate: {
    source: existsSync(speakerTurnsPath) ? 'speaker-turns.json' : null,
    required: requireSpeakerTurns,
    activeFrames: activeSpeakerFrames,
    activeRatio: Number((activeSpeakerFrames / frameCount).toFixed(4)),
  },
  values,
};

const outputPath = resolve(publicDir, 'envelope.json');
mkdirSync(dirname(outputPath), {recursive: true});
writeFileSync(outputPath, JSON.stringify(payload));

console.log(`音声: ${audioName}`);
console.log(`長さ: ${durationSeconds.toFixed(2)} 秒 / ${frameCount} frames @ ${FPS}fps`);
console.log(`本人話者ゲート: ${existsSync(speakerTurnsPath) ? 'ON' : 'OFF'}`);
console.log(`口パク有効フレーム: ${activeSpeakerFrames}/${frameCount}`);
console.log(`振り切れ率: ${(clippedRatio * 100).toFixed(1)}%`);
console.log(`出力: ${outputPath}`);
if (clippedRatio > 0.3) console.warn('警告: 振り切れ率が30%を超えています。元音声が大きすぎる可能性があります。');