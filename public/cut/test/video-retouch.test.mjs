import assert from 'node:assert/strict';
import {removeBorderBackground,retouchFrame,retouchPosition,normalizedRetouch,sampleFrameColor} from '../video-retouch.mjs';
const image=(w,h,rgb=[0,220,0])=>{const data=new Uint8ClampedArray(w*h*4);for(let p=0;p<w*h;p++){data.set([...rgb,255],p*4);}return {width:w,height:h,data};};
const put=(frame,x,y,[r,g,b,a=255])=>frame.data.set([r,g,b,a],(y*frame.width+x)*4);
const get=(frame,x,y)=>[...frame.data.slice((y*frame.width+x)*4,(y*frame.width+x+1)*4)];
// Edge connected matte preserves disconnected islands with identical background colour.
let base=image(9,9);for(let y=1;y<8;y++)for(let x=1;x<8;x++)put(base,x,y,[210,20,20]);
put(base,4,4,[0,220,0]); // green hole surrounded by red actor
let matte=removeBorderBackground(base,{color:'#00dc00',tolerance:8,feather:0});
assert.equal(matte.removed,32);assert.equal(get(matte.image,0,0)[3],0);assert.equal(get(matte.image,4,4)[3],255);
assert.equal(get(base,0,0)[3],255,'source must not be changed');
assert.equal(sampleFrameColor(base,4/8,4/8),'#00dc00');
// Animated subject: red pixels shift every frame, fixed green key remains stable.
for(const offset of [1,2,3,4,5]){
 const frame=image(10,8);for(let y=2;y<5;y++)for(let x=offset;x<offset+2;x++)put(frame,x,y,[240,35,45]);
 const res=retouchFrame(frame,{mode:'matte',color:'#00dc00',tolerance:12,feather:0},0.5);
 assert.equal(res.changed,true);assert.equal(get(res.image,offset,3)[3],255);assert.equal(get(res.image,0,0)[3],0);
}
let feather=removeBorderBackground(base,{color:'#00dc00',tolerance:8,feather:2});
assert.ok(get(feather.image,0,0)[3]<100);assert.ok(get(feather.image,1,1)[3]>0 && get(feather.image,1,1)[3]<255);
// Clone patch adapts to new source frame (no stale pixels between frames).
for(const colour of [30,80,120]){
 const f=image(14,14,[colour,colour,colour]);put(f,5,5,[250,0,0]);
 const ret=retouchFrame(f,{mode:'clone',x:5/13,y:5/13,source:{x:9/13,y:9/13},radius:.085},1);
 assert.equal(ret.changed,true);
 assert.equal(get(ret.image,5,5)[0],colour);
 assert.equal(get(f,5,5)[0],250);
}
const config={mode:'clone',x:.2,y:.5,source:{x:.7,y:.5},radius:.09,keyframes:[{time:0,x:.2,y:.5},{time:2,x:.8,y:.5}]};
assert.ok(Math.abs(retouchPosition(config,1).x-.5)<1e-8);
assert.equal(retouchPosition(config,4).x,.8);
assert.equal(retouchPosition(config,-1).x,.2);
const outside=retouchFrame(base,{mode:'clone',start:2,end:3},1);
assert.equal(outside.changed,false);assert.equal(outside.image,base);
const off=retouchFrame(base,{mode:'matte',enabled:false},0);
assert.equal(off.changed,false);
const normalized=normalizedRetouch({mode:'matte',color:'javascript:test',tolerance:999,quality:999});
assert.equal(normalized.color,'#00ff00');assert.equal(normalized.tolerance,120);assert.equal(normalized.quality,512);
assert.equal(normalizedRetouch({mode:'AI magic'}),null);
assert.throws(()=>removeBorderBackground({width:2000,height:1000,data:new Uint8ClampedArray(0)}),/不正/);
console.log('video retouch tests PASS');
