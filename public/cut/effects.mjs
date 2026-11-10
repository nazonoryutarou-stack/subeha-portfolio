/* Local non-AI Canvas2D effects. No remote assets or copyrighted presets. */
export const EFFECT_NAMES = Object.freeze(['none','shake','prism','offset','oldfilm','mosaic','focusblur','rgb','pattern','scan','kaleido','vignette','pixelate','scanlines','grain','lightleak']);
export function applyEffect(ctx,canvas,fx,amount=0.5,time=0){
 if(!EFFECT_NAMES.includes(fx)||fx==='none')return;
 const w=canvas.width,h=canvas.height,a=Math.max(0,Math.min(1,Number(amount)||0));
 ctx.save();
 if(fx==='vignette'){
   const g=ctx.createRadialGradient(w/2,h/2,w*.13,w/2,h/2,Math.max(w,h)*.76);
   g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${a*.92})`);
   ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 }else if((fx==='pixelate'||fx==='mosaic')){
   const block=Math.max(2,Math.round(4+a*48));
   const small=document.createElement('canvas');small.width=Math.max(1,Math.floor(w/block));small.height=Math.max(1,Math.floor(h/block));
   small.getContext('2d').drawImage(canvas,0,0,small.width,small.height);
   ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,w,h);
 }else if(fx==='prism'){
   const shift=Math.max(2,Math.round(a*w*.025));ctx.globalAlpha=a*.24;ctx.globalCompositeOperation='screen';
   ctx.filter='hue-rotate(100deg)';ctx.drawImage(canvas,shift,0,w,h);
   ctx.filter='hue-rotate(280deg)';ctx.drawImage(canvas,-shift,0,w,h);
 }else if((fx==='scanlines'||fx==='scan')){
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
 else if(fx==='shake'){
   // Oscillating handheld-camera shake; deterministic for frame-accurate exports.
   const snap=document.createElement('canvas');snap.width=w;snap.height=h;snap.getContext('2d').drawImage(canvas,0,0);
   const dx=Math.sin(time*53)*a*w*.026,dy=Math.cos(time*37)*a*h*.019;
   ctx.drawImage(snap,dx-w*.02,dy-h*.02,w*1.04,h*1.04);
 }else if(fx==='offset'){
   // Horizontal slice displacement, with the displaced part wrapped back in.
   const snap=document.createElement('canvas');snap.width=w;snap.height=h;snap.getContext('2d').drawImage(canvas,0,0);
   const top=Math.round(h*(.3+.18*Math.sin(time*1.3)));
   const band=Math.round(h*.22);
   const shift=Math.round(w*(.06+.23*a)*Math.sin(time*7));
   const sx=((shift%w)+w)%w;
   ctx.drawImage(snap,w-sx,top,sx,band,0,top,sx,band);
   ctx.drawImage(snap,0,top,w-sx,band,sx,top,w-sx,band);
 }else if(fx==='oldfilm'){
   ctx.fillStyle=`rgba(174,124,70,${(a*.28).toFixed(3)})`;ctx.fillRect(0,0,w,h);
   const v=ctx.createRadialGradient(w/2,h/2,w*.16,w/2,h/2,h*.7);
   v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,`rgba(23,11,1,${a*.7})`);
   ctx.fillStyle=v;ctx.fillRect(0,0,w,h);
   ctx.strokeStyle=`rgba(255,244,207,${a*.58})`;
   ctx.lineWidth=Math.max(1,w/600);
   for(let i=0;i<3;i++){const x=w*(((Math.sin(Math.floor(time*7+i)*12.9898)*43758.5453)%1+1)%1);
     ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+Math.sin(time*3+i)*8,h);ctx.stroke();}
 }else if(fx==='focusblur'){
   // Soft background with a sharp, oval focus area.
   const snap=document.createElement('canvas');snap.width=w;snap.height=h;snap.getContext('2d').drawImage(canvas,0,0);
   ctx.filter=`blur(${Math.round(3+a*15)}px)`;ctx.drawImage(snap,0,0,w,h);ctx.filter='none';
   ctx.save();ctx.beginPath();ctx.ellipse(w/2,h/2,w*(.42-a*.22),h*(.39-a*.2),0,0,Math.PI*2);ctx.clip();
   ctx.drawImage(snap,0,0);ctx.restore();
 }else if(fx==='rgb'){
   const snap=document.createElement('canvas');snap.width=w;snap.height=h;snap.getContext('2d').drawImage(canvas,0,0);
   const d=Math.round(a*w*.024)+1;
   ctx.globalCompositeOperation='screen';ctx.globalAlpha=.34*a;
   ctx.filter='hue-rotate(130deg)';ctx.drawImage(snap,d,0);
   ctx.filter='hue-rotate(280deg)';ctx.drawImage(snap,-d,0);ctx.filter='none';
 }else if(fx==='pattern'){
   const step=Math.max(16,Math.round(w/22));ctx.fillStyle=`rgba(255,255,255,${a*.22})`;
   for(let y=step/2;y<h;y+=step){for(let x=step/2;x<w;x+=step){
     ctx.beginPath();ctx.arc(x,y,Math.max(1,step*.09),0,Math.PI*2);ctx.fill();
   }}
 }else if(fx==='kaleido'){
   const snap=document.createElement('canvas');snap.width=w;snap.height=h;snap.getContext('2d').drawImage(canvas,0,0);
   const alpha=.5+a*.5;ctx.globalAlpha=alpha;
   ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(snap,0,0,w/2,h,w/2,0,w/2,h);
 }

 ctx.restore();
}
