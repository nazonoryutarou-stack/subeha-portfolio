const canvas=document.querySelector('#crestCanvas');
const button=document.querySelector('#crestButton');
const live=document.querySelector('#crestMode');
const ctx=canvas.getContext('2d');
const source=new Image();
source.src='./hitotsu-ore-choji.png';
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');

const STATES=[
  {name:'原型',bulge:0,pinch:0,taper:0,wave:0,twist:0,shear:0,melt:0,fracture:0,stretch:1,breath:.02},
  {name:'くびれ',bulge:.08,pinch:.34,taper:0,wave:.01,twist:.02,shear:0,melt:0,fracture:0,stretch:1.04,breath:.05},
  {name:'膨張',bulge:.42,pinch:0,taper:-.04,wave:.02,twist:0,shear:0,melt:0,fracture:0,stretch:.94,breath:.08},
  {name:'ねじれ',bulge:.08,pinch:.04,taper:0,wave:.02,twist:.18,shear:.06,melt:0,fracture:0,stretch:1.02,breath:.05},
  {name:'波打ち',bulge:.02,pinch:0,taper:.03,wave:.12,twist:.04,shear:0,melt:0,fracture:0,stretch:1,breath:.04},
  {name:'融解',bulge:.12,pinch:.06,taper:.12,wave:.06,twist:.03,shear:.02,melt:.18,fracture:0,stretch:1.06,breath:.06},
  {name:'断層',bulge:0,pinch:.08,taper:0,wave:.025,twist:0,shear:.04,melt:.02,fracture:.12,stretch:1,breath:.04},
  {name:'偏位',bulge:.1,pinch:0,taper:-.1,wave:.04,twist:.08,shear:.17,melt:0,fracture:.02,stretch:.98,breath:.05},
  {name:'細身',bulge:-.12,pinch:.18,taper:0,wave:.015,twist:.03,shear:0,melt:0,fracture:0,stretch:1.22,breath:.03},
  {name:'過膨張',bulge:.55,pinch:-.08,taper:.06,wave:.04,twist:.04,shear:-.03,melt:.03,fracture:0,stretch:.9,breath:.09}
];

let w=640,h=640,mask=document.createElement('canvas');
let phaseOffset=0,raf=0,running=true,start=performance.now();
const cycleMs=3000,heartMs=1450;

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
function mix(a,b,t){return a+(b-a)*t}
function ease(t){return t*t*(3-2*t)}
function pulseAt(x,c,s){const q=(x-c)/s;return Math.exp(-q*q)}
function heartbeat(t){
  if(reduced.matches)return 0;
  const p=(t%heartMs)/heartMs;
  return clamp(pulseAt(p,.10,.035)*.9+pulseAt(p,.29,.05)*1.18);
}
function stateAt(t){
  const p=t/cycleMs+phaseOffset;
  const i=((Math.floor(p)%STATES.length)+STATES.length)%STATES.length;
  const n=(i+1)%STATES.length;
  const f=ease(p-Math.floor(p));
  const a=STATES[i],b=STATES[n],o={i,n,f,name:f<.5?a.name:b.name};
  for(const k of ['bulge','pinch','taper','wave','twist','shear','melt','fracture','stretch','breath'])o[k]=mix(a[k],b[k],f);
  return o;
}

function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  const r=canvas.getBoundingClientRect();
  const s=Math.min(520,Math.max(260,Math.round(Math.min(r.width,r.height)*dpr)));
  if(canvas.width===s&&canvas.height===s)return false;
  w=h=s;canvas.width=w;canvas.height=h;mask.width=w;mask.height=h;return true;
}

function buildMask(){
  if(!source.complete||!source.naturalWidth)return;
  const m=mask.getContext('2d',{willReadFrequently:true});
  m.clearRect(0,0,w,h);
  const pad=w*.14;
  m.drawImage(source,pad,pad,w-pad*2,h-pad*2);
  const img=m.getImageData(0,0,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){
    const lum=d[i]*.299+d[i+1]*.587+d[i+2]*.114;
    const ink=(255-lum)/255;
    const a=Math.round(d[i+3]*ink);
    d[i]=17;d[i+1]=17;d[i+2]=15;d[i+3]=a;
  }
  m.putImageData(img,0,0);
}

function warp(s,t,pulse){
  ctx.clearRect(0,0,w,h);
  const strips=118;
  const sh=h/strips;
  const cy=h/2;
  const beatScale=1+pulse*(.055+s.breath);

  ctx.save();
  ctx.translate(w/2,cy);
  ctx.scale(beatScale,1+pulse*.025);
  ctx.translate(-w/2,-cy);

  for(let i=0;i<strips;i++){
    const sy=i*sh;
    const u=(i+.5)/strips;
    const v=u*2-1;
    const center=Math.exp(-(v*v)/.16);
    const lower=Math.pow(u,4);
    const upper=Math.pow(1-u,3);
    const wave=Math.sin((u*3.1+t*.00055)*Math.PI*2);
    const twist=Math.sin(v*Math.PI);
    const band=((i>>2)&1)?1:-1;

    let width=1;
    width+=s.bulge*(1-v*v);
    width-=s.pinch*center;
    width+=s.taper*v;
    width+=Math.sin((u*2+t*.00022)*Math.PI*2)*s.wave*.16;
    width=clamp(width,.48,1.62);

    let dx=(w-w*width)/2;
    dx+=s.shear*v*w;
    dx+=s.twist*twist*w*.42;
    dx+=s.wave*wave*w;
    dx+=s.fracture*band*w*(.35+.65*Math.sin(u*Math.PI));
    dx+=Math.sin(t*.0012+u*8)*s.melt*lower*w*.15;

    const stretchedY=cy+(sy-cy)*s.stretch;
    let dy=stretchedY;
    dy+=s.melt*lower*w*.42;
    dy-=s.melt*upper*w*.03;
    dy+=Math.sin((u*4.2-t*.0007)*Math.PI*2)*s.wave*w*.025;

    let dh=sh*s.stretch+1.5;
    if(s.melt>.04)dh+=s.melt*lower*sh*3;

    ctx.globalAlpha=1;
    ctx.drawImage(mask,0,sy,w,sh+1,dx,dy,w*width,dh);
  }

  if(!reduced.matches){
    ctx.globalAlpha=.08+pulse*.08;
    ctx.drawImage(canvas,-w*.012,0);
    ctx.globalAlpha=.05+pulse*.06;
    ctx.drawImage(canvas,w*.014,0);
  }
  ctx.restore();
  ctx.globalAlpha=1;

  canvas.style.transform=`scale(${1+pulse*.035}) rotate(${Math.sin(t*.0005)*.45}deg)`;
}

function frame(now){
  const t=now-start;
  const s=stateAt(t);
  const p=heartbeat(t);
  warp(s,t,p);
  live.textContent=`一つ折れ丁子・${s.name}`;
  raf=requestAnimationFrame(frame);
}

function restart(){
  cancelAnimationFrame(raf);
  running=true;
  raf=requestAnimationFrame(frame);
}

source.addEventListener('load',()=>{resize();buildMask();restart()});
button.addEventListener('click',()=>{phaseOffset+=.62});
button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();phaseOffset+=.62}});
window.addEventListener('resize',()=>{if(resize())buildMask()});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){running=false;cancelAnimationFrame(raf)}
  else if(!running)restart();
});
