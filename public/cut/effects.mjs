/* Local non-AI Canvas2D effects. No remote assets or copyrighted presets. */
export const EFFECT_NAMES = Object.freeze(['none','vignette','pixelate','prism','scanlines','grain','lightleak']);
export function applyEffect(ctx,canvas,fx,amount=0.5,time=0){
 if(!EFFECT_NAMES.includes(fx)||fx==='none')return;
 const w=canvas.width,h=canvas.height,a=Math.max(0,Math.min(1,Number(amount)||0));
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
 }else if(fx==='lightleak'){
   const x=w*(.7+.15*Math.sin(time*.8)),y=h*(.18+.17*Math.cos(time*.32));
   const g=ctx.createRadialGradient(x,y,0,x,y,w*.8);g.addColorStop(0,`rgba(255,115,66,${a*.52})`);g.addColorStop(.5,`rgba(207,72,150,${a*.19})`);g.addColorStop(1,'rgba(255,50,40,0)');
   ctx.fillStyle=g;ctx.globalCompositeOperation='screen';ctx.fillRect(0,0,w,h);
 }
 ctx.restore();
}
