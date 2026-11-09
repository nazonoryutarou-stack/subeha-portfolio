import assert from 'node:assert/strict';
import {locate} from '../timeline.mjs';
const clips=[{id:'r',start:1,end:5,speed:1,reverse:true}];
assert.equal(locate(clips,0).mediaTime,5);
assert.equal(locate(clips,2).mediaTime,3);
assert.ok(locate(clips,3.999).mediaTime>1);
console.log('reverse time mapping: PASS');
