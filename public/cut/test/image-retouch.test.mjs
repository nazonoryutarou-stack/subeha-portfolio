import assert from 'node:assert/strict';
import {removeConnectedBackground,cloneBrush} from '../image-retouch.mjs';
function sample(w=7,h=7){let d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let p=(y*w+x)*4;d[p]=20;d[p+1]=200;d[p+2]=25;d[p+3]=255;}return {width:w,height:h,data:d};}
let frame=sample();for(let y=2;y<5;y++)for(let x=2;x<5;x++){let p=(y*7+x)*4;frame.data[p]=230;frame.data[p+1]=32;frame.data[p+2]=37;}
let {image,removed,ratio}=removeConnectedBackground(frame,{x:0,y:0,tolerance:28,feather:0});
assert.equal(removed,40);assert.equal(image.data[(3*7+3)*4+3],255);assert.equal(image.data[3],0);assert.equal(frame.data[3],255);assert.equal(ratio,40/49);
let background=removeConnectedBackground(frame,{x:3,y:3,tolerance:40,feather:0});assert.equal(background.removed,9);assert.equal(background.image.data[(0*7+0)*4+3],255);
let clone=cloneBrush(frame,{targetX:3,targetY:3,sourceX:0,sourceY:0,radius:1,softness:0});
assert.equal(clone.image.data[(3*7+3)*4],20);assert.equal(frame.data[(3*7+3)*4],230);
assert.throws(()=>removeConnectedBackground({width:100000,height:100000,data:new Uint8Array(0)},{x:0,y:0}),/不正/);
const transparent=removeConnectedBackground(frame,{x:0,y:0,tolerance:20,feather:1});assert.ok(transparent.image.data[3]<=255);
console.log('image retouch tests PASS');

// Same green inside a disconnected island must be preserved when tapping the outside.
const island=sample(5,5);for(let y=1;y<4;y++)for(let x=1;x<4;x++){let q=(y*5+x)*4;island.data[q]=230;island.data[q+1]=10;island.data[q+2]=5;}
let isolated=(2*5+2)*4;island.data[isolated]=20;island.data[isolated+1]=200;island.data[isolated+2]=25;
const masked=removeConnectedBackground(island,{x:0,y:0,tolerance:4,feather:0});
assert.equal(masked.removed,16);assert.equal(masked.image.data[isolated+3],255);
