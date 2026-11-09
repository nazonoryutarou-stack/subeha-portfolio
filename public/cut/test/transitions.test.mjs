import assert from 'node:assert/strict';
import {spans,transitionAt,totalDuration,locateSpan,TRANSITIONS} from '../transitions.mjs';
import {locate,duration,splitAt} from '../timeline.mjs';
const clips=[
  {id:'a',start:0,end:5,speed:1},
  {id:'b',start:2,end:8,speed:1,transitionIn:{type:'dissolve',duration:1.2}},
  {id:'c',start:0,end:2,speed:1,transitionIn:{type:'wipe-left',duration:1}},
];
assert.equal(spans(clips)[1].start,3.8);
assert.equal(transitionAt(clips,2).duration,.9);
assert.ok(Math.abs(totalDuration(clips)-(5+6+2-1.2-.9))<1e-7);
assert.equal(duration(clips),totalDuration(clips));
let at=locate(clips,4);assert.equal(at.clip.id,'b');assert.equal(at.transition.fromClip.id,'a');
assert.ok(at.transition.progress>0 && at.transition.progress<1);
assert.equal(at.transition.fromMediaTime,4);
assert.ok(Math.abs(at.mediaTime-2.2)<1e-8);
assert.equal(locateSpan(clips,0).clip.id,'a');
assert.equal(locateSpan(clips,100).clip.id,'c');
assert.equal(splitAt(clips,4),null,'no split during two-source overlap');
const cut=splitAt(clips,6);assert.equal(cut.clips.length,4);assert.equal(cut.second.transitionIn.type,'none');
assert.ok(TRANSITIONS.includes('zoom'));
console.log('transition overlap and split: PASS');
