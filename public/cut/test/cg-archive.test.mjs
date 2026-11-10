import assert from 'node:assert/strict';
import {createProjectArchive,readProjectArchive,projectAssetIds} from '../project-archive.mjs';
const project={name:'CG test',ratio:'9:16',clips:[],overlays:[],audioTracks:[],music:null,cgScenes:[{id:'3d-a',modelAssetId:'model-a',name:'orbit',start:0,duration:8,keys:[]}]};
assert.deepEqual(projectAssetIds(project),['model-a']);
const data='v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3';
const assets=new Map([['model-a',{blob:new Blob([data],{type:'text/plain'}),type:'model',name:'sample.obj'}]]);
const zip=await createProjectArchive(project,assets);const ret=await readProjectArchive(zip);
assert.deepEqual(ret.project,project);assert.equal(ret.assets[0].type,'model');assert.equal(await ret.assets[0].blob.text(),data);
console.log('CG archive tests OK');
