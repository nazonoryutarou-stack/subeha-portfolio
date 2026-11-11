import assert from 'node:assert/strict';
import {createProjectArchive,readProjectArchive} from '../project-archive.mjs';
const project={name:'Direct Edit',ratio:'9:16',clips:[{id:'clip1',assetId:'base',start:0,end:5,speed:1,grade:{warmth:33},fxStack:[{id:'fx1',type:'ghost',amount:.6,start:.2,keys:[{time:1,amount:.2},{time:2,amount:.9}]}]}],texts:[{id:'t1',text:'HELLO',size:80,x:.6,y:.2,rotation:24}],captions:[{id:'cue1',start:0,end:3,text:'字幕',style:{x:.2,y:.4,rotation:-12,size:65}}],overlays:[]};
const media=new Map([['base',{blob:new Blob([Uint8Array.from([0,1,2,3])],{type:'image/png'}),type:'image',name:'base.png'}]]);
const saved=await createProjectArchive(project,media),loaded=await readProjectArchive(saved);
assert.equal(loaded.project.captions[0].style.rotation,-12);assert.equal(loaded.project.texts[0].rotation,24);assert.equal(loaded.project.clips[0].fxStack[0].keys[1].amount,.9);
assert.equal(loaded.assets.length,1);
console.log('v1.4 direct editor project save/restore PASS');
