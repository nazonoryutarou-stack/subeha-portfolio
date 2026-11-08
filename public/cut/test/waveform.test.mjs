import assert from 'node:assert/strict';
import {samplePeaks,drawPeaks} from '../waveform.mjs';
assert.deepEqual(samplePeaks([0,.25,.5,0,.7,1,0,0],2),[.5,1]);
assert.deepEqual(samplePeaks([],4),[]);
const called=[];drawPeaks({clearRect(){},fillRect(...a){called.push(a)},set fillStyle(v){}},[.3,.8],100,40);
assert.equal(called.length,2);assert.ok(called[1][3]>called[0][3]);
console.log('waveform tests PASS');
