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
const planOnly = process.argv.includes('--plan-only');
if (!projectArg || !audioArg) {
  console.error('使い方: npm run render:studio -- --project=/path/project.json --audio=/path/source.m4a [--output=out/studio.mp4] [--plan-only]');
  process.exit(2);
}

const studioProjectPath = path.resolve(projectRoot, projectArg);
if (!fs.existsSync(studioProjectPath)) throw new Error(`project.json がありません: ${studioProjectPath}`);
const studio = JSON.parse(fs.readFileSync(studioProjectPath, 'utf8'));
const width = Number(studio.layout?.width || 720);
const height = Number(studio.layout?.height || 1280);

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
run('npx', [
  '--no-install',
  'remotion', 'render', composition, outputPath,
  '--codec=h264',
  '--crf=20',
]);
run(process.execPath, [
  path.join(projectRoot, 'scripts', 'extract-qc-frames.mjs'),
  `--input=${outputPath}`,
]);

console.log('');
console.log('Studio render complete');
console.log(`Composition: ${composition} (${width}x${height})`);
console.log(`Output: ${outputPath}`);
console.log('QC frames extracted. 実人物話者・字幕・画像タイミングは目視QCしてください。');
