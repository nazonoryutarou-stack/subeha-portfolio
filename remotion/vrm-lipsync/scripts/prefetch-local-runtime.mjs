import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {downloadWhisperModel, installWhisperCpp} from '@remotion/install-whisper-cpp';

const root = process.cwd();
const whisperCppVersion = process.env.WHISPER_CPP_VERSION || '1.5.5';
const model = process.env.WHISPER_MODEL || 'small';
const cacheDir = path.join(root, '.cache', 'whisper-align');
const whisperDir = path.join(cacheDir, `whisper.cpp-${whisperCppVersion}`);
const repoRoot = path.resolve(root, '..', '..');
const vrmPath = path.join(repoRoot, 'Subeha.vrm');

if (!fs.existsSync(vrmPath)) throw new Error(`Production VRM missing: ${vrmPath}`);
fs.mkdirSync(cacheDir, {recursive: true});

await installWhisperCpp({to: whisperDir, version: whisperCppVersion});
await downloadWhisperModel({model, folder: whisperDir});

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = {
  version: 1,
  purpose: 'portable-local-vtuber-runtime',
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  whisperCppVersion,
  whisperModel: model,
  whisperDir: path.relative(root, whisperDir),
  productionVrm: '../../Subeha.vrm',
  productionVrmSha256: sha256(vrmPath),
  packageJsonSha256: sha256(path.join(root, 'package.json')),
  gitSha: process.env.GITHUB_SHA || null,
};

try {
  manifest.npmVersion = execFileSync('npm', ['--version'], {encoding: 'utf8'}).trim();
} catch {
  manifest.npmVersion = null;
}

fs.writeFileSync(path.join(root, 'local-runtime-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
