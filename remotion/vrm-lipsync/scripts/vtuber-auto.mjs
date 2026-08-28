import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const repoRoot = path.resolve(root, '..', '..');
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const audioArg = valueArg('audio') || process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const outputArg = valueArg('output');
const sourceLabel = valueArg('source-label');
const directorFixture = valueArg('director-fixture');
const planOnly = process.argv.includes('--plan-only');

if (!audioArg) {
  console.error('Usage: npm run vtuber:auto -- --audio=/path/input.m4a [--output=out/final.mp4] [--source-label="..."] [--plan-only]');
  console.error('       npm run vtuber:auto -- /path/input.m4a');
  process.exit(2);
}

const audioPath = path.resolve(root, audioArg);
if (!fs.existsSync(audioPath) || !fs.statSync(audioPath).isFile()) throw new Error(`audio not found: ${audioPath}`);

const audioSha = sha256(audioPath);
const stem = safeStem(path.basename(audioPath, path.extname(audioPath)));
const runId = `${stem}-${audioSha.slice(0, 12)}`;
const workDir = path.join(root, 'out', 'auto', runId);
const asrDir = path.join(workDir, 'asr');
const planPath = path.join(workDir, 'edit-plan.json');
const outputPath = path.resolve(root, outputArg || path.join('out', `${runId}.mp4`));
const manifestPath = path.join(workDir, 'build-manifest.json');
fs.mkdirSync(workDir, {recursive: true});

runNode('check-golden-contract.mjs');
runNode('transcribe-source.mjs', [`--audio=${audioPath}`, `--output-dir=${asrDir}`]);

const directorArgs = [`--asr-dir=${asrDir}`, `--output-plan=${planPath}`];
if (sourceLabel) directorArgs.push(`--source-label=${sourceLabel}`);
if (directorFixture) directorArgs.push(`--response-fixture=${path.resolve(root, directorFixture)}`);
runNode('auto-director.mjs', directorArgs);
runNode('materialize-director-visuals.mjs', [`--plan=${planPath}`]);

if (planOnly) {
  console.log(JSON.stringify({
    ok: true,
    mode: 'plan-only',
    audio: audioPath,
    audioSha256: audioSha,
    plan: planPath,
    asrDir,
  }, null, 2));
  process.exit(0);
}

runNode('render-assistant.mjs', [
  `--plan=${planPath}`,
  `--audio=${audioPath}`,
  `--asr-output=${asrDir}`,
  `--output=${outputPath}`,
  '--skip-whisper',
]);

if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) throw new Error(`render output missing: ${outputPath}`);
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const directorMetaPath = planPath.replace(/\.json$/i, '') + '.director-meta.json';
const directorMeta = fs.existsSync(directorMetaPath) ? JSON.parse(fs.readFileSync(directorMetaPath, 'utf8')) : null;
const goldenPath = path.join(repoRoot, 'docs', 'vtuber-golden-reference-v1.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
const vrmPath = path.join(repoRoot, 'Subeha.vrm');

const manifest = {
  version: 1,
  pipeline: 'vtuber-auto-v1',
  goldenReference: golden.name,
  goldenOutputSha256: golden.hashes.outputSha256,
  sourceAudio: path.relative(root, audioPath),
  sourceAudioSha256: audioSha,
  sourceDurationMs: probeDurationMs(audioPath),
  selectedClip: plan.clip,
  title: plan.text?.title || '',
  motionProfile: plan.motion?.profile || 'normal',
  visualCount: Array.isArray(plan.visualReferences) ? plan.visualReferences.length : 0,
  director: directorMeta,
  planSha256: sha256(planPath),
  productionVrmSha256: sha256(vrmPath),
  output: path.relative(root, outputPath),
  outputSha256: sha256(outputPath),
  outputBytes: fs.statSync(outputPath).size,
  node: process.version,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log('');
console.log('VTUBER AUTO COMPLETE');
console.log(`Input:    ${audioPath}`);
console.log(`Plan:     ${planPath}`);
console.log(`Output:   ${outputPath}`);
console.log(`Manifest: ${manifestPath}`);
console.log(`SHA256:   ${manifest.outputSha256}`);

function runNode(script, args = []) {
  const scriptPath = path.join(root, 'scripts', script);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.status})`);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function probeDurationMs(file) {
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], {encoding: 'utf8'});
  if (probe.status !== 0) throw new Error(`ffprobe failed for ${file}`);
  const seconds = Number(String(probe.stdout || '').trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`invalid duration for ${file}`);
  return Math.round(seconds * 1000);
}

function safeStem(value) {
  return String(value || 'audio')
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'audio';
}
