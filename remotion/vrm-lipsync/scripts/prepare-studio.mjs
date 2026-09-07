import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const projectRoot = process.cwd();
const scriptsDir = path.join(projectRoot, 'scripts');

const run = (script, args = []) => {
  const result = spawnSync(process.execPath, [path.join(scriptsDir, script), ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('import-studio-project.mjs', process.argv.slice(2));

const clipPath = path.join(projectRoot, 'public', 'clip.json');
const clip = fs.existsSync(clipPath) ? JSON.parse(fs.readFileSync(clipPath, 'utf8')) : {};
const refs = Array.isArray(clip.visualReferences) ? clip.visualReferences : [];
const proceduralKinds = new Set(['typography', 'black']);
const preMaterialized = refs.length > 0 && refs.every((ref) => {
  if (proceduralKinds.has(String(ref?.shotType || ''))) return true;
  if (!ref?.renderFile) return false;
  const resolved = path.resolve(projectRoot, 'public', String(ref.renderFile));
  const publicRoot = path.resolve(projectRoot, 'public') + path.sep;
  return resolved.startsWith(publicRoot) && fs.existsSync(resolved);
});

if (preMaterialized) {
  console.log(`Visual references already materialized/procedural: ${refs.length}`);
} else {
  run('materialize-visuals.mjs');
}
console.log('Studio project prepared for deterministic Remotion render.');
