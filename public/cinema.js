/*
 CINEMA ENGINE — kinetic lettering and original canvas motion graphics.
 The manuscript remains only in data/thought-nodes.json; scenes quote it verbatim.
 Offscreen/hidden animation is stopped and reduced-motion always gets a static frame.
*/
(() => {
"use strict";
const story=document.getElementById("story");
if(!story)return;
const master=document.createElement("button");
master.type="button";
master.className="cinema-master";
master.textContent="演出を止める";
master.setAttribute("aria-label","モーショングラフィックスを一時停止する");
master.setAttribute("aria-pressed","false");
master.hidden=true;
document.body.appendChild(master);
const reducedQuery=matchMedia("(prefers-reduced-motion: reduce)");
const saveData=!!(navigator.connection&&navigator.connection.saveData);
const smallQuery=matchMedia("(max-width:640px)");
const lowPower=(navigator.hardwareConcurrency||4)<=2;
const SCENES={
"1-1":[
 ["歯","霊能者になった。","signature","歯","IDENTITY / THE AUTHOR"],
 ["雹","神に一服盛られたのだと思う。","hail","氷","11 NOV / 2019"],
 ["幽霊","目に見えないものは全て同じもので出来ている。","invisible","霊","INVISIBLE MATTER"],
 ["祭祀","人間のために働かせる行為を総称して祭祀と呼んでいる。","ritual","祭","RITUAL / ENGINEERING"],
 ["すべての歯が見える","名前一つで運勢も大きく変わる。","name","名","NAME / CHANGES"],
 ["酒","酒を飲んでふざけて","sake","酒","DAILY LOOP"],
 ["柿","柿とかも盗んだこと無いです。","persimmon","柿","OFFICIAL DENIAL"],
 ["だんじり","だんじりで出棺します。","danjiri","祭","FINAL OBJECTIVE"]
],
"1-2":[
 ["ブー","幽霊は怖い。","fear","怖","FEAR / MEASUREMENT"],
 ["朧気","そういう意味では、死は存在しない。","oboroge","魂","THE OTHER SIDE"],
 ["妖怪（笑）","見た目では区別がつかない。","yokai","妖","ORIGIN / MISCLASSIFIED"],
 ["1個体","1個体で1種を構成する。","species","種","ONE OF ONE"],
 ["400年","おおよそ400年をかけて朧気の海に溶けてしまうようだ。","decay","海","DISSOLUTION / 400 YEARS"],
 ["150ブー","何が起きても不思議ではない。","ecology","異","ECOLOGY / UNPREDICTABLE"],
 ["神","それを神と呼んでいる。","god","神","STRUCTURE / STABILITY"],
 ["どの世","あの世→その世→どの世","threshold","世","THE NEXT STAGE"]
]};
const states=[],visible=new Set();
let observer=null,frame=0,scrollFrame=0,lastFrame=0,token=0;
const TAU=2*Math.PI,clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const reduced=()=>reducedQuery.matches||saveData||document.documentElement.classList.contains("cinema-still")||document.documentElement.classList.contains("quiet-mode");
function random(seed){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
function chars(s){return typeof Intl.Segmenter==="function"
?[...new Intl.Segmenter("ja",{granularity:"grapheme"}).segment(s)].map(c=>c.segment):Array.from(s);}
function createBeat(chapter,i,scene){
 const [title,excerpt,mode,glyph,cue]=scene;
 const beat=document.createElement("section");
 beat.className="cinema-beat cinema--"+mode;
 beat.setAttribute("aria-label","第"+(i+1)+"場面 "+title+" のモーショングラフィックス");
 beat.dataset.scene=mode;
 beat.innerHTML=[
  '<canvas class="cinema-canvas" aria-hidden="true"></canvas>',
  '<div class="cinema-grid" aria-hidden="true"></div>',
  '<div class="cinema-paper-grain" aria-hidden="true"></div>',
  '<div class="cinema-glyph-bg" aria-hidden="true"></div>',
  '<div class="cinema-hud" aria-hidden="true"><span></span><span></span></div>',
  '<div class="cinema-layer" aria-hidden="true"><div class="cinema-kinetic"></div><div class="cinema-sub"></div></div>',
  '<span class="cinema-echo" aria-hidden="true"></span>',
  '<span class="cinema-index" aria-hidden="true"></span>',
  '<button type="button" class="cinema-switch">触れて干渉　✳</button>'
 ].join("");
 beat.querySelector(".cinema-hud span:first-child").textContent="SUBEHA / "+chapter;
 beat.querySelector(".cinema-hud span:last-child").textContent=cue;
 beat.querySelector(".cinema-glyph-bg").textContent=glyph;
 beat.querySelector(".cinema-echo").textContent=glyph;
 beat.querySelector(".cinema-index").textContent=String(i+1).padStart(2,"0");
 beat.querySelector(".cinema-sub").textContent=excerpt;
 const titleElement=beat.querySelector(".cinema-kinetic");
 const glyphs=chars(title);
 glyphs.forEach((c,j)=>{
   const element=document.createElement("span");
   element.className="cinema-char";element.style.setProperty("--ci",j);
   element.textContent=c;titleElement.appendChild(element);
 });
 if(glyphs.length>=8)titleElement.classList.add("is-long");
 else if(glyphs.length>=4)titleElement.classList.add("is-medium");
 beat.querySelector(".cinema-switch").setAttribute("aria-label",title+"の演出に干渉する");
 return beat;
}
function particles(seed,count){
 const r=random(seed);
 return Array.from({length:count},()=>({
  x:r(),y:r(),phase:r()*TAU,rate:.3+r(),size:1.2+r()*3.4,
  angle:r()*TAU,rad:r(),dir:r()>.5?1:-1
 }));
}
function makeState(el,mode,i){
 const canvas=el.querySelector(".cinema-canvas,.cinema-hero-canvas");
 const ctx=canvas && canvas.getContext && canvas.getContext("2d",{alpha:true});
 if(!ctx)return null;
 return {el,mode,i,canvas,ctx,w:0,h:0,dpr:1,on:false,energy:0,pausedAt:null,
   particles:particles(20261118+i*997+mode.length*181,smallQuery.matches?35:lowPower?38:68),
   px:.7,py:.5};
}
function resize(s){
 const rect=s.canvas.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height);
 if(!w||!h)return false;
 const dpr=Math.min(devicePixelRatio||1,smallQuery.matches?1.25:1.6);
 if(s.w!==w||s.h!==h||s.dpr!==dpr){
   s.w=w;s.h=h;s.dpr=dpr;
   s.canvas.width=Math.round(w*dpr);s.canvas.height=Math.round(h*dpr);
 }
 return true;
}
function point(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
function ring(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();}
function segment(ctx,x,y,xx,yy){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();}
function hail(ctx,s,t){
 ctx.save();const {w,h}=s;
 s.particles.forEach((p,i)=>{
  const yy=((p.y*h+t*h*(.09+p.rate*.12))%(h+100))-50;
  const xx=(p.x*w+yy*.19)%w,sz=p.size*(2+s.energy*.7);
  ctx.strokeStyle=i%4?"rgba(242,232,214,.63)":"rgba(228,91,84,.72)";
  ctx.lineWidth=1.1;
  ctx.beginPath();ctx.moveTo(xx,yy-sz);ctx.lineTo(xx+sz*.8,yy);
  ctx.lineTo(xx,yy+sz);ctx.lineTo(xx-sz*.8,yy);ctx.closePath();ctx.stroke();
  segment(ctx,xx-sz,yy-sz*2,xx-sz*2.5,yy-sz*5);
 });ctx.restore();
}
function orbit(ctx,s,t,kind){
 const {w,h}=s,cx=w*.7,cy=h*.48,R=Math.min(w,h)*.36;
 const time=s.pausedAt===null?t:s.pausedAt;
 ctx.save();
 for(let k=0;k<6;k++){
   const r=R*(.25+k*.15),a=time*(k%2?-.11:.14)+k*.3;
   ctx.strokeStyle=k%2?"rgba(242,222,203,.34)":"rgba(211,96,83,.25)";
   ctx.lineWidth=k%2?1.4:.8;ctx.setLineDash(k%2?[4,10]:[]);
   ctx.beginPath();ctx.arc(cx,cy,r,a,a+Math.PI*(.85+k*.17));ctx.stroke();
 }
 ctx.setLineDash([]);
 let previous=null;
 s.particles.forEach((p,i)=>{
   const a=p.angle+time*(kind==="god"?.035:.14)*p.rate*p.dir;
   const radius=R*(.13+p.rad*.94)*(kind==="god"?.68:1);
   const x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius*.79;
   ctx.fillStyle=i%7?"rgba(243,231,209,.69)":"rgba(239,99,87,.88)";
   point(ctx,x,y,p.size*.54);
   if(previous && i%4===0){ctx.strokeStyle="rgba(252,233,210,.16)";ctx.lineWidth=.7;segment(ctx,...previous,x,y);}
   previous=[x,y];
 });
 if(kind==="god"){
   ctx.fillStyle="rgba(238,216,190,.18)";point(ctx,cx,cy,R*.34);
   ctx.strokeStyle="rgba(238,216,190,.66)";ctx.lineWidth=3;ring(ctx,cx,cy,R*.29);
 }
 ctx.restore();
}
function dissolve(ctx,s,t){
 const {w,h}=s,cx=w*.66,cy=h*.43,R=Math.min(w,h)*.4;
 ctx.save();
 s.particles.forEach((p,i)=>{
   const age=(p.rad+t*(.014+p.rate*.009))%1;
   const spread=.3+age*2.5;
   const x=cx+Math.cos(p.angle)*R*p.x*spread;
   const y=cy+Math.sin(p.angle)*R*p.y*spread+age*h*.27;
   ctx.globalAlpha=Math.pow(1-age,.9)*.83;
   ctx.fillStyle=i%8?"#f3e5cc":"#e46c60";
   point(ctx,x,y,p.size*(1.6-age));
   if(i%3===0){ctx.strokeStyle="#f0d9c5";ctx.lineWidth=.6;segment(ctx,x,y,x+(p.x-.5)*24*age,y+18*age);}
 });ctx.globalAlpha=1;ctx.restore();
}
function tremor(ctx,s,t){
 const {w,h}=s,cx=w*.7,cy=h*.46;ctx.save();
 for(let i=0;i<8;i++){
   const r=24+i*31+Math.sin(t*.7+i)*7;
   ctx.strokeStyle=i%2?"rgba(247,220,199,.29)":"rgba(243,94,87,.42)";
   ctx.lineWidth=i%2?1:2;
   ctx.beginPath();
   for(let j=0;j<=40;j++){
     const angle=j/40*TAU;
     const v=r+Math.sin(angle*(i+5)+t*.58)*6;
     const x=cx+Math.cos(angle)*v,y=cy+Math.sin(angle)*v;
     if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
   }
   ctx.closePath();ctx.stroke();
 }
 s.particles.forEach((p,i)=>{
   const x=p.x*w+Math.sin(t+p.phase)*8,y=p.y*h+Math.cos(t*.6+p.phase)*6;
   ctx.fillStyle=i%4?"rgba(239,221,204,.31)":"rgba(243,87,78,.6)";
   point(ctx,x,y,p.size*.55);
 });ctx.restore();
}
function ecology(ctx,s,t){
 const {w,h}=s,cx=w*.72,cy=h*.48,R=Math.min(w,h)*.38;ctx.save();
 s.particles.forEach((p,i)=>{
   const a=p.angle+t*.07*p.dir;
   const x=cx+(p.x-.5)*R*1.8*Math.cos(a)-(p.y-.5)*R*Math.sin(a);
   const y=cy+(p.x-.5)*R*1.8*Math.sin(a)+(p.y-.5)*R*Math.cos(a);
   const sides=3+(i%5),radius=p.size*(3+i%5);
   ctx.strokeStyle=i%4?"rgba(247,233,211,.48)":"rgba(230,100,90,.85)";
   ctx.lineWidth=.9;ctx.beginPath();
   for(let j=0;j<=sides;j++){
     const a2=j*TAU/sides+a,xx=x+Math.cos(a2)*radius,yy=y+Math.sin(a2)*radius;
     if(!j)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
   }
   ctx.stroke();
 });ctx.restore();
}
function sake(ctx,s,t){
 const {w,h}=s;ctx.save();
 s.particles.forEach((p,i)=>{
   const y=h*(1-((p.y+t*(.021+p.rate*.027))%1));
   const x=w*(.42+p.x*.52)+Math.sin(t*.8+p.phase)*12;
   ctx.strokeStyle=i%4?"rgba(243,222,194,.5)":"rgba(249,89,83,.8)";
   ctx.lineWidth=1.2;
   ring(ctx,x,y,p.size*(1+s.energy));
 });ctx.restore();
}
function parade(ctx,s,t){
 const {w,h}=s;ctx.save();
 const x0=w*.37,baseline=h*.66;
 for(let i=0;i<14;i++){
   const x=x0+i*66-(t*26%66),size=18+(i%4)*9;
   ctx.fillStyle=i%3?"rgba(235,215,190,.3)":"rgba(237,96,81,.58)";
   ctx.fillRect(x,baseline-size,size*.7,size);
   ctx.strokeStyle="rgba(251,231,205,.6)";ctx.lineWidth=1.2;
   ctx.strokeRect(x,baseline-size,size*.7,size);
   segment(ctx,x+size*.32,baseline-size,x+size*.32,baseline-size-22);
 }
 ctx.strokeStyle="rgba(255,226,209,.25)";
 for(let i=0;i<6;i++)segment(ctx,x0,baseline+22*i,w,baseline+22*i);
 ctx.restore();
}
function stepping(ctx,s,t){
 const {w,h}=s,cx=w*.7;ctx.save();
 for(let i=0;i<7;i++){
   const z=((i+t*.16)%7)/7;
   const y=h*.3+Math.pow(z,1.5)*h*.59;
   const x=cx+Math.sin(i*2.35)*w*.23*z;
   const size=18+z*90;
   ctx.fillStyle=i===6?"rgba(240,96,86,.65)":"rgba(240,220,192,"+(.2+z*.5)+")";
   ctx.beginPath();ctx.moveTo(x-size/2,y);ctx.lineTo(x+size/2,y);
   ctx.lineTo(x+size*.42,y+size*.33);ctx.lineTo(x-size*.5,y+size*.33);
   ctx.closePath();ctx.fill();
 }
 ctx.strokeStyle="rgba(235,235,214,.23)";ctx.lineWidth=1.2;
 for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse(cx,h*.86,17+j*25,7+j*6,0,0,TAU);ctx.stroke();}
 ctx.restore();
}
function paint(s,ms){
 if(!resize(s))return;
 const ctx=s.ctx,t=ms*.001;
 ctx.setTransform(s.dpr,0,0,s.dpr,0,0);ctx.clearRect(0,0,s.w,s.h);
 if(s.mode==="hail"||s.mode==="portalHail")hail(ctx,s,t);
 else if(["invisible","ritual","oboroge","god","portalGhost"].includes(s.mode))orbit(ctx,s,t,s.mode);
 else if(s.mode==="decay")dissolve(ctx,s,t);
 else if(["fear","ecology","yokai"].includes(s.mode))tremor(ctx,s,t);
 else if(["signature","name","persimmon","species"].includes(s.mode))ecology(ctx,s,t);
 else if(s.mode==="sake")sake(ctx,s,t);
 else if(s.mode==="danjiri")parade(ctx,s,t);
 else if(s.mode==="threshold")stepping(ctx,s,t);
 if(s.energy>.015){
   const x=s.px*s.w,y=s.py*s.h;ctx.save();
   ctx.strokeStyle="rgba(255,225,198,"+(.57*s.energy)+")";ctx.lineWidth=2.5;
   const radius=12+(1-s.energy)*Math.min(s.w,s.h)*.62;
   ctx.beginPath();ctx.ellipse(x,y,radius,radius*.79,0,0,TAU);ctx.stroke();ctx.restore();
   s.energy*=.88;
 }else s.energy=0;
}
function updateLoop(){
 if(document.documentElement.classList.contains("quiet-mode")){
   if(frame){cancelAnimationFrame(frame);frame=0;}
   return;
 }
 if(reduced()){
   if(frame){cancelAnimationFrame(frame);frame=0;}
   for(const s of states){s.el.classList.add("is-on");paint(s,0);}
   return;
 }
 if(document.hidden||visible.size===0){if(frame){cancelAnimationFrame(frame);frame=0;}return;}
 if(!frame)frame=requestAnimationFrame(tick);
}
function tick(now){
 frame=0;
 if(document.hidden||reduced()||!visible.size)return;
 if(now-lastFrame<1000/(lowPower?24:30)){frame=requestAnimationFrame(tick);return;}
 lastFrame=now;
 for(const s of visible)paint(s,now);
 frame=requestAnimationFrame(tick);
}
function observe(s){
 if(observer)observer.observe(s.el);
 else{s.on=true;s.el.classList.add("is-on");visible.add(s);}
}
function clear(){
 token++;
 if(observer){observer.disconnect();observer=null;}
 if(frame){cancelAnimationFrame(frame);frame=0;}
 if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollFrame=0;}
 visible.clear();states.length=0;lastFrame=0;
 story.classList.remove("cinema-enhanced");
 master.hidden=true;
}
function addPortal(chapter){
 const hero=story.querySelector(".hero");if(!hero)return;
 const canvas=document.createElement("canvas");
 canvas.className="cinema-hero-canvas";canvas.setAttribute("aria-hidden","true");
 hero.prepend(canvas);
 const halo=document.createElement("span");
 halo.className="cinema-hero-halo";halo.setAttribute("aria-hidden","true");hero.appendChild(halo);
 const mark=document.createElement("span");
 mark.className="cinema-hero-mark";mark.setAttribute("aria-hidden","true");
 mark.textContent=chapter==="1-1"?"2019.11.11 / 01":"朧気 / 02";hero.appendChild(mark);
 const s=makeState(hero,chapter==="1-1"?"portalHail":"portalGhost",99);
 if(s){states.push(s);observe(s);}
}
function showCurtain(chapter){
 if(reduced())return;
 const intro=document.createElement("div");
 intro.className="cinema-intro";
 intro.dataset.chapter=chapter;
 intro.setAttribute("aria-hidden","true");
 const title=document.createElement("div");
 title.className="cinema-intro-word";
 title.textContent=story.querySelector(".hero h1")?.textContent||"";
 const code=document.createElement("span");
 code.className="cinema-intro-code";
 code.textContent="RITUAL NOTES / "+chapter;
 intro.append(code,title);
 story.prepend(intro);
 setTimeout(()=>{if(intro.isConnected)intro.remove();},1690);
}
function start(){
 clear();
 const chapter=story.dataset.node,config=SCENES[chapter];if(!config)return;
 const paragraphs=[...story.querySelectorAll(".article-content > section.entry,.article-content > section.gh-entry")];
 if(paragraphs.length!==8)return;
 if(!config.every((sc,i)=>paragraphs[i].querySelector(".copy")?.textContent.includes(sc[1])))return;
 story.classList.add("cinema-enhanced");
 master.hidden=false;
 master.textContent=document.documentElement.classList.contains("cinema-still")?"演出を再開":"演出を止める";
 master.setAttribute("aria-pressed",String(document.documentElement.classList.contains("cinema-still")));
 showCurtain(chapter);
 if("IntersectionObserver" in window){
   observer=new IntersectionObserver(entries=>{
     for(const e of entries){
       const s=states.find(x=>x.el===e.target);
       if(!s)continue;
       s.on=e.isIntersecting;
       if(s.on){visible.add(s);s.el.classList.add("is-on");}
       else visible.delete(s);
     }
     updateLoop();
   },{threshold:.025,rootMargin:"90px 0px 90px 0px"});
 }
 paragraphs.forEach((entry,i)=>{
   const sc=config[i],beat=createBeat(chapter,i,sc);
   entry.insertAdjacentElement("afterend",beat);
   const s=makeState(beat,sc[2],i);if(!s)return;
   states.push(s);
   const button=beat.querySelector(".cinema-switch");
   button.addEventListener("click",()=>{
     if(sc[2]==="god"){
       s.pausedAt=s.pausedAt===null?performance.now()*.001:null;
       button.textContent=s.pausedAt===null?"変化を止める　✳":"変化を戻す　↺";
     }else button.textContent="もう一度干渉　↺";
     s.energy=1;
     beat.classList.remove("is-struck");void beat.offsetWidth;beat.classList.add("is-struck");
     setTimeout(()=>{if(beat.isConnected)beat.classList.remove("is-struck");},900);
     updateLoop();
   });
   if(matchMedia("(hover:hover) and (pointer:fine)").matches){
     beat.addEventListener("pointermove",e=>{
       const r=beat.getBoundingClientRect();
       s.px=clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);
       s.py=clamp((e.clientY-r.top)/Math.max(1,r.height),0,1);
     },{passive:true});
   }
   observe(s);
 });
 addPortal(chapter);
 requestAnimationFrame(updateScroll);
 updateLoop();
}
function updateScroll(){
 scrollFrame=0;if(reduced())return;
 const height=innerHeight||700;
 for(const s of visible){
   if(s.i===99)continue;
   const r=s.el.getBoundingClientRect();
   const d=clamp((height*.5-(r.top+r.height*.5))/(height*.65+r.height*.5),-1,1);
   s.el.style.setProperty("--drive",d.toFixed(3));
 }
}
function onScroll(){if(!scrollFrame&&!reduced())scrollFrame=requestAnimationFrame(updateScroll);}
master.addEventListener("click",()=>{
 const still=document.documentElement.classList.toggle("cinema-still");
 master.textContent=still?"演出を再開":"演出を止める";
 master.setAttribute("aria-pressed",String(still));
 master.setAttribute("aria-label",still?"モーショングラフィックスを再開する":"モーショングラフィックスを一時停止する");
 updateLoop();
});
new MutationObserver(()=>updateLoop()).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
window.addEventListener("thought:render",start);
document.addEventListener("visibilitychange",updateLoop);
window.addEventListener("scroll",onScroll,{passive:true});
window.addEventListener("resize",()=>{for(const s of states){s.w=0;s.h=0;}updateLoop();onScroll();},{passive:true});
if(reducedQuery.addEventListener)reducedQuery.addEventListener("change",updateLoop);
if(story.dataset.node&&SCENES[story.dataset.node])start();
})();
