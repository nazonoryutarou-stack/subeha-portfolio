import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'public','astra-architecture');
const required=['index.html','style.css','boot.js','main.js','world.js'];
const fail=message=>{console.error(`ASTRA QA: ${message}`);process.exitCode=1;};

for(const name of required){if(!fs.existsSync(path.join(dir,name)))fail(`missing ${name}`);}
if(process.exitCode)process.exit();

const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const main=fs.readFileSync(path.join(dir,'main.js'),'utf8');
const worldSource=fs.readFileSync(path.join(dir,'world.js'),'utf8');

for(const needle of ['ASTRA ARCHITECTURE / 001','祭祀技師事務所','id="joystick"','id="stick"','./boot.js'])if(!html.includes(needle))fail(`index missing ${needle}`);
for(const needle of ["../arcade/vendor/three.module.min.js","../arcade/controls.js","astra-architecture-001-pose"])if(!main.includes(needle))fail(`runtime missing ${needle}`);
for(const needle of ['受付','書類机','祭祀作業場','検品室','保管庫','閉鎖室前'])if(!worldSource.includes(needle))fail(`world missing room ${needle}`);

for(const script of ['boot.js','main.js','world.js']){
  const result=spawnSync(process.execPath,['--check',path.join(dir,script)],{encoding:'utf8'});
  if(result.status!==0)fail(`${script} syntax: ${result.stderr.trim()}`);
}

const localRefs=[...html.matchAll(/(?:src|href)="([^"#?]+)"/g)].map(m=>m[1]).filter(v=>!/^https?:|^data:|^mailto:/.test(v));
for(const ref of localRefs){
  const resolved=path.resolve(dir,ref);
  if(ref.endsWith('/')){if(!fs.existsSync(path.join(resolved,'index.html')))fail(`missing linked index ${ref}`);}
  else if(!fs.existsSync(resolved))fail(`missing local ref ${ref}`);
}

for(const ref of ['../works/','../research/','../archive/','../arcade/']){
  const resolved=path.resolve(dir,ref,'index.html');if(!fs.existsSync(resolved))fail(`world link missing ${ref}`);
}

const world=await import(`${pathToFileURL(path.join(dir,'world.js')).href}?qa=${Date.now()}`);
const {canOccupy,PLAN,ROOMS}=world;
const step=.18,start={x:0,z:9.85};
if(!canOccupy(start.x,start.z))fail('start pose collides');

const key=(x,z)=>`${Math.round(x/step)},${Math.round(z/step)}`;
const queue=[start],seen=new Set([key(start.x,start.z)]),points=[];
while(queue.length){
  const p=queue.shift();points.push(p);
  for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
    const n={x:p.x+dx,z:p.z+dz};
    if(n.x<PLAN.minX||n.x>PLAN.maxX||n.z<PLAN.minZ||n.z>PLAN.maxZ||!canOccupy(n.x,n.z))continue;
    const k=key(n.x,n.z);if(seen.has(k))continue;seen.add(k);queue.push(n);
  }
}

const requiredRooms=['entry','reception','documents','workshop','inspection','archive','rear'];
for(const id of requiredRooms){
  const room=ROOMS.find(r=>r.id===id);const count=points.filter(p=>p.x>=room.x1&&p.x<=room.x2&&p.z>=room.z1&&p.z<=room.z2).length;
  if(count<8)fail(`room ${id} is not meaningfully reachable (${count} grid points)`);
  else console.log(`ASTRA QA: ${id} reachable at ${count} sampled points`);
}
const sealed=ROOMS.find(r=>r.id==='sealed');
const sealedCount=points.filter(p=>p.x>=sealed.x1&&p.x<=sealed.x2&&p.z>=sealed.z1&&p.z<=sealed.z2).length;
if(sealedCount>20)fail(`sealed room unexpectedly reachable (${sealedCount} points)`);

if(points.length<1200)fail(`walkable area suspiciously small (${points.length} points)`);
console.log(`ASTRA QA: ${points.length} reachable points; sealed=${sealedCount}`);
if(process.exitCode)process.exit(process.exitCode);
console.log('ASTRA QA: structural + spatial checks passed');
