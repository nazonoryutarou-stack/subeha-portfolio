import test from 'node:test';import assert from 'node:assert/strict';
import {splitNarration,makeNarrationCues} from '../narration-cues.mjs';
test('Japanese clauses are editable subtitle chunks without dropping words',()=>{
 const text='こんにちは。今日は映像を作ります！よろしくお願いします。';
 const parts=splitNarration(text);assert.equal(parts.join(''),text);
 const cues=makeNarrationCues(text,{start:2,duration:5,idFactory:(()=>{let n=0;return()=>`k${n++}`;})()});
 assert.equal(cues.length,3);assert.equal(cues[0].start,2);assert.ok(cues[2].end<7);
 assert.equal(cues.map(c=>c.text).join(''),text);assert.ok(cues.every((c,i)=>c.end>c.start&&(i===0||c.start>=cues[i-1].end)));
});
test('very short or empty scripts cannot create impossible timing',()=>{
 assert.deepEqual(makeNarrationCues('',{start:1,duration:2}),[]);
 assert.deepEqual(makeNarrationCues('こんにちは',{start:1,duration:0}),[]);
 assert.ok(splitNarration('a'.repeat(80)).every(x=>Array.from(x).length<=19));
});
