import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = process.cwd();
const jobArg = process.argv.find((arg) => arg.startsWith('--job='));
const jobPath = path.resolve(projectRoot, jobArg ? jobArg.slice('--job='.length) : 'jobs/current.json');

if (!fs.existsSync(jobPath)) {
  console.error(`Job not found: ${jobPath}`);
  console.error('jobs/current.example.json をコピーして jobs/current.json を作ってください。');
  process.exit(1);
}

const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
const sourceAudio = path.resolve(projectRoot, job.sourceAudio ?? '');
if (!job.sourceAudio || !fs.existsSync(sourceAudio)) {
  throw new Error(`sourceAudio が見つかりません: ${sourceAudio}`);
}

const normalize = (text) => String(text ?? '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s\p{P}\p{S}]/gu, '');

const ensureSourceCaptions = () => {
  const transcribe = spawnSync(process.execPath, [path.join(projectRoot, 'scripts/transcribe-source.mjs'), `--job=${path.relative(projectRoot, jobPath)}`], {stdio: 'inherit'});
  if (transcribe.status !== 0) throw new Error('元音声の文字起こし・タイムコード生成に失敗しました。');
  const captionsPath = path.join(projectRoot, 'inputs', 'source.captions.json');
  if (!fs.existsSync(captionsPath)) throw new Error('inputs/source.captions.json が生成されませんでした。');
  const captions = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
  if (!Array.isArray(captions) || captions.length === 0) throw new Error('タイムコード付き字幕が空です。');
  return captions;
};

const locateQuote = (quote, captions) => {
  const needle = normalize(quote);
  if (needle.length < 4) throw new Error('quote / anchor が短すぎます。4文字以上の特徴的な発言を指定してください。');

  let combined = '';
  const charToCaption = [];
  captions.forEach((caption, captionIndex) => {
    const piece = normalize(caption.text);
    for (let i = 0; i < piece.length; i++) charToCaption.push(captionIndex);
    combined += piece;
  });

  let startPos = combined.indexOf(needle);
  let endPos = startPos >= 0 ? startPos + needle.length - 1 : -1;

  if (startPos < 0) {
    const chunkLength = Math.min(10, Math.max(6, Math.floor(needle.length / 3)));
    const firstChunk = needle.slice(0, chunkLength);
    const lastChunk = needle.slice(-chunkLength);
    const firstPos = combined.indexOf(firstChunk);
    const lastPos = combined.indexOf(lastChunk, Math.max(0, firstPos));
    if (firstPos >= 0 && lastPos >= firstPos) {
      startPos = firstPos;
      endPos = lastPos + lastChunk.length - 1;
    }
  }

  if (startPos < 0 || endPos < 0 || (!charToCaption[startPos] && charToCaption[startPos] !== 0)) {
    throw new Error(`選んだ発言を音声認識結果から見つけられませんでした: ${quote}`);
  }

  const firstIndex = charToCaption[startPos];
  const lastIndex = charToCaption[Math.min(endPos, charToCaption.length - 1)];
  return {
    firstIndex,
    lastIndex,
    startMs: Number(captions[firstIndex].startMs),
    endMs: Number(captions[lastIndex].endMs),
  };
};

let sourceCaptions = null;
let startMs = Number(job.startMs);
let endMs = Number(job.endMs);
const hasExplicitRange = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs >= 0 && endMs > startMs;

if (!hasExplicitRange) {
  const selectedText = String(job.anchor || job.quote || '').trim();
  if (!selectedText) {
    throw new Error('startMs/endMs または quote（推奨: anchor）を指定してください。');
  }
  sourceCaptions = ensureSourceCaptions();
  const match = locateQuote(selectedText, sourceCaptions);
  const beforeMs = Number.isFinite(Number(job.contextBeforeMs)) ? Number(job.contextBeforeMs) : 1300;
  const afterMs = Number.isFinite(Number(job.contextAfterMs)) ? Number(job.contextAfterMs) : 1800;
  const lastCaptionEnd = Number(sourceCaptions[sourceCaptions.length - 1]?.endMs ?? match.endMs + afterMs);
  startMs = Math.max(0, match.startMs - beforeMs);
  endMs = Math.min(lastCaptionEnd, match.endMs + afterMs);
  console.log(`Quote located: ${(match.startMs / 1000).toFixed(2)}s - ${(match.endMs / 1000).toFixed(2)}s`);
  console.log(`Clip range   : ${(startMs / 1000).toFixed(2)}s - ${(endMs / 1000).toFixed(2)}s`);
}

if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs) {
  throw new Error('切り抜き範囲を決定できませんでした。');
}

const durationMs = endMs - startMs;
if (durationMs < 3000) throw new Error('切り抜きが3秒未満です。開始・終了位置を確認してください。');
if (durationMs > 90000) console.warn('注意: 90秒を超える切り抜きです。短尺用途なら長すぎる可能性があります。');

if (!sourceCaptions && (!Array.isArray(job.captions) || job.captions.length === 0)) {
  sourceCaptions = ensureSourceCaptions();
}

const publicDir = path.join(projectRoot, 'public');
fs.mkdirSync(publicDir, {recursive: true});

// リポジトリ直下にある実VRMを、Remotionのpublicへ自動配置する。
// 手作業でSubeha.vrmを置き忘れて別モデルや静止画へ逃げないための安全策。
const modelTarget = path.join(publicDir, 'Subeha.vrm');
if (!fs.existsSync(modelTarget)) {
  const modelCandidates = [
    path.resolve(projectRoot, '../../subeha-web-site.vrm'),
    path.resolve(projectRoot, '../../assets/vrm/subeha-web-site.vrm'),
  ];
  const modelSource = modelCandidates.find((candidate) => fs.existsSync(candidate));
  if (!modelSource) {
    throw new Error('Subeha.vrm がありません。リポジトリ直下の subeha-web-site.vrm も見つかりません。');
  }
  fs.copyFileSync(modelSource, modelTarget);
  console.log(`VRM copied: ${path.relative(projectRoot, modelSource)} -> public/Subeha.vrm`);
}

// 中間AACのencoder delayや二重seekで字幕と音声をずらさない。
// 入力を一度読み、atrim + asetptsで0秒基準のPCM WAVを生成する。
const outAudio = path.join(publicDir, 'voice.wav');
const startSec = (startMs / 1000).toFixed(6);
const endSec = (endMs / 1000).toFixed(6);
const ffmpegArgs = [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-i', sourceAudio,
  '-vn',
  '-af', `atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS`,
  '-ac', '1', '-ar', '48000',
  '-c:a', 'pcm_s16le',
  outAudio,
];
const cut = spawnSync('ffmpeg', ffmpegArgs, {stdio: 'inherit'});
if (cut.status !== 0) throw new Error('ffmpeg による精密音声切り出しに失敗しました。');

const rawCaptions = Array.isArray(job.captions) && job.captions.length > 0 ? job.captions : (sourceCaptions ?? []);
const captions = rawCaptions
  .map((caption) => {
    const absoluteStart = Number(caption.startMs);
    const absoluteEnd = Number(caption.endMs);
    if (!Number.isFinite(absoluteStart) || !Number.isFinite(absoluteEnd)) return null;
    const clippedStart = Math.max(startMs, absoluteStart);
    const clippedEnd = Math.min(endMs, absoluteEnd);
    if (clippedEnd <= clippedStart) return null;
    return {
      text: String(caption.text ?? '').trim(),
      startMs: Math.max(0, clippedStart - startMs),
      endMs: Math.min(durationMs, clippedEnd - startMs),
      timestampMs: caption.timestampMs == null ? null : Math.max(0, Number(caption.timestampMs) - startMs),
      confidence: caption.confidence == null ? null : Number(caption.confidence),
    };
  })
  .filter((caption) => caption && caption.text);

if (captions.length === 0) {
  throw new Error('切り抜き範囲に字幕がありません。時刻か文字起こしを確認してください。');
}

const clip = {
  version: 3,
  title: String(job.title ?? '切り抜き'),
  telop: String(job.telop ?? ''),
  hook: String(job.hook ?? ''),
  quote: String(job.quote ?? ''),
  sourceLabel: String(job.sourceLabel ?? ''),
  startMs,
  endMs,
  durationMs,
  captions,
};

fs.writeFileSync(path.join(publicDir, 'clip.json'), JSON.stringify(clip, null, 2) + '\n');

const envelope = spawnSync(process.execPath, [path.join(projectRoot, 'scripts/generate-envelope.mjs')], {stdio: 'inherit'});
if (envelope.status !== 0) throw new Error('口パク波形の生成に失敗しました。');

console.log(`Prepared: ${(durationMs / 1000).toFixed(2)} sec / captions ${captions.length}`);
console.log(`Title: ${clip.title}`);
console.log('Audio: public/voice.wav');
console.log('Model: public/Subeha.vrm');
console.log('Data : public/clip.json');
