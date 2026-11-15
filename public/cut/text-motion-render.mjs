/* Canvas2D renderer for SUBEHA CUT's independently authored text motion.
 * Preview and MediaRecorder export use the same draw path and project time.
 */
import {drawTitle,layoutTitle,measuredLine} from './title-render.mjs';
import {titleAt,normalizedTextMotion,motionState} from './text-motion-core.mjs';
import {drawPbrTitle} from './pbr-title-render.mjs';
const glyphs=str=>Array.from(String(str||''));
const wordSplitter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('ja',{granularity:'word'}):null;
function groups(line,unit){
 if(unit==='line'||unit==='global')return [line];
 if(unit==='glyph')return glyphs(line);
 if(wordSplitter)return Array.from(wordSplitter.segment(line),entry=>entry.segment);
 return glyphs(line).join('').match(/[A-Za-z0-9]+|[^\s]|\s+/gu)||[];
}
function paintUnit(ctx,text,spacing,outline){
 if(Math.abs(spacing)<.0001){
  if(outline)ctx.strokeText(text,0,0);
  ctx.fillText(text,0,0);
  return;
 }
 let x=-measuredLine(ctx,text,spacing)/2;
 for(const ch of glyphs(text)){
  const width=ctx.measureText(ch).width;
  if(outline)ctx.strokeText(ch,x+width/2,0);
  ctx.fillText(ch,x+width/2,0);
  x+=width+spacing;
 }
}
export function animatedTitleUnits(ctx,box){
 const {style:s,lines,spacing,padding,w,lineHeight}=box;
 const records=[];let unitIndex=0;
 for(let yIndex=0;yIndex<lines.length;yIndex++){
  const line=lines[yIndex],parts=groups(line,s.textMotion?.unit||'glyph');
  const width=measuredLine(ctx,line,spacing);
  const alignOffset=s.align==='left'?(-w/2+padding+width/2):s.align==='right'?(w/2-padding-width/2):0;
  let cursor=alignOffset-width/2;
  for(const part of parts){
   const partWidth=measuredLine(ctx,part,spacing);
   records.push({text:part,x:cursor+partWidth/2,y:(yIndex-(lines.length-1)/2)*lineHeight,
    index:s.textMotion?.unit==='global'?0:s.textMotion?.unit==='line'?yIndex:unitIndex});
   if(s.textMotion?.unit!=='line'&&s.textMotion?.unit!=='global')unitIndex++;
   cursor+=partWidth+spacing;
  }
 }
 const count=s.textMotion?.unit==='global'?1:s.textMotion?.unit==='line'?Math.max(1,lines.length):Math.max(1,unitIndex);
 return {records,count};
}
export function drawAnimatedTitle(ctx,canvas,item,localSeconds=0){
 if(!item?.text)return null;
 const age=Math.max(0,Number(localSeconds)||0);
 const t=titleAt(item,age);
 const conf=normalizedTextMotion(t.textMotion);
 if(conf.type==='none'){
  // Retain legacy projects' existing entrance animation without transforming their data.
  const left=Math.max(0,(Number(t.duration)||1)-age),appearance={...t};
  if(t.motion==='fade')appearance.opacity=(t.opacity??1)*Math.min(1,age/.28,left/.28);
  if(t.motion==='pop')appearance.size=(t.size??62)*(1+Math.max(0,.28-age)*.75);
  if(t.motion==='slide')appearance.y=(t.y??.76)+Math.max(0,.4-age)*.18;
  return t.pbrEnabled===true?drawPbrTitle(ctx,canvas,appearance,age):drawTitle(ctx,canvas,appearance);
 }
 // A 3D-lit title can follow a global entrance animation. Per-letter, per-word
 // or per-line motion keeps the original fast 2D renderer on mobile.
 if(t.pbrEnabled===true&&conf.unit==='global'){
  const unit=motionState(conf,age,t.duration||3,0,1);
  const modified={...t,
   x:(t.x??.5)+unit.dx/720,
   y:(t.y??.76)+unit.dy/720,
   size:(t.size??62)*unit.scale,
   rotation:(t.rotation??0)+unit.rotation*180/Math.PI,
   opacity:(t.opacity??1)*unit.alpha
  };
  return drawPbrTitle(ctx,canvas,modified,age);
 }
 const box=layoutTitle(ctx,canvas,{...t,textMotion:conf}),s={...box.style,textMotion:conf};
 ctx.save();
 ctx.translate(box.x,box.y);ctx.rotate(box.rotation*Math.PI/180);
 ctx.globalAlpha*=s.opacity;
 ctx.font=`${s.weight} ${box.size}px ${s.font}`;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.strokeStyle=s.outlineColor;ctx.lineWidth=box.size*s.outlineWidth;
 ctx.fillStyle=s.color;ctx.shadowColor='rgba(0,0,0,.88)';
 ctx.shadowBlur=s.shadowBlur*canvas.width/720;
 ctx.shadowOffsetX=s.shadowX*canvas.width/720;ctx.shadowOffsetY=s.shadowY*canvas.width/720;
 const {records,count}=animatedTitleUnits(ctx,{...box,style:s});
 // On long scripts, render unanimated instead of doing hundreds of expensive
 // per-unit canvas state switches on memory-limited phones.
 if(records.length>180){
  ctx.restore();return drawTitle(ctx,canvas,t);
 }
 if(s.box){
  ctx.save();ctx.fillStyle=s.boxColor;ctx.globalAlpha*=s.boxOpacity;
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(-box.w/2,-box.h/2,box.w,box.h,box.size*.2);
  else ctx.rect(-box.w/2,-box.h/2,box.w,box.h);
  ctx.fill();ctx.restore();
 }
 for(const part of records){
  if(!part.text)continue;
  const a=motionState(conf,age,Number(t.duration)||3,part.index,count);
  if(a.alpha<=.001)continue;
  ctx.save();
  ctx.translate(part.x+a.dx*canvas.width/720,part.y+a.dy*canvas.width/720);
  ctx.rotate(a.rotation);ctx.scale(Math.max(.001,a.scale),Math.max(.001,a.scale));
  ctx.globalAlpha*=a.alpha;
  if(a.blur>.1)ctx.filter=`blur(${a.blur*canvas.width/720}px)`;
  paintUnit(ctx,part.text,box.spacing,s.outlineWidth>0);
  ctx.restore();
 }
 ctx.restore();
 return box;
}
