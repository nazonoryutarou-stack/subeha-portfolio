import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeDucking,duckingFactor,trackDuckingFactor} from '../audio-ducking.mjs';
const tracks=[{role:'music',start:0,duration:10,volume:.7},{role:'voice',start:2,duration:3,volume:1}];
test('background music falls under voice and recovers after narration',()=>{
 const cfg={enabled:true,level:.2,attack:.2,release:.5};
 assert.equal(duckingFactor(1,tracks,cfg),1);
 assert.ok(Math.abs(duckingFactor(2.2,tracks,cfg)-.2)<1e-8);
 assert.ok(Math.abs(duckingFactor(3,tracks,cfg)-.2)<1e-8);
 assert.equal(duckingFactor(5.5,tracks,cfg),1);
 assert.equal(trackDuckingFactor(tracks[1],3,tracks,cfg),1);
 assert.equal(trackDuckingFactor({role:'effect'},3,tracks,cfg),1);
});
test('muted narration does not duck; config is clamped',()=>{
 const cfg=normalizeDucking({enabled:true,level:-2,attack:0,release:999});
 assert.equal(cfg.level,.05);assert.equal(cfg.release,5);
 assert.equal(duckingFactor(3,[{role:'voice',start:2,duration:3,muted:true}],cfg),1);
 assert.equal(duckingFactor(3,tracks,{enabled:false}),1);
});
