import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RAMP_PRESETS,makeSpeedRamp,rampDuration,rampMediaTime,rampPlaybackRate,rampPositionAtLocal,cutSpeedRamp} from '../speed-ramp.mjs';
import {TRANSITIONS,clipSeconds,spans,locateSpan} from '../transitions.mjs';
import {splitAt} from '../timeline.mjs';
import {drawIncomingTransition,outgoingTransitionAlpha} from '../transition-visuals.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const nearly=(a,b,epsilon=1e-7)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
test('source-to-project mapping integrates nonuniform speed exactly',()=>{
 const c={id:'c1',start:3,end:13,speed:1,speedRamp:makeSpeedRamp('hero')};
 const total=rampDuration(c);assert.ok(total>10);
 for(let i=0;i<=20;i++){
  const t=total*i/20,pos=rampPositionAtLocal(c,t);
  assert.ok(pos>=0&&pos<=1);
  nearly(rampMediaTime(c,t),3+10*pos);
  assert.ok(rampPlaybackRate(c,t)>=.25);
 }
 nearly(clipSeconds(c),total);
 nearly(rampMediaTime({...c,reverse:true},0),13);
 nearly(rampMediaTime({...c,reverse:true},total),3);
});
test('all 15 original preset curves have positive rate and duration',()=>{
 assert.equal(Object.keys(RAMP_PRESETS).length,15);
 for(const preset of Object.keys(RAMP_PRESETS)){
  const clip={start:0,end:12,speed:1,speedRamp:makeSpeedRamp(preset)};
  assert.ok(rampDuration(clip)>0,preset);
  assert.ok(rampPlaybackRate(clip,rampDuration(clip)*.25)>0,preset);
  nearly(rampMediaTime(clip,rampDuration(clip)),12);
 }
});
test('legacy constant speed clips still have original duration/time',()=>{
 const c={start:1,end:7,speed:2};
 nearly(rampDuration(c),3);
 nearly(rampMediaTime(c,1.5),4);
 nearly(rampDuration({...c,reverse:true}),3);
});
test('splitting a speed ramp preserves combined duration and local curves',()=>{
 for(const reverse of [false,true]){
  const clip={id:'clip',assetId:'a',start:0,end:10,speed:1.2,reverse,speedRamp:makeSpeedRamp('swing')};
  const total=rampDuration(clip),seconds=total*.39,cut=rampMediaTime(clip,seconds);
  const result=splitAt([clip],seconds);assert.ok(result);
  nearly(rampDuration(result.first),seconds,1e-6);
  nearly(rampDuration(result.first)+rampDuration(result.second),total,1e-6);
  nearly(result.first.reverse?result.first.start:result.first.end,cut,1e-7);
 }
});
test('overlap transition uses nonlinear incoming and outgoing media source time',()=>{
 const clips=[{id:'A',start:0,end:10,speedRamp:makeSpeedRamp('hero')},{id:'B',start:0,end:8,speedRamp:makeSpeedRamp('bullet'),transitionIn:{type:'wipe-up',duration:.7}}];
 const items=spans(clips);const t=items[1].start+.2,at=locateSpan(clips,t);
 assert.equal(at.clip.id,'B');assert.equal(at.transition.type,'wipe-up');
 nearly(at.mediaTime,rampMediaTime(clips[1],.2));
 nearly(at.transition.fromMediaTime,rampMediaTime(clips[0],t));
});
test('transition list includes legacy types and extended original effects',()=>{
 assert.equal(TRANSITIONS.length,20);
 for(const type of ['dissolve','fade','wipe-left','wipe-right','slide-left','zoom','iris-in','iris-out','flash','roll-left','roll-right'])assert.ok(TRANSITIONS.includes(type));
});
test('all supported transitions run in same Canvas2D draw callback with balanced save/restore',()=>{
 const ctx={
  depth:0,flashes:0,save(){this.depth++},restore(){this.depth--},
  beginPath(){},rect(){},clip(){},translate(){},scale(){},rotate(){},arc(){},moveTo(){},setTransform(){},
  fillRect(){this.flashes++}
 };
 const canvas={width:720,height:1280};
 for(const type of TRANSITIONS){
  let renders=0,alpha=-1;
  for(const p of [0,.5,1]){
   drawIncomingTransition(ctx,canvas,type,p,a=>{renders++;alpha=a;});
   assert.equal(ctx.depth,0,type);
   assert.ok(alpha>=0&&alpha<=1,type);
  }
  assert.ok(renders>=1,type);
 }
 assert.ok(ctx.flashes>0);
 nearly(outgoingTransitionAlpha('fade',.5),0);
});
test('production modules are linked to both video preview and export path',()=>{
 const app=readFileSync(resolve(root,'app.mjs'),'utf8');
 const editor=readFileSync(resolve(root,'editor-shell.mjs'),'utf8');
 const sw=readFileSync(resolve(root,'sw.js'),'utf8');
 assert.match(app,/drawIncomingTransition\(ctx,canvas/);
 assert.match(app,/media\.playbackRate=safePlaybackRate/);
 assert.match(editor,/makeSpeedRamp\(key\)/);
 assert.match(sw,/speed-ramp\.mjs/);
 assert.match(sw,/transition-visuals\.mjs/);
});
