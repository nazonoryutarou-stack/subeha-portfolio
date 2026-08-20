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

const cacheDir = path.join(root, '.cache');
const whisperDir = path.join(cacheDir, 'whisper.cpp');
const wavPath = path.join(cacheDir, 'source-16k.wav');
fs.mkdirSync(cacheDir, {recursive: true});

const wav = spawnSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', sourceAudio,
  '-ac', '1', '-ar', '16000',
  wavPath,
], {stdio: 'inherit'});
if (wav.status !== 0) throw new Error('Whisper用16kHz WAVの生成に失敗しました。');

const whisperCppVersion = process.env.WHISPER_CPP_VERSION || '1.5.5';
const model = process.env.WHISPER_MODEL || 'small';

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
});
const {captions} = toCaptions({whisperCppOutput});

const outPath = path.join(root, 'inputs', 'source.captions.json');
fs.mkdirSync(path.dirname(outPath), {recursive: true});
fs.writeFileSync(outPath, JSON.stringify(captions, null, 2) + '\n');
console.log(`Transcribed: ${captions.length} captions`);
console.log(`Saved: ${outPath}`);
