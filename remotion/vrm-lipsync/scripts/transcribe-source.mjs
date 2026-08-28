import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from '@remotion/install-whisper-cpp';
import {aggregateTimedCaptions} from './caption-aggregation.mjs';

const root = process.cwd();
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const jobArg = valueArg('job');
const audioArg = valueArg('audio');
const outputDir = path.resolve(root, valueArg('output-dir') || 'inputs/asr');

let sourceAudio = audioArg ? path.resolve(root, audioArg) : null;
if (!sourceAudio && jobArg) {
  const jobPath = path.resolve(root, jobArg);
  if (!fs.existsSync(jobPath)) throw new Error(`Job not found: ${jobPath}`);
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  sourceAudio = job.sourceAudio ? path.resolve(root, job.sourceAudio) : null;
}
if (!sourceAudio || !fs.existsSync(sourceAudio)) {
  throw new Error('Source audio is required. Pass --audio=<path> or --job=<json with sourceAudio>.');
}

const sourceBuffer = fs.readFileSync(sourceAudio);
const sourceSha256 = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
const sourceStat = fs.statSync(sourceAudio);
const whisperCppVersion = process.env.WHISPER_CPP_VERSION || '1.5.5';
const model = process.env.WHISPER_MODEL || 'small';
const language = process.env.WHISPER_LANGUAGE || 'ja';
const captionAggregation = 'phrase-v1';

const captionsPath = path.join(outputDir, 'timed-asr.json');
const tokensPath = path.join(outputDir, 'timed-asr.tokens.json');
const srtPath = path.join(outputDir, 'timed-asr.srt');
const vttPath = path.join(outputDir, 'timed-asr.vtt');
const metaPath = path.join(outputDir, 'timed-asr.meta.json');
fs.mkdirSync(outputDir, {recursive: true});

if (fs.existsSync(captionsPath) && fs.existsSync(metaPath) && !process.argv.includes('--force')) {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (
    meta.sourceSha256 === sourceSha256 &&
    meta.model === model &&
    meta.whisperCppVersion === whisperCppVersion &&
    meta.language === language &&
    meta.captionAggregation === captionAggregation
  ) {
    console.log(`Transcription cache hit: ${captionsPath}`);
    process.exit(0);
  }
}

const cacheDir = path.join(root, '.cache', 'whisper-align');
const whisperDir = path.join(cacheDir, `whisper.cpp-${whisperCppVersion}`);
const wavPath = path.join(cacheDir, `${sourceSha256.slice(0, 16)}-16k.wav`);
fs.mkdirSync(cacheDir, {recursive: true});

const wav = spawnSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', sourceAudio,
  '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
  wavPath,
], {stdio: 'inherit'});
if (wav.status !== 0) throw new Error('Failed to generate the 16 kHz Whisper analysis WAV.');

const durationProbe = spawnSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', sourceAudio,
], {encoding: 'utf8'});
if (durationProbe.status !== 0) throw new Error('ffprobe failed for source audio.');
const sourceDurationSeconds = Number(String(durationProbe.stdout || '').trim());
if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) throw new Error('Invalid source audio duration.');

await installWhisperCpp({to: whisperDir, version: whisperCppVersion});
await downloadWhisperModel({model, folder: whisperDir});

const whisperCppOutput = await transcribe({
  model,
  whisperPath: whisperDir,
  whisperCppVersion,
  inputPath: wavPath,
  tokenLevelTimestamps: true,
  language,
});
const converted = toCaptions({whisperCppOutput});
const tokenCaptions = (converted.captions || [])
  .map((caption) => ({
    text: String(caption.text || '').trim(),
    startMs: Number(caption.startMs),
    endMs: Number(caption.endMs),
    timestampMs: Number(caption.timestampMs ?? caption.startMs),
    confidence: caption.confidence ?? null,
  }))
  .filter((caption) => caption.text && Number.isFinite(caption.startMs) && Number.isFinite(caption.endMs) && caption.endMs > caption.startMs);

if (!tokenCaptions.length) throw new Error('Whisper returned no timed captions.');
for (const caption of tokenCaptions) {
  if (caption.startMs < 0 || caption.endMs > sourceDurationSeconds * 1000 + 1000) {
    throw new Error(`Whisper timestamp outside source duration: ${caption.startMs}-${caption.endMs}ms`);
  }
}

const captions = aggregateTimedCaptions(tokenCaptions);
if (!captions.length) throw new Error('Caption aggregation returned no readable captions.');

fs.writeFileSync(tokensPath, JSON.stringify(tokenCaptions, null, 2) + '\n');
fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2) + '\n');
fs.writeFileSync(srtPath, toSrt(captions));
fs.writeFileSync(vttPath, toVtt(captions));
fs.writeFileSync(metaPath, JSON.stringify({
  version: 2,
  sourceAudio: path.relative(root, sourceAudio),
  sourceSha256,
  sourceSize: sourceStat.size,
  sourceDurationSeconds,
  model,
  whisperCppVersion,
  language,
  captionAggregation,
  tokenCaptionCount: tokenCaptions.length,
  captionCount: captions.length,
}, null, 2) + '\n');

console.log(`Transcribed ${tokenCaptions.length} timed tokens from ${sourceDurationSeconds.toFixed(3)}s source.`);
console.log(`Aggregated to ${captions.length} readable captions (${captionAggregation}).`);
console.log(`JSON:   ${captionsPath}`);
console.log(`Tokens: ${tokensPath}`);
console.log(`SRT:    ${srtPath}`);
console.log(`VTT:    ${vttPath}`);

function toSrt(items) {
  return items.map((caption, index) => [
    String(index + 1),
    `${formatTime(caption.startMs, ',')} --> ${formatTime(caption.endMs, ',')}`,
    caption.text,
    '',
  ].join('\n')).join('\n');
}

function toVtt(items) {
  return `WEBVTT\n\n${items.map((caption) => [
    `${formatTime(caption.startMs, '.')} --> ${formatTime(caption.endMs, '.')}`,
    caption.text,
    '',
  ].join('\n')).join('\n')}`;
}

function formatTime(ms, separator) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}${separator}${pad(millis, 3)}`;
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}
