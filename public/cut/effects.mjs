/* Local non-AI Canvas2D effects. No remote assets or copyrighted presets. */
import {OPTICAL_TYPES,applyOpticalFx} from './optical-fx.mjs';
export const EFFECT_NAMES = Object.freeze([
 'none','vignette','pixelate','prism','scanlines','grain','lightleak','bloom','letterbox','duotone','ghost',
 'shake','offset','oldfilm','mosaic','pattern','scan',...OPTICAL_TYPES
]);
let stillCanvas=null;
function isolatedFrame(source){
 if(typeof document==='undefined')return null;
 if(!stillCanvas)stillCanvas=document.createElement('canvas');
 stillCanvas.width=source.width;stillCanvas.height=source.height;
 const context=stillCanvas.getContext('2d');
 if(!context)return null;
 context.drawImage(source,0,0);
 return stillCanvas;
}
export function applyEffect(ctx,canvas,fx,amount=0.5,time=0,options={}){
 if(!EFFECT_NAMES.includes(fx)||fx==='none')return;
 const w=canvas.width,h=canvas.height,a=Math.max(0,Math.min(1,Number(amount)||0));
 if(a<=0)return;
 if(OPTICAL_TYPES.includes(fx)){applyOpticalFx(ctx,canvas,fx,a,time,options);return;}
 if(fx==='mosaic'){applyEffect(ctx,canvas,'pixelate',a,time);return;}
 if(fx==='scan'){applyEffect(ctx,canvas,'scanlines',a,time);return;}
 ctx.save();
 if(fx==='vignette'){
   const g=ctx.createRadialGradient(w/2,h/2,w*.13,w/2,h/2,Math.max(w,h)*.76);
   g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${a*.92})`);
   ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }else if(fx==='pixelate'){
   const block=Math.max(2,Math.round(4+a*48));
   const small=document.createElement('canvas');small.width=Math.max(1,Math.floor(w/block));small.height=Math.max(1,Math.floor(h/block));
   small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
   ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,w,h);
 }else if(fx==='prism'){
   const shift=Math.max(2,Math.round(a*w*.025));ctx.globalAlpha=a*.24;ctx.globalCompositeOperation='screen';
   ctx.filter='hue-rotate(100deg)';ctx.drawImage(canvas,shift,0,w,h);
   ctx.filter='hue-rotate(280deg)';ctx.drawImage(canvas,-shift,0,w,h);
 }else if(fx==='scanlines'){
   ctx.fillStyle=`rgba(0,0,0,${.06+a*.38})`;
   const step=Math.max(3,Math.round(w/260));for(let y=0;y<h;y+=step*2)ctx.fillRect(0,y,w,step);
 }else if(fx==='grain'){
   // Low-resolution static-like graphic, intentionally not frame-wise noise across all 1080p pixels.
   const noise=document.createElement('canvas');noise.width=80;noise.height=144;
   const nc=noise.getContext('2d');const pixels=nc.createImageData(noise.width,noise.height);
   let seed=Math.floor(time*23)+12345;
   for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const n=(seed>>>24);pixels.data[i]=n;pixels.data[i+1]=n;pixels.data[i+2]=n;pixels.data[i+3]=Math.round(95*a);}
   nc.putImageData(pixels,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(noise,0,0,w,h);
 }else if(fx==='bloom'){
   ctx.globalCompositeOperation='screen';ctx.globalAlpha=a*.54;ctx.filter=`blur(${Math.max(3,Math.round(a*w*.016))}px) brightness(1.15)`;ctx.drawImage(canvas,0,0);
 }else if(fx==='letterbox'){
   const bar=Math.round(h*(.035+.13*a));ctx.fillStyle='#000';ctx.fillRect(0,0,w,bar);ctx.fillRect(0,h-bar,w,bar);
 }else if(fx==='duotone'){
   ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=a*.7;const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#342ce9');grad.addColorStop(1,'#ffbc54');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 }else if(fx==='ghost'){
   ctx.globalCompositeOperation='screen';ctx.globalAlpha=a*.28;ctx.filter='hue-rotate(35deg)';ctx.drawImage(canvas,Math.round(w*.006*a),0,w,h);
 }else if(fx==='shake'||fx==='offset'){
   const snapshot=isolatedFrame(canvas);
   if(snapshot){
    const x=fx==='shake'?Math.sin(time*39)*Math.round(w*a*.026):Math.round(w*a*.16);
    const y=fx==='shake'?Math.cos(time*33)*Math.round(h*a*.014):0;
    ctx.clearRect(0,0,w,h);
    ctx.drawImage(snapshot,x,y,w,h);
    // Repeat the nearest edge as background so motion does not produce
    // transparency or stale output; opaque main video remains opaque.
    if(x>0)ctx.drawImage(snapshot,0,0,1,h,0,0,x,h);
    else if(x<0)ctx.drawImage(snapshot,w-1,0,1,h,w+x,0,-x,h);
    if(y>0)ctx.drawImage(snapshot,0,0,w,1,0,0,w,y);
    else if(y<0)ctx.drawImage(snapshot,0,h-1,w,1,0,h+y,w,-y);
   }
 }else if(fx==='oldfilm'){
   const snapshot=isolatedFrame(canvas);
   if(snapshot){
    ctx.filter=`sepia(${(.35+a*.55).toFixed(2)}) contrast(${(1+a*.13).toFixed(2)})`;
    ctx.globalAlpha=.25+a*.55;ctx.drawImage(snapshot,0,0);
    ctx.filter='none';
   }
   ctx.fillStyle=`rgba(245,222,177,${(a*.06).toFixed(3)})`;ctx.fillRect(0,0,w,h);
 }else if(fx==='pattern'){
   ctx.strokeStyle=`rgba(242,190,249,${(a*.28).toFixed(3)})`;
   ctx.lineWidth=Math.max(1,w/900);
   const step=Math.max(14,Math.round((.11-a*.05)*w));
   for(let x=0;x<w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
   for(let y=0;y<h;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 }else if(fx==='lightleak'){
   const x=w*(.7+.15*Math.sin(time*.8)),y=h*(.18+.17*Math.cos(time*.32));
   const g=ctx.createRadialGradient(x,y,0,x,y,w*.8);g.addColorStop(0,`rgba(255,115,66,${a*.52})`);g.addColorStop(.5,`rgba(207,72,150,${a*.19})`);g.addColorStop(1,'rgba(255,50,40,0)');
   ctx.fillStyle=g;ctx.globalCompositeOperation='screen';ctx.fillRect(0,0,w,h);
 }
 ctx.restore();
}
