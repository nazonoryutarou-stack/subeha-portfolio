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
const startMs = Number(job.startMs);
const endMs = Number(job.endMs);

if (!job.sourceAudio || !fs.existsSync(sourceAudio)) {
  throw new Error(`sourceAudio が見つかりません: ${sourceAudio}`);
}
if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs) {
  throw new Error('startMs / endMs が不正です。');
}

const durationMs = endMs - startMs;
if (durationMs < 3000) throw new Error('切り抜きが3秒未満です。開始・終了時刻を確認してください。');
if (durationMs > 180000) console.warn('注意: 3分を超える切り抜きです。短尺用途なら長すぎる可能性があります。');

const publicDir = path.join(projectRoot, 'public');
fs.mkdirSync(publicDir, {recursive: true});
const outAudio = path.join(publicDir, 'voice.m4a');

const ffmpegArgs = [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-ss', (startMs / 1000).toFixed(3),
  '-to', (endMs / 1000).toFixed(3),
  '-i', sourceAudio,
  '-vn', '-c:a', 'aac', '-b:a', '192k',
  outAudio,
];
const cut = spawnSync('ffmpeg', ffmpegArgs, {stdio: 'inherit'});
if (cut.status !== 0) throw new Error('ffmpeg による音声切り出しに失敗しました。');

const rawCaptions = Array.isArray(job.captions) ? job.captions : [];
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

const clip = {
  version: 1,
  title: String(job.title ?? '切り抜き'),
  telop: String(job.telop ?? ''),
  hook: String(job.hook ?? ''),
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
console.log(`Audio: public/voice.m4a`);
console.log(`Data : public/clip.json`);
