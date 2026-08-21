import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = process.cwd();
const publicDir = path.join(projectRoot, 'public');
const target = path.join(publicDir, 'Subeha.vrm');
fs.mkdirSync(publicDir, {recursive: true});

const envPath = String(process.env.VIDEO_VRM_PATH || '').trim();
const candidates = [
  envPath ? path.resolve(projectRoot, envPath) : null,
  path.resolve(projectRoot, '../../Subeha.vrm'),
  path.resolve(projectRoot, 'inputs/Subeha.vrm'),
].filter(Boolean);

if (!fs.existsSync(target)) {
  const source = candidates.find((candidate) => fs.existsSync(candidate));
  if (!source) {
    console.error('動画用 Subeba.vrm / Subeha.vrm が見つかりません。');
    console.error('口モーフの無い subeha-web-site.vrm へはフォールバックしません。');
    console.error('VIDEO_VRM_PATH を指定するか、remotion/vrm-lipsync/inputs/Subeha.vrm を配置してください。');
    process.exit(1);
  }
  fs.copyFileSync(source, target);
  console.log(`Video VRM copied: ${source} -> ${target}`);
}

const validator = path.resolve(projectRoot, '../../scripts/check-vrm.mjs');
if (!fs.existsSync(validator)) {
  console.error(`VRM validator not found: ${validator}`);
  process.exit(1);
}

const check = spawnSync(process.execPath, [validator, target, '--for', 'video'], {stdio: 'inherit'});
if (check.error) {
  console.error(check.error.message);
  process.exit(1);
}
if (check.status !== 0) {
  console.error('動画用VRM検品に失敗しました。レンダーを中止します。');
  process.exit(check.status ?? 1);
}
