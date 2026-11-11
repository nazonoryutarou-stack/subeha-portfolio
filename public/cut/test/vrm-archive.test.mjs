import test from 'node:test';import assert from 'node:assert/strict';
import {createProjectArchive,readProjectArchive} from '../project-archive.mjs';
test('VRM model permissions and voice credits survive media-inclusive project archive',async()=>{
 const project={name:'VRM & narration',clips:[],texts:[],audioTracks:[{id:'aud',assetId:'a1',start:0,duration:1}],cgScenes:[{id:'scene',modelAssetId:'m1',name:'head.vrm',start:0,duration:5,modelRights:{religious:'不可',commercial:'個人の非営利利用のみ'}}],voiceCredits:[{assetId:'a1',provider:'VOICEVOX',credit:'VOICEVOX:ずんだもん'}]};
 const assets=new Map([['a1',{name:'v.wav',type:'audio',blob:new Blob(['RIFFTEST'],{type:'audio/wav'})}],['m1',{name:'head.vrm',type:'model',blob:new Blob([new Uint8Array([1,2,3])],{type:'application/octet-stream'})}]]);
 const packed=await createProjectArchive(project,assets),restored=await readProjectArchive(packed);
 assert.deepEqual(restored.project,project);assert.equal(restored.assets.length,2);
});
