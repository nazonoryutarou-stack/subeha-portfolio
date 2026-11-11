/* Shared, non-destructive typography engine: preview and MediaRecorder use exactly the same canvas. */
import {TEXT_FONTS,styleForText} from './text-styles.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+n)?+n:a));
const hex=(s,fallback)=>/^#[0-9a-f]{6}$/i.test(s||'')?s:fallback;
const units=s=>Array.from(String(s||''));
export function titleStyle(item={},isCaption=false){
 const source=isCaption?item:item;
 const basic=isCaption?{fontFamily:'sans',weight:800,color:'#ffffff',outlineColor:'#000000',outlineWidth:source.shadow===false?0:.12,box:source.background!==false}:styleForText(source);
 return {...basic,...source,font:TEXT_FONTS[source.fontFamily]||TEXT_FONTS.sans,
  color:hex(source.color,'#ffffff'),outlineColor:hex(source.outlineColor,'#000000'),
  outlineWidth:clamp(source.outlineWidth??basic.outlineWidth??0,0,.38),
  align:['left','center','right'].includes(source.align)?source.align:'center',
  letterSpacing:clamp(source.letterSpacing??0,-9,28),lineHeight:clamp(source.lineHeight??(isCaption?1.34:1.23),.75,2.2),
  width:source.width==null?null:clamp(source.width,.18,.98),
  opacity:clamp(source.opacity??1,0,1),
  boxColor:hex(source.boxColor,'#000000'),boxOpacity:clamp(source.boxOpacity??(isCaption?.64:.72),0,1),
  shadowBlur:clamp(source.shadowBlur??(isCaption&&source.shadow===false?0:14),0,70),
  shadowX:clamp(source.shadowX??0,-40,40),shadowY:clamp(source.shadowY??0,-40,40),
  weight:[400,500,600,700,800,900].includes(+source.weight)?+source.weight:800,
  box:isCaption?source.background!==false:!!source.box};
}
export function measuredLine(ctx,line,spacing){if(Math.abs(spacing)<.0001)return ctx.measureText(line).width;const glyphs=units(line);return glyphs.reduce((s,ch)=>s+ctx.measureText(ch).width,0)+Math.max(0,glyphs.length-1)*spacing;}
export function wrapTitle(ctx,text,maxWidth,spacing,maxLines=12){
 const lines=[];for(const para of String(text||'').split('\n')){let line='';for(const ch of units(para)){
  if(line&&measuredLine(ctx,line+ch,spacing)>maxWidth){lines.push(line);line=ch;}else line+=ch;
 }lines.push(line);}
 return lines.slice(0,maxLines);
}
export function layoutTitle(ctx,canvas,item={},isCaption=false){
 const W=canvas.width,H=canvas.height,s=titleStyle(item,isCaption),size=clamp(item.size??(isCaption?42:62),12,240)*W/720;
 const gap=s.letterSpacing*W/720,padding=size*.25,boxW=s.width===null?W*.91:W*s.width;
 ctx.save();ctx.font=`${s.weight} ${size}px ${s.font}`;
 const lines=wrapTitle(ctx,item.text,Math.max(size*.65,boxW-2*padding),gap,isCaption?8:16);
 const measured=Math.max(size*1.3,...lines.map(x=>measuredLine(ctx,x,gap)));
 ctx.restore();
 const w=s.width===null?Math.min(W*.95,measured+2*padding):boxW;
 const lineHeight=size*s.lineHeight;
 const h=Math.max(size*1.4,lines.length*lineHeight)+padding*2;
 return {x:W*clamp(item.x??.5,-.3,1.3),y:H*clamp(item.y??(isCaption?.82:.76),-.3,1.3),
  w,h,size,lineHeight,padding,spacing:gap,lines,rotation:clamp(item.rotation??0,-180,180),style:s};
}
export function drawGlyphLine(ctx,line,x,y,spacing){
 const glyphs=units(line),width=measuredLine(ctx,line,spacing);let offset=x-width/2;
 for(const char of glyphs){const m=ctx.measureText(char).width;ctx.fillText(char,offset+m/2,y);offset+=m+spacing;}
}
function paintLine(ctx,line,x,y,gap,outline){
 if(Math.abs(gap)<.0001){if(outline)ctx.strokeText(line,x,y);ctx.fillText(line,x,y);return;}
 const glyphs=units(line),width=measuredLine(ctx,line,gap);let offset=x-width/2;
 for(const char of glyphs){const m=ctx.measureText(char).width;
  if(outline)ctx.strokeText(char,offset+m/2,y);ctx.fillText(char,offset+m/2,y);offset+=m+gap;}
}
export function drawTitle(ctx,canvas,item,isCaption=false){
 if(!item?.text)return null;const box=layoutTitle(ctx,canvas,item,isCaption),s=box.style;
 ctx.save();ctx.translate(box.x,box.y);ctx.rotate(box.rotation*Math.PI/180);ctx.globalAlpha*=s.opacity;
 if(s.box){ctx.save();ctx.fillStyle=s.boxColor;ctx.globalAlpha*=s.boxOpacity;ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(-box.w/2,-box.h/2,box.w,box.h,box.size*.2);else ctx.rect(-box.w/2,-box.h/2,box.w,box.h);
  ctx.fill();ctx.restore();}
 ctx.font=`${s.weight} ${box.size}px ${s.font}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.strokeStyle=s.outlineColor;ctx.lineWidth=box.size*s.outlineWidth;ctx.fillStyle=s.color;
 ctx.shadowColor='rgba(0,0,0,.88)';ctx.shadowBlur=s.shadowBlur*canvas.width/720;
 ctx.shadowOffsetX=s.shadowX*canvas.width/720;ctx.shadowOffsetY=s.shadowY*canvas.width/720;
 for(let i=0;i<box.lines.length;i++){
  const y=(i-(box.lines.length-1)/2)*box.lineHeight;
  const lineWidth=measuredLine(ctx,box.lines[i],box.spacing);
  let x=0;
  if(s.align==='left')x=-(box.w/2-box.padding)+lineWidth/2;
  if(s.align==='right')x=box.w/2-box.padding-lineWidth/2;
  paintLine(ctx,box.lines[i],x,y,box.spacing,s.outlineWidth>0);
 }
 ctx.restore();return box;
}
