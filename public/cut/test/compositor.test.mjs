import assert from 'node:assert/strict';
import {chromaPixels,pointInPolygon,trackingPosition,hexRGB,smoothstep} from '../compositor.mjs';
import {startPointTrack,trackPoint} from '../point-tracker.mjs';
import {audioClipGain} from '../multi-audio.mjs';
const data={width:3,height:1,data:new Uint8ClampedArray([0,255,0,255,255,0,0,255,0,220,30,220])};
chromaPixels(data,{enabled:true,color:'#00ff00',similarity:.23,softness:.12,spill:.4});
assert.equal(data.data[3],0,'pure green should be removed');
assert.equal(data.data[7],255,'red should remain');
assert.ok(data.data[11]<220,'partial green-edge should be semi-transparent');
assert.deepEqual(hexRGB('#123abc'),[0x12,0x3a,0xbc]);
assert.equal(smoothstep(0,1,0),0);assert.equal(smoothstep(0,1,1),1);
const polygon=[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}];
assert.ok(pointInPolygon(.5,.5,polygon));assert.ok(!pointInPolygon(0,0,polygon));
assert.deepEqual(trackingPosition({points:[{time:0,x:.1,y:.5},{time:2,x:.7,y:.9}]},1),{x:.4,y:.7});
const clip={start:2,duration:5,volume:.8,fadeIn:2,fadeOut:2};
assert.equal(audioClipGain(clip,1),0);assert.equal(audioClipGain(clip,2),0);
assert.equal(audioClipGain(clip,3),.4);assert.equal(audioClipGain(clip,4.5),.8);
assert.ok(Math.abs(audioClipGain(clip,6)-.4)<1e-8);
assert.equal(audioClipGain({...clip,muted:true},4),0);
function frame(width=60,height=45,cx=15,cy=15){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=(y*width+x)*4;
 const seed=(x-cx)*(x-cx)*3+(y-cy)*(y-cy)*7;
 const val=(Math.abs(x-cx)<=6&&Math.abs(y-cy)<=6)?(seed%190+30):5;
 data[k]=data[k+1]=data[k+2]=val;data[k+3]=255;}
 return {width,height,data};
}
const first=startPointTrack(frame(),15,15,4);assert.ok(first);
const followed=trackPoint(frame(60,45,20,17),first,{search:12});
assert.ok(followed);assert.equal(followed.x,20);assert.equal(followed.y,17);
assert.equal(startPointTrack({width:20,height:20,data:new Uint8ClampedArray(20*20*4).fill(180)},10,10),null);
console.log('v0.3 compositor, audio and tracker tests: PASS');
