import test from 'node:test';
import assert from 'node:assert/strict';
import {TYPES,JP_TYPES,insideDropZone,removeProjectItem} from '../trash-core.mjs';
import {readableLabel} from '../japanese-ui.mjs';
const baseline=()=>({clips:[{id:'a'},{id:'b'}],overlays:[{id:'c'}],texts:[{id:'d'}],captions:[{id:'e'}],audioTracks:[{id:'f'}],cgScenes:[{id:'g'}]});
test('each edit kind can be moved to the trash without touching unrelated media',()=>{for(const [kind,key] of Object.entries(TYPES)){const project=baseline();const id=project[key][0].id;const removed=removeProjectItem(project,kind,id);assert.equal(removed.removed.id,id);assert.equal(project[key].length,key==='clips'?1:0);assert.ok(JP_TYPES[kind]);}});
test('nonexistent and invalid target do not alter project',()=>{const p=baseline(),before=structuredClone(p);assert.equal(removeProjectItem(p,'clip','missing'),null);assert.equal(removeProjectItem(p,'unknown','a'),null);assert.deepEqual(p,before);});
test('drop zone includes a small touch-friendly margin',()=>{const r={left:100,right:260,top:400,bottom:500};assert.equal(insideDropZone({x:99,y:400},r),true);assert.equal(insideDropZone({x:75,y:400},r),false);assert.equal(insideDropZone({x:200,y:300},r),false);assert.equal(insideDropZone({x:200,y:405},r),true);});
test('visible UI names are Japanese',()=>{assert.equal(readableLabel('オーバーレイ'),'素材を重ねる');assert.equal(readableLabel('クロマキー'),'背景色を消す');assert.equal(readableLabel('IN'),'ここから');});
