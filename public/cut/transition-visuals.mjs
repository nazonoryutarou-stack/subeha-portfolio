/* Original Canvas2D transition primitives. No third-party transition JSON, media,
 * LUTs or shaders are bundled. The editor always renders the same frames to export.
 */
const clamp=v=>Math.min(1,Math.max(0,Number.isFinite(+v)?+v:0));
export function outgoingTransitionAlpha(type,progress){
 return type==='fade'?Math.max(0,1-2*clamp(progress)):1;
}
export function drawIncomingTransition(ctx,canvas,type,progress,draw){
 const p=clamp(progress),W=canvas.width,H=canvas.height;
 ctx.save();
 let alpha=1;
 switch(type){
 case 'fade':alpha=Math.max(0,2*p-1);break;
 case 'wipe-left':case 'wipe-right':case 'wipe-up':case 'wipe-down':{
  ctx.beginPath();
  if(type==='wipe-left')ctx.rect(0,0,W*p,H);
  else if(type==='wipe-right')ctx.rect(W*(1-p),0,W*p,H);
  else if(type==='wipe-up')ctx.rect(0,H*(1-p),W,H*p);
  else ctx.rect(0,0,W,H*p);
  ctx.clip();break;
 }
 case 'slide-left':ctx.translate(W*(1-p),0);break;
 case 'slide-right':ctx.translate(-W*(1-p),0);break;
 case 'slide-up':ctx.translate(0,H*(1-p));break;
 case 'slide-down':ctx.translate(0,-H*(1-p));break;
 case 'zoom':case 'zoom-in':{
  const scale=.65+.35*p;ctx.translate(W/2,H/2);ctx.scale(scale,scale);ctx.translate(-W/2,-H/2);alpha=p;break;
 }
 case 'zoom-out':{
  const scale=1.4-.4*p;ctx.translate(W/2,H/2);ctx.scale(scale,scale);ctx.translate(-W/2,-H/2);alpha=p;break;
 }
 case 'iris-in':case 'iris-out':{
  const r=Math.hypot(W,H)*(type==='iris-out'?1-p:p)*.68;
  ctx.beginPath();
  if(type==='iris-out'){ctx.rect(0,0,W,H);ctx.moveTo(W/2+r,H/2);ctx.arc(W/2,H/2,r,0,Math.PI*2,true);ctx.clip('evenodd');}
  else {ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.clip();}
  break;
 }
 case 'flash':alpha=p;break;
 case 'glitch':{
  const power=(1-p);
  ctx.translate(Math.sin(p*57)*W*.022*power,Math.sin(p*39)*H*.011*power);
  alpha=Math.min(1,p*1.4);break;
 }
 case 'roll-left':case 'roll-right':{
  const direction=type==='roll-left'?-1:1;
  ctx.translate(W/2,H/2);ctx.rotate(direction*(1-p)*Math.PI*.48);
  ctx.scale(.64+.36*p,.64+.36*p);ctx.translate(-W/2,-H/2);alpha=p;break;
 }
 default:alpha=p;break;
 }
 if(alpha>.0001)draw(alpha);
 if(type==='flash'){
  // Short white transition burst, after the two clip frames are composited.
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=Math.max(0,1-Math.abs(2*p-1))*.72;
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);ctx.restore();
 }
 ctx.restore();
}
