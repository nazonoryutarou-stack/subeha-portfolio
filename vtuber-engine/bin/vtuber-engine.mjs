#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const engineDir = resolve(here, '..');
const repoRoot = resolve(engineDir, '..');
const remotionDir = join(repoRoot, 'remotion', 'vrm-lipsync');
const remotionPublic = join(remotionDir, 'public');
const projectsDir = join(engineDir, 'projects');
const filmSchema = join(engineDir, 'film-plan.schema.json');

const args = process.argv.slice(2);
const command = args.shift() || 'help';

const log = (...xs) => console.log('[ブイチューバーエンジン]', ...xs);
const fail = (message, code = 1) => {
  console.error(`[ブイチューバーエンジン] ${message}`);
  process.exit(code);
};

const run = (cmd, cmdArgs, options = {}) => {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: options.cwd || repoRoot,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
    env: {...process.env, ...(options.env || {})},
    shell: process.platform === 'win32',
  });
  if (result.error) fail(`${cmd} を起動できません: ${result.error.message}`);
  if (result.status !== 0) {
    if (options.capture) fail(`${cmd} ${cmdArgs.join(' ')} failed (${result.status})`);
    process.exit(result.status ?? 1);
  }
  return options.capture ? String(result.stdout || '') : '';
};

const commandExists = (cmd) => {
  const probe = spawnSync(cmd, ['-version'], {stdio: 'ignore', shell: process.platform === 'win32'});
  return !probe.error && probe.status === 0;
};

const flagValue = (name) => {
  const prefix = `--${name}=`;
  const value = args.find((a) => a.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
};

const projectPath = (name) => join(projectsDir, name);

const listProjects = () => {
  if (!existsSync(projectsDir)) return [];
  return readdirSync(projectsDir, {withFileTypes: true})
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
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
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const audioDurationMs = (audio) => {
  const raw = run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', audio,
  ], {capture: true});
  const value = Math.round(Number(raw.trim()) * 1000);
  if (!Number.isFinite(value) || value < 1) fail(`音声長を取得できません: ${audio}`);
  return value;
};

const templateFilmPlan = (title = '') => ({
  version: 1,
  title,
  sourceLabel: 'ブイチューバーエンジン',
  selection: {reason: '', hook: '', summary: ''},
  layout: {width: 1280, height: 720, captionBottomPx: 34, background: '#111318'},
  captions: [
    {startMs: 0, endMs: 1000, speaker: 'HOST', text: '字幕をここへ', speakerConfidence: 1},
  ],
  shots: [
    {type: 'vrm', startMs: 0, endMs: 1000},
  ],
  motion: {profile: 'normal', notes: ''},
});

const assertIntRange = (value, label, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    fail(`${label} が不正です: ${value}`);
  }
};

const stageAsset = (projectName, project, asset) => {
  const assetText = String(asset || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!assetText) fail('shot.asset が空です。');
  const assetsRoot = resolve(project, 'assets');
  const source = resolve(assetsRoot, assetText);
  if (source !== assetsRoot && !source.startsWith(`${assetsRoot}${sep}`)) {
    fail(`assets/ 外は参照できません: ${assetText}`);
  }
  if (!existsSync(source)) fail(`素材がありません: ${relative(repoRoot, source)}`);

  const stageRoot = resolve(remotionPublic, 'engine', projectName);
  const destination = resolve(stageRoot, assetText);
  if (destination !== stageRoot && !destination.startsWith(`${stageRoot}${sep}`)) {
    fail(`不正なasset pathです: ${assetText}`);
  }
  mkdirSync(dirname(destination), {recursive: true});
  copyFileSync(source, destination);
  return relative(remotionPublic, destination).replaceAll('\\', '/');
};

const compileFilmPlan = (name, {write = true, stage = true} = {}) => {
  const project = projectPath(name);
  const planPath = join(project, 'film-plan.json');
  const audio = findAudio(project);
  if (!existsSync(planPath)) fail(`${name} に film-plan.json がありません。`);
  if (!audio) fail(`${name} に source.m4a / source.wav / source.opus がありません。`);

  const film = readJson(planPath);
  if (film?.version !== 1) fail(`未対応のfilm-plan versionです: ${film?.version}`);
  if (!Array.isArray(film.captions) || film.captions.length < 1) fail('film-plan.json にcaptionsが必要です。');
  if (!Array.isArray(film.shots) || film.shots.length < 1) fail('film-plan.json にshotsが必要です。');

  const durationMs = audioDurationMs(audio);
  const width = Number(film?.layout?.width || 1280);
  const height = Number(film?.layout?.height || 720);
  const supported = new Set(['720x1280', '900x900', '1280x720']);
  if (!supported.has(`${width}x${height}`)) fail(`未対応の出力サイズです: ${width}x${height}`);

  const allowedSpeakers = new Set(['HOST', 'GUEST', 'UNKNOWN']);
  const captions = film.captions.map((caption, index) => {
    const startMs = Number(caption?.startMs);
    const endMs = Number(caption?.endMs);
    const speaker = String(caption?.speaker || 'UNKNOWN').toUpperCase();
    const text = String(caption?.text || '').trim();
    assertIntRange(startMs, `caption ${index}.startMs`, 0, durationMs);
    assertIntRange(endMs, `caption ${index}.endMs`, 1, durationMs);
    if (endMs <= startMs) fail(`caption ${index} のendMsはstartMsより後にしてください。`);
    if (!allowedSpeakers.has(speaker)) fail(`caption ${index} のspeakerが不正です: ${speaker}`);
    if (!text) fail(`caption ${index} のtextが空です。`);
    return {
      startMs,
      endMs,
      speaker,
      text,
      speakerConfidence: caption?.speakerConfidence == null ? undefined : Number(caption.speakerConfidence),
      speakerReason: caption?.speakerReason == null ? undefined : String(caption.speakerReason),
    };
  }).sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  if (!captions.some((caption) => caption.speaker === 'HOST')) fail('film-plan.json にHOST発話がありません。');

  const allowedShots = new Set(['vrm', 'still', 'video', 'generated-video', 'typography', 'black']);
  const sortedShots = film.shots.map((shot, index) => ({...shot, __index: index}))
    .sort((a, b) => Number(a.startMs) - Number(b.startMs) || Number(a.endMs) - Number(b.endMs));
  let previousEnd = 0;
  const visualReferences = [];

  if (stage) {
    rmSync(resolve(remotionPublic, 'engine', name), {recursive: true, force: true});
  }

  for (let order = 0; order < sortedShots.length; order++) {
    const shot = sortedShots[order];
    const type = String(shot?.type || '');
    const startMs = Number(shot?.startMs);
    const endMs = Number(shot?.endMs);
    if (!allowedShots.has(type)) fail(`shot ${shot.__index} のtypeが不正です: ${type}`);
    assertIntRange(startMs, `shot ${shot.__index}.startMs`, 0, durationMs);
    assertIntRange(endMs, `shot ${shot.__index}.endMs`, 1, durationMs);
    if (endMs <= startMs) fail(`shot ${shot.__index} のendMsはstartMsより後にしてください。`);
    if (startMs < previousEnd) fail(`shotsが重複しています: ${startMs}ms < ${previousEnd}ms`);
    previousEnd = endMs;

    if (type === 'vrm') continue;
    const needsAsset = type === 'still' || type === 'video' || type === 'generated-video';
    const renderFile = needsAsset
      ? (stage ? stageAsset(name, project, shot.asset) : String(shot.asset || ''))
      : null;
    if (needsAsset && !shot.asset) fail(`shot ${shot.__index} (${type}) にassetが必要です。`);
    if (type === 'typography' && !String(shot.text || shot.title || '').trim()) {
      fail(`shot ${shot.__index} (typography) にtextまたはtitleが必要です。`);
    }

    visualReferences.push({
      id: `film-shot-${String(order + 1).padStart(3, '0')}`,
      kind: 'repo',
      startMs,
      endMs,
      title: String(shot.title || shot.label || '').trim() || null,
      renderFile,
      shotType: type,
      mediaType: type === 'video' || type === 'generated-video' ? 'video' : (type === 'still' ? 'image' : 'procedural'),
      placement: String(shot.placement || (type === 'still' ? 'fullscreen' : 'fullscreen')),
      fit: String(shot.fit || (shot.placement === 'panel' ? 'contain' : 'cover')),
      text: String(shot.text || '').trim() || null,
      trimStartMs: Math.max(0, Number(shot.trimStartMs || 0)),
      generated: type === 'generated-video',
    });
  }

  const editPlan = {
    version: 1,
    sourceLabel: String(film.sourceLabel || 'ブイチューバーエンジン'),
    selection: {
      reason: String(film?.selection?.reason || ''),
      hook: String(film?.selection?.hook || ''),
      summary: String(film?.selection?.summary || ''),
    },
    clip: {startMs: 0, endMs: durationMs},
    layout: {
      width,
      height,
      captionBottomPx: Number(film?.layout?.captionBottomPx ?? (height === 1280 ? 290 : Math.round(height * 0.07))),
      background: String(film?.layout?.background || '#111318'),
    },
    text: {title: String(film.title || ''), telop: ''},
    captions,
    visualReferences,
    motion: {
      profile: String(film?.motion?.profile || 'normal'),
      notes: String(film?.motion?.notes || ''),
    },
  };

  const out = join(project, 'out', 'generated-edit-plan.json');
  if (write) {
    mkdirSync(dirname(out), {recursive: true});
    writeFileSync(out, `${JSON.stringify(editPlan, null, 2)}\n`, 'utf8');
  }
  return {editPlan, out, audio, durationMs, shots: sortedShots.length, overlays: visualReferences.length};
};

const help = () => {
  console.log(`\nブイチューバーエンジン\n\n使い方:\n  node vtuber-engine/bin/vtuber-engine.mjs doctor\n  node vtuber-engine/bin/vtuber-engine.mjs new <project>\n  node vtuber-engine/bin/vtuber-engine.mjs validate <project>\n  node vtuber-engine/bin/vtuber-engine.mjs plan <project>\n  node vtuber-engine/bin/vtuber-engine.mjs transcribe <project>\n  node vtuber-engine/bin/vtuber-engine.mjs render <project>\n  node vtuber-engine/bin/vtuber-engine.mjs list\n\nproject構成:\n  vtuber-engine/projects/<project>/film-plan.json\n  vtuber-engine/projects/<project>/source.m4a|wav|opus\n  vtuber-engine/projects/<project>/assets/\n  vtuber-engine/projects/<project>/out/\n\n互換:\n  film-plan.json がない既存projectは edit-plan.json をそのままrenderできます。\n`);
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
    ['legacy edit-plan schema', existsSync(join(remotionDir, 'assistant-plan.schema.json')), ''],
    ['film-plan schema', existsSync(filmSchema), filmSchema],
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
  const template = flagValue('template') || 'default';
  const film = templateFilmPlan(name);
  if (template === 'ritual-pv') {
    film.selection.reason = '世界観を説明しすぎず、問いと物質と記録で導入する。';
    film.motion.profile = 'calm';
  }
  writeFileSync(join(project, 'film-plan.json'), `${JSON.stringify(film, null, 2)}\n`, 'utf8');
  writeFileSync(join(project, 'README.md'), `# ${name}\n\nブイチューバーエンジン project。\n\n- film-plan.json: shot単位の編集指示\n- source.m4a / source.wav / source.opus: 実音声\n- assets/: 静止画・動画などの固定素材\n- out/generated-edit-plan.json: 自動生成される下位互換plan\n- out/: レンダー成果物\n`, 'utf8');
  log(`project作成: ${relative(repoRoot, project)} / template=${template}`);
  process.exit(0);
}

if (command === 'validate') {
  const name = resolveProjectName();
  const project = projectPath(name);
  if (existsSync(join(project, 'film-plan.json'))) {
    const result = compileFilmPlan(name, {write: false, stage: false});
    log(`film-plan OK: ${name} / ${result.durationMs}ms / shots=${result.shots} / overlays=${result.overlays}`);
  } else if (existsSync(join(project, 'edit-plan.json'))) {
    const audio = findAudio(project);
    if (!audio) fail(`${name} に音声がありません。`);
    readJson(join(project, 'edit-plan.json'));
    log(`legacy edit-plan JSON OK: ${name}`);
  } else {
    fail(`${name} に film-plan.json / edit-plan.json がありません。`);
  }
  process.exit(0);
}

if (command === 'plan') {
  const name = resolveProjectName();
  const result = compileFilmPlan(name, {write: true, stage: true});
  log(`編集計画生成: ${relative(repoRoot, result.out)} / shots=${result.shots}`);
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
  const audio = findAudio(project);
  if (!audio) fail(`${name} に source.m4a / source.wav / source.opus がありません。`);

  let plan = join(project, 'edit-plan.json');
  if (existsSync(join(project, 'film-plan.json'))) {
    const compiled = compileFilmPlan(name, {write: true, stage: true});
    plan = compiled.out;
    log(`film-plan → edit-plan: shots=${compiled.shots} / overlays=${compiled.overlays}`);
  }
  if (!existsSync(plan)) fail(`${name} に film-plan.json / edit-plan.json がありません。`);

  const outDir = join(project, 'out');
  const asrDir = join(outDir, 'timed-asr');
  const output = join(outDir, `${name}.mp4`);
  mkdirSync(asrDir, {recursive: true});
  run('npm', ['run', 'render:assistant', '--', `--plan=${relativeFromRemotion(plan)}`, `--audio=${relativeFromRemotion(audio)}`, `--asr-output=${relativeFromRemotion(asrDir)}`, `--output=${relativeFromRemotion(output)}`], {cwd: remotionDir});
  log(`完成: ${relative(repoRoot, output)}`);
  process.exit(0);
}

fail(`不明なcommand: ${command}`);
