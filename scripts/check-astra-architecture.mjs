import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'public','astra-architecture');
const required=['index.html','style.css','boot.js','main.js','world-v2.js'];
const fail=message=>{console.error(`ASTRA QA: ${message}`);process.exitCode=1;};

for(const name of required){if(!fs.existsSync(path.join(dir,name)))fail(`missing ${name}`);}
if(process.exitCode)process.exit();

const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const main=fs.readFileSync(path.join(dir,'main.js'),'utf8');
const worldSource=fs.readFileSync(path.join(dir,'world-v2.js'),'utf8');
for(const needle of ['ASTRA ARCHITECTURE / 001','祭祀技師事務所','id="joystick"','id="stick"','./boot.js'])if(!html.includes(needle))fail(`index missing ${needle}`);
for(const needle of ["../arcade/vendor/three.module.min.js","../arcade/controls.js","./world-v2.js","astra-architecture-001-pose"])if(!main.includes(needle))fail(`runtime missing ${needle}`);
for(const needle of ['受付','書類机','祭祀作業場','検品室','保管庫','閉鎖室前','閉鎖室'])if(!worldSource.includes(needle))fail(`world missing room ${needle}`);

for(const script of ['boot.js','main.js','world-v2.js']){
  const result=spawnSync(process.execPath,['--check',path.join(dir,script)],{encoding:'utf8'});
  if(result.status!==0)fail(`${script} syntax: ${result.stderr.trim()}`);
}

const localRefs=[...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map(m=>m[1]).filter(v=>!/^https?:|^data:|^mailto:/.test(v));
for(const ref of localRefs){const resolved=path.resolve(dir,ref);if(ref.endsWith('/')){if(!fs.existsSync(path.join(resolved,'index.html')))fail(`missing linked index ${ref}`);}else if(!fs.existsSync(resolved))fail(`missing local ref ${ref}`);}
for(const ref of ['../works/index.html','../research/index.html','../archive/neocities/fudasho-observation-091.html','../arcade/index.html'])if(!fs.existsSync(path.resolve(dir,ref)))fail(`world link missing ${ref}`);

const world=await import(`${pathToFileURL(path.join(dir,'world-v2.js')).href}?qa=${Date.now()}`);
const {canOccupy,PLAN,ROOMS}=world;const step=.18,start={x:0,z:9.85};if(!canOccupy(start.x,start.z))fail('start pose collides');
const key=(x,z)=>`${Math.round(x/step)},${Math.round(z/step)}`;const queue=[start],seen=new Set([key(start.x,start.z)]),points=[];
while(queue.length){const p=queue.shift();points.push(p);for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){const n={x:p.x+dx,z:p.z+dz};if(n.x<PLAN.minX||n.x>PLAN.maxX||n.z<PLAN.minZ||n.z>PLAN.maxZ||!canOccupy(n.x,n.z))continue;const k=key(n.x,n.z);if(seen.has(k))continue;seen.add(k);queue.push(n);}}

const countRoom=id=>{const room=ROOMS.find(r=>r.id===id);return points.filter(p=>p.x>=room.x1&&p.x<=room.x2&&p.z>=room.z1&&p.z<=room.z2).length;};
for(const id of ['entry','reception','documents','workshop','inspection','archive','sealed-front','rear']){const count=countRoom(id);if(count<18)fail(`room ${id} is not meaningfully reachable (${count} grid points)`);else console.log(`ASTRA QA: ${id} reachable at ${count} sampled points`);}
const sealedInner=countRoom('sealed-inner');if(sealedInner!==0)fail(`sealed inner room is reachable (${sealedInner} points)`);
if(points.length<1400)fail(`walkable area suspiciously small (${points.length} points)`);
console.log(`ASTRA QA: ${points.length} reachable points; sealed-inner=${sealedInner}`);
if(process.exitCode)process.exit(process.exitCode);console.log('ASTRA QA: structural + spatial checks passed');
