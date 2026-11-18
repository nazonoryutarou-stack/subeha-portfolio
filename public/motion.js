/* Motion layer: original manuscript stays in thought-nodes.json.
   No effects prevent reading or navigating, and all controls are usable by keyboard. */
(() => {
 "use strict";
 const story=document.getElementById("story");
 if(!story)return;
 const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
 const canObserve=typeof IntersectionObserver!=="undefined";
 let observer=null;
 let heroPointerTarget=null;
 let pointerFrame=0;
 let pointerX=0,pointerY=0;
 function prepareChapter(){
   if(observer){observer.disconnect();observer=null;}
   const entries=[...story.querySelectorAll(".entry,.gh-entry")];
   story.classList.remove("chapter-arrive");
   document.documentElement.classList.remove("motion-ready");
   if(!reduced.matches){
     story.classList.add("chapter-arrive");
     if(canObserve){
       observer=new IntersectionObserver(records=>{
         for(const record of records){
           if(record.isIntersecting){
             record.target.classList.add("motion-visible");
             observer.unobserve(record.target);
           }
         }
       },{rootMargin:"0px 0px 36px 0px",threshold:.04});
       entries.forEach(entry=>{entry.classList.remove("motion-visible");observer.observe(entry);});
       document.documentElement.classList.add("motion-ready");
     }
   } else {
     entries.forEach(entry=>entry.classList.add("motion-visible"));
   }
   const fear=story.querySelector("[data-fear]");
   if(fear){fear.style.setProperty("--fear","0%");fear.dataset.fearCount="0";}
   const stage=story.querySelector(".gh-final-stage");
   if(stage)stage.dataset.progress="0";
   heroPointerTarget=story.querySelector(".gh-hero, .hero-main");
 }
 window.addEventListener("thought:render",prepareChapter);
 if(story.querySelector(".hero"))prepareChapter();
 if(reduced.addEventListener)reduced.addEventListener("change",prepareChapter);
 function animateTap(button){
   if(reduced.matches)return;
   button.classList.remove("is-measuring");
   void button.offsetWidth;
   button.classList.add("is-measuring");
 }
 function measureFear(button){
   const previous=Number(button.dataset.fearCount)||0;
   const value=previous>=150?0:Math.min(150,previous+25);
   button.dataset.fearCount=String(value);
   button.style.setProperty("--fear",String(value/150*100)+"%");
   button.querySelector(".gh-fear-counter").textContent=value+" / 150";
   button.setAttribute("aria-label","怖さ "+value+" ブー。押すと増えます");
   button.classList.toggle("is-full",value===150);
   animateTap(button);
 }
 function stirMist(button,event){
   if(!reduced.matches){
     button.classList.remove("is-stirring");
     void button.offsetWidth;
     button.classList.add("is-stirring");
     const rect=button.getBoundingClientRect();
     const hasPointer=event.detail!==0&&Number.isFinite(event.clientX)&&Number.isFinite(event.clientY);
     const x=hasPointer?((event.clientX-rect.left)/rect.width)*100:50;
     const y=hasPointer?((event.clientY-rect.top)/rect.height)*100:50;
     for(let i=0;i<6;i++){
       const w=document.createElement("span");
       w.className="gh-wisp";
       w.setAttribute("aria-hidden","true");
       w.style.setProperty("--wx",Math.max(9,Math.min(91,x+(Math.random()-.5)*28))+"%");
       w.style.setProperty("--wy",Math.max(12,Math.min(88,y+(Math.random()-.5)*24))+"%");
       w.style.setProperty("--vx",Math.round((Math.random()-.5)*150)+"px");
       w.style.setProperty("--vy",Math.round((Math.random()-.5)*115)+"px");
       w.style.setProperty("--delay",i*65+"ms");
       button.appendChild(w);
       w.addEventListener("animationend",()=>w.remove(),{once:true});
     }
   }
 }
 function chooseMode(button){
   const group=button.closest(".gh-uptake-modes");
   if(!group)return;
   const selected=!button.classList.contains("is-active");
   group.querySelectorAll("[data-mode]").forEach(item=>{
     const active=selected&&item===button;
     item.classList.toggle("is-active",active);
     item.setAttribute("aria-pressed",String(active));
   });
 }
 function stabilize(button){
   const stable=button.classList.toggle("is-stable");
   button.setAttribute("aria-pressed",String(stable));
   button.setAttribute("aria-label",stable?"安定を解除する":"神の構造を安定させる");
   const label=button.querySelector("span");
   if(label)label.textContent=stable?"STRUCTURE / STABLE":"STRUCTURE / TOUCH TO STABILIZE";
 }
 function resetStage(stage){
   stage.dataset.progress="0";
   stage.classList.remove("is-cleared","is-failed");
   stage.querySelectorAll("[data-step]").forEach(stone=>stone.classList.remove("is-touched"));
 }
 function stepStage(button){
   const stage=button.closest(".gh-final-stage");
   if(!stage||stage.dataset.locked==="1")return;
   const status=stage.parentElement.querySelector(".gh-stage-status");
   let progress=Number(stage.dataset.progress)||0;
   const step=Number(button.dataset.step);
   if(progress===4){resetStage(stage);progress=0;}
   if(step===progress){
     button.classList.add("is-touched");
     stage.dataset.progress=String(progress+1);
     stage.classList.remove("is-failed");
     if(progress===3){
       stage.classList.add("is-cleared");
       if(status)status.textContent="その先は、まだ見えない。";
     }else if(status){
       status.textContent="足場 "+(progress+1)+" / 4";
     }
   }else{
     stage.classList.remove("is-failed");void stage.offsetWidth;
     stage.classList.add("is-failed");
     stage.style.setProperty("--splash-x",(10+step*25)+"%");
     if(status)status.textContent="落水。最初から。";
     stage.dataset.locked="1";
     window.setTimeout(()=>{
       if(!stage.isConnected)return;
       resetStage(stage);
       stage.dataset.locked="0";
     },750);
   }
 }
 story.addEventListener("click",event=>{
   const button=event.target.closest("button");
   if(!button||!story.contains(button))return;
   if(button.matches("[data-fear]"))measureFear(button);
   else if(button.matches("[data-mist]"))stirMist(button,event);
   else if(button.matches("[data-mode]"))chooseMode(button);
   else if(button.matches("[data-stabilize]"))stabilize(button);
   else if(button.matches("[data-step]"))stepStage(button);
 });
 function updatePointer(){
   pointerFrame=0;
   const target=heroPointerTarget;
   if(!target||!target.isConnected)return;
   const rect=target.getBoundingClientRect();
   if(rect.width===0||rect.height===0)return;
   const normX=Math.max(-1,Math.min(1,((pointerX-rect.left)/rect.width-.5)*2));
   const normY=Math.max(-1,Math.min(1,((pointerY-rect.top)/rect.height-.5)*2));
   if(target.classList.contains("gh-hero")){
     target.style.setProperty("--ghost-x",(normX*15).toFixed(1)+"px");
     target.style.setProperty("--ghost-y",(normY*11).toFixed(1)+"px");
   }else{
     target.style.setProperty("--hero-x",(normX*-9).toFixed(1)+"px");
     target.style.setProperty("--hero-y",(normY*-7).toFixed(1)+"px");
   }
 }
 if(window.matchMedia("(hover: hover) and (pointer: fine)").matches){
   story.addEventListener("pointermove",event=>{
     if(reduced.matches||!heroPointerTarget||!heroPointerTarget.contains(event.target))return;
     pointerX=event.clientX;pointerY=event.clientY;
     if(!pointerFrame)pointerFrame=window.requestAnimationFrame(updatePointer);
   },{passive:true});
   story.addEventListener("pointerleave",()=>{
     const target=heroPointerTarget;
     if(!target)return;
     for(const p of ["--ghost-x","--ghost-y","--hero-x","--hero-y"])target.style.removeProperty(p);
   },{passive:true});
 }
})();
