import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeShots,splitShot,moveCut,removeShot,findShot,computeEnvelope,amplitudeAt,projectJSON} from '../shots.mjs';

test('default project has one cut, correct start and duration',()=>{
 const x=normalizeShots([],30);assert.equal(x.length,1);assert.equal(x[0].start,0);assert.equal(x[0].end,30);
});
test('cut splitting preserves a contiguous timeline',()=>{
 const x=splitShot(normalizeShots([],40),12,40);
 assert.equal(x.length,2);assert.equal(x[0].end,12);assert.equal(x[1].start,12);assert.equal(x[1].end,40);
 const y=splitShot(x,26,40);assert.equal(y.length,3);assert.equal(y[2].start,26);
 assert.equal(y.reduce((a,c)=>a+c.end-c.start,0),40);
});
test('cut boundary movement clamps inside adjacent shots',()=>{
 const x=splitShot(normalizeShots([],30),10,30);
 const y=moveCut(x,1,21,30);assert.equal(y[0].end,21);assert.equal(y[1].start,21);
 assert.equal(moveCut(x,1,-4,30)[1].start,.1);
});
test('deleting a cut joins the timeline, without deleting the whole project',()=>{
 let x=splitShot(normalizeShots([],30),10,30);x=removeShot(x,0,30);
 assert.equal(x.length,1);assert.equal(x[0].start,0);assert.equal(x[0].end,30);
});
test('findShot maps playback positions to correct cut',()=>{
 const x=splitShot(normalizeShots([],20),6,20);
 assert.equal(findShot(x,5).start,0);assert.equal(findShot(x,6).start,6);
});
test('volume-based mouth envelope is finite and bounded',()=>{
 const x=computeEnvelope(Float32Array.from([0,.8,-.8,.5]),4,.5);
 assert.equal(x.length,2);assert.ok(x.every(n=>Number.isFinite(n)&&n>=0));
 assert.equal(amplitudeAt(x,1,0.5,5)<=1,true);
 assert.equal(amplitudeAt([],1),0);
});
test('JSON stores shot parameters and excludes media',()=>{
 const x=projectJSON(splitShot(normalizeShots([],12),3,12),12);
 assert.equal(x.schema,'vrm-stage/v1');assert.equal(x.shots.length,2);
 assert.equal('media' in x,false);assert.equal('audioBytes' in x,false);
});
