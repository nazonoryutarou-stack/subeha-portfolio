import test from 'node:test';import assert from 'node:assert/strict';
import {PIP_PRESETS,applyPipPreset,normalizePipStyle,drawPipFrame} from '../pip-style.mjs';
test('PIP positioning presets are non-destructive and in bounds',()=>{
 const orig={id:'a',x:.5,y:.5,scale:.48,pipStyle:{borderColor:'#ff0000'}};
 for(const key of Object.keys(PIP_PRESETS)){
  const next=applyPipPreset(orig,key);assert.equal(orig.x,.5);assert.equal(next.id,'a');
  assert.ok(next.x>0&&next.x<1&&next.y>0&&next.y<1);
  assert.equal(next.pipStyle.borderColor,'#ff0000');
 }
});
test('PIP styles clamp malformed data',()=>{
 const c=normalizePipStyle({radius:99,border:-5,shadow:'bad',borderColor:'not-a-color'});
 assert.equal(c.radius,.3);assert.equal(c.border,0);assert.equal(c.shadow,0);assert.equal(c.borderColor,'#ffffff');
});
test('PIP renderer clips image and frames it',()=>{
 const calls=[];const ctx={save(){calls.push('save')},restore(){calls.push('restore')},beginPath(){},rect(){},clip(){calls.push('clip')},drawImage(){calls.push('draw')},stroke(){calls.push('stroke')},fill(){calls.push('fill')}};
 drawPipFrame(ctx,{},200,100,{radius:.04,border:.004,shadow:.01},720);
 assert.ok(calls.includes('clip'));assert.ok(calls.includes('draw'));assert.ok(calls.includes('stroke'));assert.ok(calls.includes('fill'));
});
