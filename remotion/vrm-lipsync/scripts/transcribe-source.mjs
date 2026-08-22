import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  downloadWhisperModel,
  installWhisperCpp,
  transcribe,
  toCaptions,
} from '@remotion/install-whisper-cpp';

const root = process.cwd();
const jobArg = process.argv.find((arg) => arg.startsWith('--job='));
const jobPath = path.resolve(root, jobArg ? jobArg.slice('--job='.length) : 'jobs/current.json');
if (!fs.existsSync(jobPath)) throw new Error(`Job not found: ${jobPath}`);

const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const sourceAudio = path.resolve(root, job.sourceAudio ?? '');
if (!job.sourceAudio || !fs.existsSync(sourceAudio)) throw new Error(`sourceAudio が見つかりません: ${sourceAudio}`);

const inputsDir = path.join(root, 'inputs');
const captionsPath = path.join(inputsDir, 'source.captions.json');
const metaPath = path.join(inputsDir, 'source.captions.meta.json');
const sourceStat = fs.statSync(sourceAudio);
const sourceKey = {
  sourceAudio: path.relative(root, sourceAudio),
  size: sourceStat.size,
  mtimeMs: Math.round(sourceStat.mtimeMs),
};

if (fs.existsSync(captionsPath) && fs.existsSync(metaPath) && !process.argv.includes('--force')) {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (
    meta.sourceAudio === sourceKey.sourceAudio &&
    meta.size === sourceKey.size &&
    meta.mtimeMs === sourceKey.mtimeMs
  ) {
    console.log(`Transcription cache hit: ${captionsPath}`);
    process.exit(0);
  }
}

const cacheDir = path.join(root, '.cache');
const whisperDir = path.join(cacheDir, 'whisper.cpp');
const wavPath = path.join(cacheDir, 'source-16k.wav');
fs.mkdirSync(cacheDir, {recursive: true});
fs.mkdirSync(inputsDir, {recursive: true});

const wav = spawnSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', sourceAudio,
  '-ac', '1', '-ar', '16000',
  wavPath,
], {stdio: 'inherit'});
if (wav.status !== 0) throw new Error('Whisper用16kHz WAVの生成に失敗しました。');

const whisperCppVersion = process.env.WHISPER_CPP_VERSION || '1.5.5';
const model = process.env.WHISPER_MODEL || 'small';
const language = process.env.WHISPER_LANGUAGE || 'ja';

await installWhisperCpp({
  to: whisperDir,
  version: whisperCppVersion,
});
await downloadWhisperModel({
  model,
  folder: whisperDir,
});

const whisperCppOutput = await transcribe({
  model,
  whisperPath: whisperDir,
  whisperCppVersion,
  inputPath: wavPath,
  tokenLevelTimestamps: true,
  language,
});
const {captions} = toCaptions({whisperCppOutput});

fs.writeFileSync(captionsPath, JSON.stringify(captions, null, 2) + '\n');
fs.writeFileSync(metaPath, JSON.stringify({...sourceKey, model, whisperCppVersion, language}, null, 2) + '\n');
console.log(`Transcribed: ${captions.length} captions (${language})`);
console.log(`Saved: ${captionsPath}`);
