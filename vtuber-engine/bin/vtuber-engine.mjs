#!/usr/bin/env node
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const engineDir = resolve(here, '..');
const repoRoot = resolve(engineDir, '..');
const remotionDir = join(repoRoot, 'remotion', 'vrm-lipsync');
const projectsDir = join(engineDir, 'projects');

const args = process.argv.slice(2);
const command = args.shift() || 'help';

const log = (...xs) => console.log('[ブイチューバーエンジン]', ...xs);
const fail = (message, code = 1) => { console.error(`[ブイチューバーエンジン] ${message}`); process.exit(code); };

const run = (cmd, cmdArgs, options = {}) => {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: options.cwd || repoRoot,
    stdio: 'inherit',
    env: {...process.env, ...(options.env || {})},
    shell: process.platform === 'win32',
  });
  if (result.error) fail(`${cmd} を起動できません: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const commandExists = (cmd) => {
  const probe = spawnSync(cmd, ['-version'], {stdio: 'ignore', shell: process.platform === 'win32'});
  return !probe.error && probe.status === 0;
};

const projectPath = (name) => join(projectsDir, name);

const listProjects = () => {
  if (!existsSync(projectsDir)) return [];
  return readdirSync(projectsDir, {withFileTypes: true}).filter((d) => d.isDirectory()).map((d) => d.name).sort();
};

const findAudio = (project) => {
  for (const name of ['source.m4a', 'source.wav', 'source.opus']) {
    const p = join(project, name);
    if (existsSync(p)) return p;
  }
  return null;
};

const resolveProjectName = () => {
  const explicit = args.find((a) => !a.startsWith('--'));
  if (explicit) return explicit;
  const current = projectPath('current');
  if (existsSync(current)) return 'current';
  const projects = listProjects();
  if (projects.length === 1) return projects[0];
  fail(`project名を指定してください。利用可能: ${projects.join(', ') || 'なし'}`);
};

const relativeFromRemotion = (path) => relative(remotionDir, path).replaceAll('\\', '/');

const templatePlan = (title = '') => ({
  version: 1,
  sourceLabel: 'ブイチューバーエンジン',
  selection: {
    reason: '',
    hook: '',
    summary: '',
  },
  clip: {startMs: 0, endMs: 1000},
  layout: {width: 1280, height: 720, captionBottomPx: 34, background: '#111318'},
  text: {title, telop: ''},
  captions: [
    {startMs: 0, endMs: 1000, speaker: 'HOST', text: '字幕をここへ', speakerConfidence: 1},
  ],
  visualReferences: [],
  motion: {profile: 'normal', notes: ''},
});

const help = () => {
  console.log(`\nブイチューバーエンジン\n\n使い方:\n  node vtuber-engine/bin/vtuber-engine.mjs doctor\n  node vtuber-engine/bin/vtuber-engine.mjs new <project>\n  node vtuber-engine/bin/vtuber-engine.mjs transcribe <project>\n  node vtuber-engine/bin/vtuber-engine.mjs render <project>\n  node vtuber-engine/bin/vtuber-engine.mjs list\n\nproject構成:\n  vtuber-engine/projects/<project>/edit-plan.json\n  vtuber-engine/projects/<project>/source.m4a|wav|opus\n  vtuber-engine/projects/<project>/assets/\n  vtuber-engine/projects/<project>/out/\n`);
};

if (command === 'help' || command === '--help' || command === '-h') {
  help();
  process.exit(0);
}

if (command === 'doctor') {
  const checks = [
    ['Node >= 22', Number(process.versions.node.split('.')[0]) >= 22, process.version],
    ['ffmpeg', commandExists('ffmpeg'), ''],
    ['ffprobe', commandExists('ffprobe'), ''],
    ['production Subeha.vrm', existsSync(join(repoRoot, 'Subeha.vrm')), join(repoRoot, 'Subeha.vrm')],
    ['Remotion package', existsSync(join(remotionDir, 'package.json')), join(remotionDir, 'package.json')],
    ['render-assistant', existsSync(join(remotionDir, 'scripts', 'render-assistant.mjs')), ''],
    ['Whisper bridge', existsSync(join(remotionDir, 'scripts', 'transcribe-source.mjs')), ''],
    ['VRM validator', existsSync(join(remotionDir, 'scripts', 'ensure-video-vrm.mjs')), ''],
    ['QC extractor', existsSync(join(remotionDir, 'scripts', 'extract-qc-frames.mjs')), ''],
    ['edit-plan schema', existsSync(join(remotionDir, 'assistant-plan.schema.json')), ''],
  ];
  let bad = 0;
  for (const [name, ok, detail] of checks) {
    console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  ${detail}` : ''}`);
    if (!ok) bad++;
  }
  if (bad) fail(`${bad}件の問題があります。`, 2);
  log('環境は使用可能です。');
  process.exit(0);
}

if (command === 'list') {
  for (const name of listProjects()) console.log(name);
  process.exit(0);
}

if (command === 'new') {
  const name = args.find((a) => !a.startsWith('--'));
  if (!name) fail('project名が必要です。例: new mieru-wakaranai');
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) fail('project名は英数字・._-だけにしてください。');
  const project = projectPath(name);
  if (existsSync(project)) fail(`${name} は既に存在します。`);
  mkdirSync(join(project, 'assets'), {recursive: true});
  mkdirSync(join(project, 'out'), {recursive: true});
  writeFileSync(join(project, 'edit-plan.json'), `${JSON.stringify(templatePlan(name), null, 2)}\n`, 'utf8');
  writeFileSync(join(project, 'README.md'), `# ${name}\n\nブイチューバーエンジン project。\n\n- edit-plan.json: 編集指示\n- source.m4a / source.wav / source.opus: 実音声\n- assets/: 固定素材\n- out/: レンダー成果物\n`, 'utf8');
  log(`project作成: ${relative(repoRoot, project)}`);
  process.exit(0);
}

if (command === 'transcribe') {
  const name = resolveProjectName();
  const project = projectPath(name);
  const audio = findAudio(project);
  if (!audio) fail(`${name} に source.m4a / source.wav / source.opus がありません。`);
  const out = join(project, 'out', 'timed-asr');
  mkdirSync(out, {recursive: true});
  run('npm', ['run', 'transcribe', '--', `--audio=${relativeFromRemotion(audio)}`, `--output=${relativeFromRemotion(out)}`], {cwd: remotionDir});
  process.exit(0);
}

if (command === 'render') {
  const name = resolveProjectName();
  const project = projectPath(name);
  const plan = join(project, 'edit-plan.json');
  const audio = findAudio(project);
  if (!existsSync(plan)) fail(`${name} に edit-plan.json がありません。`);
  if (!audio) fail(`${name} に source.m4a / source.wav / source.opus がありません。`);
  const outDir = join(project, 'out');
  const asrDir = join(outDir, 'timed-asr');
  const output = join(outDir, `${name}.mp4`);
  mkdirSync(asrDir, {recursive: true});
  run('npm', ['run', 'render:assistant', '--', `--plan=${relativeFromRemotion(plan)}`, `--audio=${relativeFromRemotion(audio)}`, `--asr-output=${relativeFromRemotion(asrDir)}`, `--output=${relativeFromRemotion(output)}`], {cwd: remotionDir});
  log(`完成: ${relative(repoRoot, output)}`);
  process.exit(0);
}

fail(`不明なcommand: ${command}`);
