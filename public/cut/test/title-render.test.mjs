import assert from 'node:assert/strict';
import {layoutTitle,drawTitle,measuredLine,wrapTitle,titleStyle} from '../title-render.mjs';
import {widthFromDrag,nearbyGuides,titleChanges} from '../title-gestures.mjs';
const records=[];
const ctx={
 save(){records.push('save')},restore(){records.push('restore')},translate(){},rotate(){},scale(){},
 measureText(s){return {width:Array.from(s).length*20}},fillText(s){records.push('fill:'+s)},
 strokeText(s){records.push('stroke:'+s)},beginPath(){},roundRect(){},rect(){},fill(){},
 set font(v){this._font=v},get font(){return this._font},set textAlign(v){},set textBaseline(v){},
 set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set lineJoin(v){},
 set globalAlpha(v){this._alpha=v},get globalAlpha(){return this._alpha??1},
 set shadowBlur(v){},set shadowColor(v){},set shadowOffsetX(v){},set shadowOffsetY(v){}
};
const canvas={width:720,height:1280};
const title={text:'こんにちは世界 こんにちは',x:.5,y:.5,size:64,color:'#ffffff',width:.28,letterSpacing:3,lineHeight:1.6,align:'left',box:true,boxOpacity:0};
const b=layoutTitle(ctx,canvas,title);assert.ok(Math.abs(b.w-201.6)<1e-6);assert.ok(b.lines.length>1);assert.ok(b.h>120);
assert.ok(b.lines.every(line=>measuredLine(ctx,line,b.spacing)<b.w+1));
records.length=0;drawTitle(ctx,canvas,title);assert.ok(records.some(x=>x.startsWith('fill:')));assert.equal(records.filter(x=>x==='save').length,records.filter(x=>x==='restore').length);
const original={...title};const changed=titleChanges(title,{align:'right',width:.5});assert.equal(changed.align,'right');assert.equal(original.align,'left');
const cue={text:'字幕',style:{x:.4}};const newCue=titleChanges(cue,{width:.4,letterSpacing:5},true);assert.equal(newCue.style.width,.4);assert.equal(cue.style.width,undefined);
assert.equal(widthFromDrag(.5,100,0,0,400),.75);assert.equal(widthFromDrag(.5,0,100,90,400),.75);
assert.equal(widthFromDrag(.5,600,0,0,400),.98);
assert.deepEqual(nearbyGuides(.503,.492),{x:true,y:true});
assert.equal(titleStyle({color:'#ff0000',align:'left'}).align,'left');
const wrap=wrapTitle(ctx,'ABCD\nEFG',50,0);assert.deepEqual(wrap,['AB','CD','EF','G']);
console.log('Finger typography geometry, wrapping, non-destructive styles: PASS');
