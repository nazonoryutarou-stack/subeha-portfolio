import test from 'node:test';import assert from 'node:assert/strict';
import {MAGIC_MODES,magicEdit} from '../magic-edit.mjs';
test('one-tap montages use overlap within safe boundaries without mutating source',()=>{
 const p={clips:[{id:'a',start:0,end:4,speed:1,filter:'none'},{id:'b',start:0,end:2,speed:2,transitionIn:null},{id:'c',start:0,end:1,speed:1}],texts:[{id:'title'}],audioTracks:[{id:'song'}]};
 for(const mode of Object.keys(MAGIC_MODES)){
  const out=magicEdit(p,mode);assert.equal(p.clips[0].filter,'none');assert.equal(p.clips[1].transitionIn,null);
  assert.equal(out.clips[0].transitionIn,undefined);assert.ok(out.clips[1].transitionIn.duration<=.4);
  assert.equal(out.audioTracks.length,1);assert.equal(out.texts.length,1);
  assert.equal(out.clips[1].filter,MAGIC_MODES[mode].filter);
 }
});
test('magic edit rejects invalid or empty projects',()=>{assert.throws(()=>magicEdit({clips:[]},'film'));assert.throws(()=>magicEdit({clips:[{}]},'bogus'));});
