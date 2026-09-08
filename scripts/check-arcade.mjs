import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];async function walk(dir){for(const d of await readdir(path.join(root,dir),{withFileTypes:true})){const f=path.posix.join(dir,d.name);if(d.isDirectory())await walk(f);else files.push(f);}}
await walk('arcade');
for(const f of files.filter(f=>f.endsWith('.js'))){const result=spawnSync(process.execPath,['--check',path.join(root,f)],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
assert.equal(await readFile(path.join(root,'arcade/index.html'),'utf8'),await readFile(path.join(root,'arcade/app.html'),'utf8'),'Both entrypoints must expose the same scene and controls');
const shopSource=await readFile(path.join(root,'arcade/shops.js'),'utf8'),worldSource=await readFile(path.join(root,'arcade/world.js'),'utf8');
const targetLinks=[...shopSource.matchAll(/href:'([^']+)'/g),...worldSource.matchAll(/href:'([^']+)'/g)].map(m=>m[1]);
async function exists(f){try{return (await stat(f)).isFile();}catch{return false;}}
for(const link of targetLinks){
  const relative=path.posix.normalize(path.posix.join('arcade',link));
  const file=relative==='.'?'index.html':link.endsWith('/')?relative+'/index.html':relative;
  assert(await exists(path.join(root,file)),`Missing source target: ${link}`);
  assert(await exists(path.join(root,'public',file)),`Missing deployed target: ${link}`);
}
const staged=[];async function walkPublic(dir){for(const d of await readdir(path.join(root,dir),{withFileTypes:true})){const f=path.posix.join(dir,d.name);if(d.isDirectory())await walkPublic(f);else if(/\.(html|css|js)$/.test(f))staged.push(f);}}
for(const dir of ['arcade','imoji-lab','brands/shikigami','products','research','works','contents','diagnosis','contact','tokusho','miharai','archive'])await walkPublic('public/'+dir);
let checked=0;const errors=[];
for(const f of staged){
  if(!f.endsWith('.html'))continue;
  const text=await readFile(path.join(root,f),'utf8');
  for(const match of text.matchAll(/\b(?:href|src)="([^"\n]+)"/g)){
    const url=match[1];if(/^(?:[a-z]+:|#|\/\/)/i.test(url))continue;
    let clean=url.split(/[?#]/)[0];if(!clean)continue;
    let dest=path.resolve(root,path.dirname(f),clean);if(clean.endsWith('/'))dest=path.join(dest,'index.html');
    if(!await exists(dest))errors.push(`${f}: ${url}`);checked++;
  }
}
assert.deepEqual(errors,[],`Broken local deployment links:\n${errors.join('\n')}`);
for(const f of ['arcade/app.html','arcade/index.html','arcade/main.js','arcade/arcade.css'])assert(!/WIP|施工中|改装中/.test(await readFile(path.join(root,f),'utf8')),`Old construction UI in ${f}`);
console.log(`Syntax, identical entries, ${targetLinks.length} physical links and ${checked} deployed local references passed.`);
