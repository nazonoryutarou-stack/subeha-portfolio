import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const valueArg = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const inputArg = valueArg('input');
if (!inputArg) {
  console.error('使い方: node scripts/validate-render.mjs --input=out/video.mp4 [--width=720 --height=1280 --min-duration=44.5 --max-duration=45.5 --max-av-drift=0.25]');
  process.exit(2);
}

const input = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(input)) throw new Error(`render file not found: ${input}`);

const expectedWidth = valueArg('width') == null ? null : Number(valueArg('width'));
const expectedHeight = valueArg('height') == null ? null : Number(valueArg('height'));
const minDuration = Number(valueArg('min-duration') ?? 0);
const maxDuration = Number(valueArg('max-duration') ?? 0);
const maxAvDrift = Number(valueArg('max-av-drift') ?? 0.25);

if ((expectedWidth == null) !== (expectedHeight == null)) throw new Error('--width と --height は両方指定してください。');
if (expectedWidth != null && (!Number.isInteger(expectedWidth) || !Number.isInteger(expectedHeight) || expectedWidth <= 0 || expectedHeight <= 0)) {
  throw new Error('期待解像度が不正です。');
}

const probe = spawnSync('ffprobe', [
  '-v', 'error',
  '-show_entries', 'format=duration:stream=index,codec_type,codec_name,width,height,duration,nb_frames',
  '-of', 'json',
  input,
], {encoding: 'utf8'});
if (probe.error) throw probe.error;
if (probe.status !== 0) throw new Error(`ffprobe failed: ${String(probe.stderr || '').trim()}`);

const data = JSON.parse(probe.stdout || '{}');
const streams = Array.isArray(data.streams) ? data.streams : [];
const video = streams.find((stream) => stream.codec_type === 'video');
const audio = streams.find((stream) => stream.codec_type === 'audio');
if (!video) throw new Error('FAIL: no video stream');
if (!audio) throw new Error('FAIL: no audio stream');

const width = Number(video.width || 0);
const height = Number(video.height || 0);
if (!(width > 0 && height > 0)) throw new Error(`FAIL: invalid dimensions ${width}x${height}`);
if (expectedWidth != null && (width !== expectedWidth || height !== expectedHeight)) {
  throw new Error(`FAIL: expected ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
}

const formatDuration = Number(data.format?.duration);
const videoDuration = Number.isFinite(Number(video.duration)) ? Number(video.duration) : formatDuration;
const audioDuration = Number.isFinite(Number(audio.duration)) ? Number(audio.duration) : formatDuration;
if (!Number.isFinite(videoDuration) || !Number.isFinite(audioDuration)) throw new Error('FAIL: could not determine both stream durations');

const avDrift = Math.abs(videoDuration - audioDuration);
if (avDrift > maxAvDrift) {
  throw new Error(`FAIL: A/V durations diverge (${videoDuration.toFixed(3)}s vs ${audioDuration.toFixed(3)}s, drift ${avDrift.toFixed(3)}s)`);
}

const duration = Math.max(videoDuration, audioDuration);
if (Number.isFinite(minDuration) && minDuration > 0 && duration < minDuration) {
  throw new Error(`FAIL: render too short: ${duration.toFixed(3)}s < ${minDuration.toFixed(3)}s`);
}
if (Number.isFinite(maxDuration) && maxDuration > 0 && duration > maxDuration) {
  throw new Error(`FAIL: render too long: ${duration.toFixed(3)}s > ${maxDuration.toFixed(3)}s`);
}

const report = {
  file: path.basename(input),
  dimensions: `${width}x${height}`,
  videoCodec: video.codec_name || null,
  audioCodec: audio.codec_name || null,
  videoDuration: Number(videoDuration.toFixed(6)),
  audioDuration: Number(audioDuration.toFixed(6)),
  avDrift: Number(avDrift.toFixed(6)),
  videoFrames: /^\d+$/.test(String(video.nb_frames || '')) ? Number(video.nb_frames) : video.nb_frames || null,
  status: 'pass',
};
console.log(JSON.stringify(report, null, 2));
