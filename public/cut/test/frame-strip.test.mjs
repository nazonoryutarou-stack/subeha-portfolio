import test from 'node:test';import assert from 'node:assert/strict';
import {frameSampleTimes,frameStripKey} from '../frame-strip.mjs';
test('thumbnail sampling within trimmed clip bounds',()=>{
 assert.deepEqual(frameSampleTimes({start:2,end:8},216),[3,5,7]);
 assert.deepEqual(frameSampleTimes({start:2,end:8,reverse:true},216),[7,5,3]);
});
test('bounded thumbnails for very long clips',()=>{
 const v=frameSampleTimes({start:0,end:300},10000);
 assert.equal(v.length,12);assert.ok(v.every(n=>n>0&&n<300));
});
test('trim and reverse alter thumbnail cache key',()=>{
 const a={start:0,end:5};assert.notEqual(frameStripKey('v',a,300),frameStripKey('v',{...a,reverse:true},300));
 assert.notEqual(frameStripKey('v',a,300),frameStripKey('v',{...a,start:1},300));
});
