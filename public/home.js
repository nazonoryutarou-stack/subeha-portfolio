const canvas=document.querySelector('#crestCanvas');
const button=document.querySelector('#crestButton');
const live=document.querySelector('#crestMode');
const ctx=canvas.getContext('2d');
const source=new Image();
source.src='./hitotsu-ore-choji.png';
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');

const STATES=[
  {name:'墨肉',fg:[18,16,13],bg:[14,12,10],glow:[160,92,68],sat:.4,con:1.45,inv:0,sep:.15,blur:.2,slice:2,ghost:.08,spin:-.3},
  {name:'液晶残像',fg:[70,245,255],bg:[5,12,18],glow:[0,220,255],sat:1.8,con:1.25,inv:.05,sep:0,blur:.6,slice:12,ghost:.38,spin:.4},
  {name:'祈祷金箔',fg:[238,190,84],bg:[24,15,7],glow:[255,213,118],sat:1.35,con:1.1,inv:0,sep:.5,blur:.25,slice:3,ghost:.12,spin:-.15},
  {name:'焼印',fg:[205,63,28],bg:[18,7,4],glow:[255,72,24],sat:1.5,con:1.5,inv:0,sep:.65,blur:.85,slice:5,ghost:.16,spin:.2},
  {name:'複写機亡霊',fg:[216,216,210],bg:[8,8,8],glow:[255,255,255],sat:0,con:2.1,inv:.08,sep:0,blur:.35,slice:18,ghost:.5,spin:-.55},
  {name:'深海ネオン',fg:[45,153,255],bg:[3,8,18],glow:[33,102,255],sat:1.85,con:1.2,inv:0,sep:0,blur:1.1,slice:9,ghost:.32,spin:.25},
  {name:'網点祝祭',fg:[255,86,167],bg:[25,5,18],glow:[255,80,204],sat:2,con:1.35,inv:.03,sep:0,blur:.25,slice:14,ghost:.28,spin:-.4},
  {name:'輪郭標本',fg:[230,240,242],bg:[7,10,11],glow:[170,235,255],sat:.25,con:1.75,inv:.12,sep:0,blur:.05,slice:4,ghost:.18,spin:.12},
  {name:'生体逆光',fg:[255,190,215],bg:[16,6,13],glow:[255,110,165],sat:1.55,con:1.18,inv:.02,sep:.12,blur:1.35,slice:7,ghost:.4,spin:.5},
  {name:'崩落写本',fg:[138,105,63],bg:[15,11,7],glow:[214,152,72],sat:.72,con:1.52,inv:.02,sep:.58,blur:.55,slice:21,ghost:.22,spin:-.2}
];

let dpr=1,w=640,h=640,base=document.createElement('canvas'),mask=document.createElement('canvas');
let phaseOffset=0,last=performance.now(),hiddenAt=0;
const cycleMs=3300,heartMs=1480;

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v))}
function mix(a,b,t){return a+(b-a)*t}
function ease(t){return t*t*(3-2*t)}
function rgb(a,b,t){return a.map((v,i)=>Math.round(mix(v,b[i],t)))}
function rgba(c,a){return `rgba(${c[0]},${c[1]},${c[2]},${a})`}
function pulseAt(x,c,s){const q=(x-c)/s;return Math.exp(-q*q)}
function heartbeat(t){if(reduced.matches)return 0;const p=(t%heartMs)/heartMs;return clamp(pulseAt(p,.10,.035)*.85+pulseAt(p,.29,.05)*1.15)}
function stateAt(t){
  const p=t/cycleMs+phaseOffset;
  const i=((Math.floor(p)%STATES.length)+STATES.length)%STATES.length;
  const n=(i+1)%STATES.length;
  const f=ease(p-Math.floor(p));
  const a=STATES[i],b=STATES[n];
  return {i,n,f,name:f<.5?a.name:b.name,fg:rgb(a.fg,b.fg,f),bg:rgb(a.bg,b.bg,f),glow:rgb(a.glow,b.glow,f),sat:mix(a.sat,b.sat,f),con:mix(a.con,b.con,f),inv:mix(a.inv,b.inv,f),sep:mix(a.sep,b.sep,f),blur:mix(a.blur,b.blur,f),slice:mix(a.slice,b.slice,f),ghost:mix(a.ghost,b.ghost,f),spin:mix(a.spin,b.spin,f)};
}

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  const r=canvas.getBoundingClientRect();
  const s=Math.max(260,Math.round(Math.min(r.width,r.height)*dpr));
  if(canvas.width===s&&canvas.height===s)return;
  w=h=s;canvas.width=w;canvas.height=h;base.width=mask.width=w;base.height=mask.height=h;
  buildMask();
}
function buildMask(){
  if(!source.complete||!source.naturalWidth)return;
  const b=base.getContext('2d'),m=mask.getContext('2d');
  b.clearRect(0,0,w,h);m.clearRect(0,0,w,h);
  const pad=w*.14;
  b.drawImage(source,pad,pad,w-pad*2,h-pad*2);
  m.drawImage(base,0,0);
}
function tinted(c){
  const t=document.createElement('canvas');t.width=w;t.height=h;
  const x=t.getContext('2d');x.drawImage(mask,0,0);x.globalCompositeOperation='source-in';x.fillStyle=`rgb(${c.join(',')})`;x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';return t;
}
function drawSlices(img,t,s,p,alpha=1){
  const strips=56,sh=h/strips;
  ctx.globalAlpha=alpha;
  for(let i=0;i<strips;i++){
    const y=i*sh;
    const envelope=Math.sin(i*.53+t*.0023)*.5+.5;
    const dx=Math.sin(i*.81+t*.0037)*s*envelope*(.22+p*.9);
    const dy=Math.sin(i*.27-t*.0019)*s*.08;
    ctx.drawImage(img,0,y,w,sh+1,dx,y+dy,w,sh+1);
  }
  ctx.globalAlpha=1;
}
function ring(cx,cy,r,c,a,line){ctx.strokeStyle=rgba(c,a);ctx.lineWidth=line;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke()}

function frame(now){
  resize();
  const t=now;
  const s=stateAt(t),p=heartbeat(t);
  const fg=tinted(s.fg);
  const cx=w/2,cy=h/2;

  const g=ctx.createRadialGradient(cx,cy,w*.02,cx,cy,w*.58);
  g.addColorStop(0,rgba(s.glow,.16+p*.08));g.addColorStop(.38,rgba(s.bg,.92));g.addColorStop(1,rgba(s.bg,1));
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);

  const drift=Math.sin(t*.0012)*w*.007;
  const scale=1+p*.075;
  ctx.save();ctx.translate(cx+drift,cy);ctx.rotate(Math.sin(t*.0005)*s.spin*Math.PI/180);ctx.scale(scale*(1+p*.018),scale*(1-p*.025));ctx.translate(-cx,-cy);

  ctx.filter=`contrast(${s.con}) saturate(${s.sat}) invert(${s.inv}) sepia(${s.sep}) blur(${s.blur}px)`;
  ctx.globalCompositeOperation='screen';
  for(let k=3;k>=1;k--){
    ctx.globalAlpha=s.ghost*(.16*k)+p*.035;
    const off=(k*w*.008)*(Math.sin(t*.0014+k)*.5+.5);
    ctx.drawImage(fg,off*(k%2?1:-1),Math.cos(t*.0011+k)*off*.4);
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  drawSlices(fg,t,s.slice,p,1);

  ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=.08+p*.11;
  ctx.drawImage(fg,w*.012,0);ctx.drawImage(fg,-w*.012,0);
  ctx.globalAlpha=1;

  const sweep=(t*.00018)%1;
  const shine=ctx.createLinearGradient(0,0,w,h);
  shine.addColorStop(clamp(sweep-.18),'rgba(255,255,255,0)');
  shine.addColorStop(sweep,`rgba(255,248,226,${.13+p*.09})`);
  shine.addColorStop(clamp(sweep+.18),'rgba(255,255,255,0)');
  ctx.globalCompositeOperation='source-atop';ctx.fillStyle=shine;ctx.fillRect(0,0,w,h);
  ctx.restore();

  ctx.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){
    const q=(t*.00016+i*.23)%1;
    ring(cx,cy,w*(.19+q*.31+p*.01),s.glow,(1-q)*(.055+p*.05),Math.max(1,w*.0025*(1-q*.45)));
  }
  ring(cx,cy,w*(.355+p*.012),s.fg,.10+p*.11,Math.max(1,w*.003));

  const scan=ctx.createLinearGradient(0,0,0,h);scan.addColorStop(0,'rgba(255,255,255,0)');scan.addColorStop(.5,rgba(s.glow,.028+p*.018));scan.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=scan;ctx.fillRect(0,(Math.sin(t*.0015)*.5+.5)*h*.7,w,h*.3);
  ctx.globalCompositeOperation='source-over';

  canvas.style.transform=`scale(${1+p*.055}) rotate(${Math.sin(t*.00062)*.7}deg)`;
  canvas.style.filter=`drop-shadow(0 0 ${14+p*30}px ${rgba(s.glow,.11+p*.12)})`;
  live.textContent=`一つ折れ丁子・${s.name}`;
  requestAnimationFrame(frame);
}

source.addEventListener('load',()=>{resize();buildMask();requestAnimationFrame(frame)});
button.addEventListener('click',()=>{phaseOffset+=.58});
button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();phaseOffset+=.58}});
window.addEventListener('resize',()=>{resize();buildMask()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=performance.now();else if(hiddenAt){last+=performance.now()-hiddenAt;hiddenAt=0}});
