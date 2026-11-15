import test from 'node:test';
import assert from 'node:assert/strict';
import {OPTICAL_TYPES,OPTICAL_LABELS,OPTICAL_PARAMS,opticalSettings,applyOpticalFx} from '../optical-fx.mjs';
import {EFFECT_NAMES,applyEffect} from '../effects.mjs';
import {FX_TYPES,FX_LABELS,addFx,fxAmountAt,applyLookToClip} from '../fx-lab-core.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function fakeContext(){
 let copies=0,level=0;
 const c={save(){level++},restore(){level--},setTransform(){},clearRect(){},scale(){},translate(){},drawImage(){copies++},
  createLinearGradient(){return {addColorStop(){}}},createRadialGradient(){return {addColorStop(){}}},beginPath(){},fillRect(){},stroke(){},moveTo(){},lineTo(){}};
 return {c,copies:()=>copies,level:()=>level};
}
test('ten original optical effect categories support independent settings',()=>{
 assert.equal(OPTICAL_TYPES.length,10);
 for(const type of OPTICAL_TYPES){
  assert.ok(EFFECT_NAMES.includes(type),type);
  assert.ok(FX_TYPES.includes(type),type);
  assert.equal(typeof FX_LABELS[type],'string',type);
  assert.equal(typeof OPTICAL_LABELS[type],'string',type);
  assert.ok(opticalSettings(type,.7).mode>0,type);
 }
 assert.equal(Object.keys(OPTICAL_PARAMS).length,5);
});
test('older projects and recorded device-audit FX names stay available',()=>{
 for(const type of ['shake','prism','offset','oldfilm','mosaic','focusblur','rgb','pattern','scan','kaleido']){
  assert.ok(EFFECT_NAMES.includes(type),type);
  assert.ok(FX_TYPES.includes(type),type);
 }
});
test('settings clamp invalid or missing properties before reaching shader uniforms',()=>{
 const s=opticalSettings('lenswarp',42,{angle:555,spread:-100,frequency:999,centerX:-3,centerY:9});
 assert.equal(s.intensity,1);assert.equal(s.spread,.05);
 assert.equal(s.frequency,18);assert.equal(s.centerX,0);assert.equal(s.centerY,1);
 assert.ok(Math.abs(s.angle-Math.PI)<1e-9);
 const missing=opticalSettings('chromatic',.5,null);
 assert.equal(missing.centerX,.5);
});
test('effect serialization and animated strength remain independent',()=>{
 const stack=addFx([], 'ripple',.5,'water1');
 stack[0].optics={angle:44,frequency:9.5,centerX:.2,centerY:.8};
 stack[0].keys=[{time:0,amount:.2},{time:2,amount:1}];
 const copy=JSON.parse(JSON.stringify(stack));
 assert.equal(copy[0].optics.frequency,9.5);
 assert.ok(Math.abs(fxAmountAt(copy[0],1)-.6)<1e-9);
 assert.notEqual(copy[0],stack[0]);
});
test('three new looks can be edited as normal independent layers',()=>{
 for(const preset of ['refracted','broadcast','anamorphic']){
  const result=applyLookToClip({id:'c',fxStack:[]},preset);
  assert.ok(result.fxStack.length>=2);
  for(const row of result.fxStack)assert.ok(FX_TYPES.includes(row.type));
 }
});
test('WebGL unavailable uses a separately copied Canvas2D source, not self-blitting',()=>{
 const {c,copies,level}=fakeContext();
 const surface={width:720,height:1280};
 const previous=globalThis.document;
 let snapshotCopies=0;
 globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  const temp={width:0,height:0,getContext(kind){
   if(kind==='webgl')return null;
   return {clearRect(){},drawImage(){snapshotCopies++}};
  }};
  return temp;
 }};
 try{
  assert.equal(applyOpticalFx(c,surface,'chromatic',.4,1.2,{angle:40}),true);
  assert.ok(snapshotCopies>0);
  assert.ok(copies()>0);
  assert.equal(level(),0);
 }finally{
  if(previous===undefined)delete globalThis.document;else globalThis.document=previous;
 }
});
test('preview and MediaRecorder export both call the same per-layer effect with optics',()=>{
 const app=readFileSync(resolve(root,'app.mjs'),'utf8');
 const fx=readFileSync(resolve(root,'fx-lab.mjs'),'utf8');
 const sw=readFileSync(resolve(root,'sw.js'),'utf8');
 assert.match(app,/applyEffect\(ctx,canvas,fx\.type,amount,state\.current,fx\.optics\|\|\{\}\)/);
 assert.match(fx,/data-optic-pad/);
 assert.match(fx,/data-optic-key/);
 assert.match(sw,/optical-fx\.mjs/);
});
