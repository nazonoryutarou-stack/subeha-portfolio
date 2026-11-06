#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const cli=join(dirname(fileURLToPath(import.meta.url)),'cli.mjs');
for(const [args,expected] of [[['list'],'video-production-director'],[['check'],'failures=0'],[['help'],'video-studio:']]){
  const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  if(r.status!==0 || !r.stdout.includes(expected)){
    console.error('FAILED',args,r.stdout,r.stderr);process.exit(1);
  }
}
console.log('video-studio smoke tests passed');
