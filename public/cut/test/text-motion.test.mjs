import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TEXT_MOTION_TYPES,TEXT_MOTION_UNITS,TEXT_MOTION_EASINGS,easing,titleAt,upsertTitleKeyframe,motionState,normalizedTextMotion} from '../text-motion-core.mjs';
import {drawAnimatedTitle} from '../text-motion-render.mjs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const folder=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function makeCanvas(){
 const rows=[],ctx={
  globalAlpha:1,filter:'none',save(){this.saved??=[];this.saved.push([this.globalAlpha,this.filter]);},
  restore(){const [a,f]=this.saved.pop();this.globalAlpha=a;this.filter=f;},measureText(s){return {width:Array.from(String(s)).length*13}},
  fillText(s){rows.push({text:String(s),alpha:this.globalAlpha});},strokeText(){},translate(){},rotate(){},scale(){},beginPath(){},rect(){},roundRect(){},fill(){}
 };
 return {ctx,rows,canvas:{width:720,height:1280}};
}
test('original grouped animation supports glyph/word/line/global and 13 effects',()=>{
 assert.equal(TEXT_MOTION_TYPES.length,13);assert.equal(TEXT_MOTION_UNITS.length,4);assert.equal(TEXT_MOTION_EASINGS.length,8);
 for(const unit of TEXT_MOTION_UNITS){
  const {ctx,rows,canvas}=makeCanvas();
  drawAnimatedTitle(ctx,canvas,{text:'空が 青い\nHello world',x:.5,y:.5,size:64,duration:3,textMotion:{type:'slide',unit,duration:.8}},2);
  assert.ok(rows.length>0,unit);
  assert.equal(ctx.saved.length,0);
 }
});
test('typewriter reveals progressively and old titles still render',()=>{
 let setup=makeCanvas(),base={text:'未来',size:62,duration:3};
 drawAnimatedTitle(setup.ctx,setup.canvas,{...base,textMotion:{type:'typewriter',unit:'glyph',duration:1}},0);
 assert.equal(setup.rows.length,0);
 setup=makeCanvas();drawAnimatedTitle(setup.ctx,setup.canvas,{...base,textMotion:{type:'typewriter',unit:'glyph',duration:1}},2);
 assert.ok(setup.rows.length>=2);
 setup=makeCanvas();drawAnimatedTitle(setup.ctx,setup.canvas,{...base,motion:'fade'},1);
 assert.ok(setup.rows.length>0);
});
test('keyframes interpolate local seconds with seven easings and color',()=>{
 const p={x:.2,color:'#000000',titleKeyframes:[{time:0,x:.2,color:'#000000'},{time:2,x:.8,color:'#ffffff'}]};
 assert.equal(Math.round(titleAt(p,1).x*100),50);
 assert.equal(titleAt(p,1).color,'#808080');
 assert.equal(titleAt({...p,titleEasing:'quadInOut'},.5).x,.275);
 for(const ease of TEXT_MOTION_EASINGS){
  assert.equal(easing(ease,0),0);
  assert.equal(easing(ease,1),1);
  assert.ok(Number.isFinite(easing(ease,.3)));
 }
});
test('keyframe edits persist as plain project JSON and do not mutate source',()=>{
 const a={text:'文字',size:60,start:2,duration:3,x:.5};
 const rows=upsertTitleKeyframe(a,1.2345,{x:.8,color:'#ff0000'});
 assert.equal(a.titleKeyframes,undefined);
 assert.equal(rows[0].time,1.235);
 const b={...a,titleKeyframes:rows,textMotion:normalizedTextMotion({type:'wave',unit:'line'})};
 assert.equal(JSON.parse(JSON.stringify(b)).titleKeyframes[0].x,.8);
 assert.equal(titleAt(b,2).x,.8);
});
test('motion time state is deterministic for timeline seek and export',()=>{
 const p={type:'fade',unit:'glyph',duration:.8,stagger:.04};
 assert.deepEqual(motionState(p,.42,3,2,7),motionState(p,.42,3,2,7));
 assert.equal(motionState(p,2,3,2,7).alpha,1);
 assert.equal(motionState(p,0,3,0,7).alpha,0);
});
test('canvas render hook and touch editor are wired to shared title animation',()=>{
 const app=readFileSync(resolve(folder,'app.mjs'),'utf8'),direct=readFileSync(resolve(folder,'direct-canvas.mjs'),'utf8');
 assert.match(app,/drawAnimatedTitle\(ctx,canvas,t,state\.current-t\.start\)/);
 assert.match(direct,/upsertTitleKeyframe\(/);
 assert.match(direct,/cut-keyframe-mode/);
 assert.match(direct,/data-tmotion/);
});
