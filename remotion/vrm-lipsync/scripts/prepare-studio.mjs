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
run('materialize-visuals.mjs');
console.log('Studio project prepared for deterministic Remotion render.');
