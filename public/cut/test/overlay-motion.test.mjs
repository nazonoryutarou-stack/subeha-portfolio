import test from 'node:test';import assert from 'node:assert/strict';
import {overlayMotion,OVERLAY_MOTIONS} from '../overlay-motion.mjs';
const layer=()=>({id:'overlay',duration:2,opacity:.9,x:.4,y:.55,scale:.7,rotation:12,keyframes:[{time:.7,x:.2}]});
test('preset motions generate ordered editable transform keyframes',()=>{
 for(const mode of Object.keys(OVERLAY_MOTIONS).filter(x=>x!=='none')){
  const original=layer(),result=overlayMotion(original,mode);
  assert.notEqual(result,original);assert.ok(result.keyframes.length>=2,mode);
  assert.ok(result.keyframes.every((x,i,a)=>!i||x.time>=a[i-1].time));
  assert.ok(result.keyframes.every(x=>x.time>=0&&x.time<=original.duration));
  assert.equal(original.keyframes.length,1);
 }
});
test('fade and pop start transparent, fadeout ends transparent',()=>{
 assert.equal(overlayMotion(layer(),'fade').keyframes[0].opacity,0);
 assert.equal(overlayMotion(layer(),'pop').keyframes[0].opacity,0);
 assert.equal(overlayMotion(layer(),'fadeOut').keyframes.at(-1).opacity,0);
 assert.deepEqual(overlayMotion(layer(),'none').keyframes,[]);
});
test('very short overlay cannot create out of range keyframes',()=>{
 const item={...layer(),duration:.1};assert.ok(overlayMotion(item,'fade').keyframes.at(-1).time<=.1);
});
