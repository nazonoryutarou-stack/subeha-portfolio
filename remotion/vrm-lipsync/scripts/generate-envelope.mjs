import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const FPS = 30;
const SAMPLE_RATE = 48000;
const SAMPLES_PER_FRAME = Math.round(SAMPLE_RATE / FPS);
const AUDIO_CANDIDATES = ['voice.m4a', 'voice.mp3', 'voice.wav'];
const publicDir = resolve('public');
const audioName = AUDIO_CANDIDATES.find((name) => existsSync(resolve(publicDir, name)));

if (!audioName) {
  console.error('音声が見つかりません。public/voice.m4a（または mp3 / wav）を置いてください。');
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

// 3-frame moving average. 口パクの細かすぎる震えを抑える。
const values = normalized.map((_, i) => {
  const a = normalized[Math.max(0, i - 1)];
  const b = normalized[i];
  const c = normalized[Math.min(normalized.length - 1, i + 1)];
  return Number(((a + b * 2 + c) / 4).toFixed(4));
});

const clipped = values.filter((v) => v >= 0.995).length;
const clippedRatio = values.length ? clipped / values.length : 0;
const durationSeconds = floats.length / SAMPLE_RATE;
const payload = {
  version: 1,
  audio: audioName,
  fps: FPS,
  durationSeconds: Number(durationSeconds.toFixed(3)),
  durationInFrames: frameCount,
  noiseFloor: Number(noiseFloor.toFixed(6)),
  speechPeak: Number(speechPeak.toFixed(6)),
  values,
};

const outputPath = resolve(publicDir, 'envelope.json');
mkdirSync(dirname(outputPath), {recursive: true});
writeFileSync(outputPath, JSON.stringify(payload));

console.log(`音声: ${audioName}`);
console.log(`長さ: ${durationSeconds.toFixed(2)} 秒 / ${frameCount} frames @ ${FPS}fps`);
console.log(`振り切れ率: ${(clippedRatio * 100).toFixed(1)}%`);
console.log(`出力: ${outputPath}`);
if (clippedRatio > 0.3) console.warn('警告: 振り切れ率が30%を超えています。元音声が大きすぎる可能性があります。');
