import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = process.cwd();
const valueArg = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const projectArg = valueArg('project');
const audioArg = valueArg('audio');
const outputArg = valueArg('output');
const concurrencyRaw = valueArg('concurrency') || process.env.REMOTION_CONCURRENCY || '';
const concurrency = concurrencyRaw ? Number(concurrencyRaw) : null;
const planOnly = process.argv.includes('--plan-only');
if (!projectArg || !audioArg) {
  console.error('使い方: npm run render:studio -- --project=/path/project.json --audio=/path/source.m4a [--output=out/studio.mp4] [--concurrency=4] [--plan-only]');
  process.exit(2);
}
if (concurrency != null && (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16)) {
  throw new Error(`concurrency は1〜16の整数で指定してください: ${concurrencyRaw}`);
}

const studioProjectPath = path.resolve(projectRoot, projectArg);
if (!fs.existsSync(studioProjectPath)) throw new Error(`project.json がありません: ${studioProjectPath}`);
const studio = JSON.parse(fs.readFileSync(studioProjectPath, 'utf8'));
const width = Number(studio.layout?.width || 720);
const height = Number(studio.layout?.height || 1280);
const startMs = Number(studio.clip?.startMs || 0);
const endMs = Number(studio.clip?.endMs || studio.source?.durationMs || 0);
const expectedDurationSeconds = (endMs - startMs) / 1000;
if (!Number.isFinite(expectedDurationSeconds) || expectedDurationSeconds <= 0) throw new Error('project.json のclip尺が不正です。');

const compositionBySize = new Map([
  ['720x1280', 'VrmLipSync'],
  ['900x900', 'VrmLipSyncSquare'],
  ['1280x720', 'VrmLipSyncLandscape'],
]);
const composition = compositionBySize.get(`${width}x${height}`);
if (!composition) throw new Error(`未対応の出力サイズです: ${width}x${height}`);

const outputPath = path.resolve(projectRoot, outputArg || 'out/studio.mp4');
if (planOnly) {
  console.log(JSON.stringify({
    ok: true,
    composition,
    width,
    height,
    expectedDurationSeconds,
    concurrency,
    project: studioProjectPath,
    audio: path.resolve(projectRoot, audioArg),
    output: outputPath,
  }));
  process.exit(0);
}

fs.mkdirSync(path.dirname(outputPath), {recursive: true});

const run = (command, args, {env = {}} = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {...process.env, ...env},
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
};

run(process.execPath, [
  path.join(projectRoot, 'scripts', 'prepare-studio.mjs'),
  `--project=${projectArg}`,
  `--audio=${audioArg}`,
], {env: {REQUIRE_SPEAKER_TURNS: '1'}});

run('npm', ['run', 'check']);
const remotionArgs = [
  '--no-install',
  'remotion', 'render', composition, outputPath,
  '--codec=h264',
  '--crf=20',
];
if (concurrency != null) remotionArgs.push(`--concurrency=${concurrency}`);
run('npx', remotionArgs);

const tolerance = 0.5;
run(process.execPath, [
  path.join(projectRoot, 'scripts', 'validate-render.mjs'),
  `--input=${outputPath}`,
  `--width=${width}`,
  `--height=${height}`,
  `--min-duration=${Math.max(0, expectedDurationSeconds - tolerance)}`,
  `--max-duration=${expectedDurationSeconds + tolerance}`,
  '--max-av-drift=0.15',
]);

run(process.execPath, [
  path.join(projectRoot, 'scripts', 'extract-qc-frames.mjs'),
  `--input=${outputPath}`,
]);

console.log('');
console.log('Studio render structurally valid');
console.log(`Composition: ${composition} (${width}x${height})`);
console.log(`Expected duration: ${expectedDurationSeconds.toFixed(3)}s`);
console.log(`Concurrency: ${concurrency ?? 'remotion default'}`);
console.log(`Output: ${outputPath}`);
console.log('QC frames extracted. 実人物話者・字幕・画像タイミングは目視QCしてください。');
