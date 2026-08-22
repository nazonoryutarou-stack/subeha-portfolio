import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = process.cwd();
const valueArg = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const planArg = valueArg('plan');
const audioArg = valueArg('audio');
const outputArg = valueArg('output') || 'out/assistant.mp4';
const projectArg = valueArg('project-out') || 'jobs/.generated/assistant-project.json';
const planOnly = process.argv.includes('--plan-only');

if (!planArg || !audioArg) {
  console.error('使い方: npm run render:assistant -- --plan=/path/edit-plan.json --audio=/path/source.m4a [--output=out/assistant.mp4] [--project-out=jobs/.generated/assistant-project.json] [--plan-only]');
  process.exit(2);
}

const run = (command, args, {capture = false} = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (${result.status})`);
  return capture ? result.stdout : '';
};

run(process.execPath, [
  path.join(projectRoot, 'scripts', 'import-assistant-plan.mjs'),
  `--plan=${planArg}`,
  `--audio=${audioArg}`,
  `--output-project=${projectArg}`,
]);

const generatedProject = path.resolve(projectRoot, projectArg);
if (!fs.existsSync(generatedProject)) throw new Error(`assistant project が生成されませんでした: ${generatedProject}`);

const args = [
  path.join(projectRoot, 'scripts', 'render-studio.mjs'),
  `--project=${projectArg}`,
  `--audio=${audioArg}`,
  `--output=${outputArg}`,
];
if (planOnly) args.push('--plan-only');
run(process.execPath, args);

console.log('');
console.log(`Assistant render pipeline complete: ${path.resolve(projectRoot, outputArg)}`);
console.log('HOSTのみVRM発話モーション対象。GUEST/UNKNOWN区間は口・発話連動モーションを止めます。');
