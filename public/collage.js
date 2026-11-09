"use strict";
// The manuscript remains in data/thought-nodes.json. This file only designs its presentation.
const el={
 story:document.querySelector("#story"),branch:document.querySelector("#branchNav"),
 rail:document.querySelector("#railList"),panel:document.querySelector("#utilityPanel"),
 menu:document.querySelector("#mapButton"),close:document.querySelector("#closePanel"),
 index:document.querySelector("#nodeIndex"),quiet:document.querySelector("#quietToggle")
};
let nodes=[],active=0,resizeTimer=null;
function clean(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function lines(v){return clean(v).replace(/\n/g,"<br>");}
function number(i){return String(i+1).padStart(2,"0");}
function para(v,i,klass){return "<span class='para-no' aria-hidden='true'>["+number(i)+"]</span><p class='copy "+(klass||"")+"'>"+lines(v)+"</p>";}
function asset(url,width){return "https://commons.wikimedia.org/wiki/Special:FilePath/"+url+"?width="+width;}
const img={
 buddha:asset("Head_of_Buddha_statue.jpg",900),
 persimmon:asset("PersimmonWatercolor.jpg",460),
 kappa:asset("SekienHyousube.jpg",420),
 danjiri:asset("2019_Danjiri_festival_at_Otori_Shrine008.jpg",1000)
};
function feature(node){
 const p=node.body;
 const first=p[2].indexOf("。"),sentence=first<0?p[2]:p[2].slice(0,first+1),rest=first<0?"":p[2].slice(first+1);
 return [
  "<header class='hero hero-main'>",
  "<canvas class='ink-canvas' aria-hidden='true'></canvas><div class='hero-brush deco' aria-hidden='true'></div>",
  "<div class='hero-sun deco' aria-hidden='true'></div>",
  "<figure class='hero-buddha deco'><img src='"+img.buddha+"' alt='' fetchpriority='high'></figure>",
  "<div class='hero-vertical deco' aria-hidden='true'>すべての歯が見える</div>",
  "<div class='hero-titles'><div class='hero-kicker'><b>1—1</b><span>CHAPTER ONE / INTRODUCTION</span></div>",
  "<h1>"+clean(node.title)+"</h1><div class='underline-ink deco' aria-hidden='true'></div><p class='hero-folio'>すべての歯が見える　 /　記録 001</p></div></header>",
  "<div class='article-content'>",
  "<section class='entry entry-first'><div class='giant-glyph deco' aria-hidden='true'>歯</div>",
  para(p[0],0,"lead"),"<span class='western-note deco' aria-hidden='true'>THE PERSON WHO SEES ALL THE TEETH</span></section>",
  "<section class='entry entry-hail'><div><span class='label'>DOCUMENT / 2019.11.11</span>",para(p[1],1),
  "</div><figure class='hail-figure deco'><img src='./art/hail-study.svg' alt='' loading='lazy'><figcaption>FIG. 01 — 雹の模式図</figcaption></figure></section>",
  "<section class='entry manifesto'><span class='label'>INVISIBLE THINGS / 仮説</span><span class='para-no' aria-hidden='true'>[03]</span>",
  "<p class='copy manifesto-copy'><span class='manifesto-lead'>"+lines(sentence)+"</span><span class='manifesto-remainder'>"+lines(rest)+"</span></p>",
  "<div class='manic-mark deco' aria-hidden='true'>✳</div></section>",
  "<section class='entry entry-ritual'><figure class='diagram deco'><img src='./art/ritual-chart.svg' loading='lazy' alt=''><figcaption>FIG. 02 — 祭祀の模式図</figcaption></figure><div><span class='label'>RITUAL / METHOD</span>",para(p[3],3),"</div></section>",
  "<section class='entry entry-name'><span class='background-name deco' aria-hidden='true'>名</span>",
  para(p[4],4),"<p class='echo-title deco' aria-hidden='true'>すべての<br>歯が見える</p></section>",
  "<section class='entry entry-drink'><div class='drink-poster deco' aria-hidden='true'><span>SAKE / REPEATEDLY</span><strong>酒</strong><i>酒　酒　酒　酒</i></div>",
  "<div><span class='label'>DAILY LIFE / EXORCISM</span>",para(p[5],5),"</div></section>",
  "<section class='entry entry-persimmon'><div>",para(p[6],6),"</div>",
  "<figure class='persimmon-figure deco'><img src='"+img.persimmon+"' loading='lazy' alt='柿の古い植物画'><figcaption>柿（盗んでない）</figcaption></figure></section>",
  "<section class='entry entry-funeral'><div class='funeral-sun deco' aria-hidden='true'></div><div class='funeral-copy'><span class='label'>FINAL OBJECTIVE</span>",para(p[7],7,"closing"),"</div>",
  "<figure class='danjiri-photo deco'><img src='"+img.danjiri+"' loading='lazy' alt='大阪のだんじり祭'><figcaption>だんじり / OSAKA</figcaption></figure></section>",
  "<aside class='footnote-panel'><div class='note-mark' aria-hidden='true'>注</div><p>"+lines(node.footnote||"")+"</p>",
  "<img class='kappa-img deco' src='"+img.kappa+"' loading='lazy' alt='鳥山石燕によるひょうすべ（河童の仲間）の画'></aside>",
  "<details class='asset-credits'><summary>図版出典とライセンス</summary>",
  "<p>仏頭：<a href='https://commons.wikimedia.org/wiki/File:Head_of_Buddha_statue.jpg' target='_blank' rel='noopener noreferrer'>Adbh266 / CC0</a>。",
  "柿：<a href='https://commons.wikimedia.org/wiki/File:PersimmonWatercolor.jpg' target='_blank' rel='noopener noreferrer'>Amanda A. Newton, 1887 / Public Domain</a>。",
  "ひょうすべ：<a href='https://commons.wikimedia.org/wiki/File:SekienHyousube.jpg' target='_blank' rel='noopener noreferrer'>鳥山石燕, 1781 / Public Domain</a>。",
  "だんじり：<a href='https://commons.wikimedia.org/wiki/File:2019_Danjiri_festival_at_Otori_Shrine008.jpg' target='_blank' rel='noopener noreferrer'>Naokijp / CC BY-SA 4.0</a>（モノクロ化・トリミング表示）。",
  "<a href='https://creativecommons.org/licenses/by-sa/4.0/' target='_blank' rel='noopener noreferrer'>ライセンス</a>。墨や模式図は本サイト用に制作。</p></details></div>"
 ].join("");
}
function ordinary(node){
 return "<header class='hero hero-regular'><div class='regular-orb deco' aria-hidden='true'></div>"+
 "<div class='regular-crest deco'><img src='./hitotsu-ore-choji.png' alt=''></div>"+
 "<div class='hero-titles'><div class='hero-kicker'><b>"+clean(node.id)+"</b><span>THOUGHT FRAGMENT</span></div>"+
 "<h1>"+clean(node.title)+"</h1></div></header>"+
 "<div class='article-content regular-content'>"+node.body.map((v,i)=>"<section class='entry regular-entry'>"+para(v,i)+"</section>").join("")+
 (node.footnote?"<aside class='footnote-panel'><div class='note-mark' aria-hidden='true'>注</div><p>"+lines(node.footnote)+"</p></aside>":"")+"</div>";
}
function navigation(){
 el.rail.innerHTML=nodes.map((node,i)=>"<a href='#node-"+clean(node.id)+"' data-go='"+clean(node.id)+"' class='rail-item "+(i===active?"selected":"")+"' "+(i===active?"aria-current='page'":"")+"><i></i><small>"+clean(node.id)+"</small><span>"+clean(node.title)+"</span></a>").join("");
 el.index.innerHTML=nodes.map((node,i)=>"<a href='#node-"+clean(node.id)+"' data-go='"+clean(node.id)+"' class='index-row "+(i===active?"selected":"")+"'><small>"+clean(node.id)+"</small><strong>"+clean(node.title)+"</strong><span>↗</span></a>").join("");
 const node=nodes[active],previous=nodes[active-1],next=node.next?nodes.find(n=>n.id===node.next):nodes[active+1];
 const children=(node.children||[]).map(id=>nodes.find(n=>n.id===id)).filter(Boolean);
 el.branch.innerHTML="<div class='branch-label'><span>THE NEXT FRAGMENT</span><span>"+clean(node.id)+" / "+nodes.length+" NODES</span></div>"+
 "<div class='branch-links'>"+
 (previous?"<a href='#node-"+clean(previous.id)+"' data-go='"+clean(previous.id)+"' class='branch-prev'><small>← BACK</small><strong>"+clean(previous.id)+" "+clean(previous.title)+"</strong></a>":"<span></span>")+
 "<div>"+(next?"<a href='#node-"+clean(next.id)+"' data-go='"+clean(next.id)+"' class='branch-next'><small>NEXT →</small><strong>"+clean(next.id)+" "+clean(next.title)+"</strong></a>":"<span class='branch-end'>ここまで</span>")+
 children.map(n=>"<a href='#node-"+clean(n.id)+"' data-go='"+clean(n.id)+"' class='branch-next'><small>BRANCH ↘</small><strong>"+clean(n.id)+" "+clean(n.title)+"</strong></a>").join("")+"</div></div>";
}
function drawInk(){
 if(document.documentElement.classList.contains("quiet-mode"))return;
 const canvas=document.querySelector(".ink-canvas");if(!canvas)return;
 const box=canvas.getBoundingClientRect(),w=Math.round(box.width),h=Math.round(box.height);if(!w||!h)return;
 const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
 const ctx=canvas.getContext("2d");if(!ctx)return;ctx.scale(ratio,ratio);
 let seed=11092019;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let j=0;j<23;j++){const y=h*(.05+rand()*.9);ctx.beginPath();ctx.moveTo(w*(.44+rand()*.25),y);
 ctx.bezierCurveTo(w*.75,y+(rand()-.5)*60,w*.86,y+(rand()-.5)*75,w*(.9+rand()*.13),y+(rand()-.5)*80);
 ctx.strokeStyle="rgba(20,19,18,"+(0.04+rand()*.14)+")";ctx.lineWidth=1+rand()*10;ctx.stroke();}
 for(let i=0;i<125;i++){ctx.beginPath();ctx.arc(w*(.2+rand()*.85),h*(rand()*.96),.4+rand()*2.5,0,Math.PI*2);
 ctx.fillStyle="rgba(20,19,18,"+(rand()*.26)+")";ctx.fill();}
}
function closeMenu(focus){el.panel.hidden=true;document.body.classList.remove("index-open");el.menu.setAttribute("aria-expanded","false");if(focus)el.menu.focus();}
function openMenu(){el.panel.hidden=false;document.body.classList.add("index-open");el.menu.setAttribute("aria-expanded","true");el.close.focus();}
function show(id,changeHistory){
 const index=nodes.findIndex(node=>node.id===id);if(index===-1)return;
 active=index;const node=nodes[index];el.story.innerHTML=node.id==="1-1"?feature(node):ordinary(node);
 el.story.dataset.node=node.id;document.title=node.id+" "+node.title+" — すべての歯が見える";
 navigation();if(changeHistory)history.pushState(null,"","#node-"+node.id);
 closeMenu(false);window.scrollTo(0,0);requestAnimationFrame(drawInk);
}
function syncHash(){const id=decodeURIComponent(location.hash.replace(/^#node-/,""));show(nodes.some(n=>n.id===id)?id:nodes[0].id,false);}
document.addEventListener("click",e=>{const a=e.target.closest("[data-go]");if(a){e.preventDefault();show(a.dataset.go,true);}});
el.menu.addEventListener("click",openMenu);
el.close.addEventListener("click",()=>closeMenu(true));
el.panel.addEventListener("click",e=>{if(e.target===el.panel)closeMenu(true);});
el.quiet.addEventListener("click",()=>{
 const quiet=document.documentElement.classList.toggle("quiet-mode");el.quiet.setAttribute("aria-pressed",String(quiet));
 el.quiet.textContent=quiet?"装飾を戻す":"装飾を減らす";if(!quiet)requestAnimationFrame(drawInk);
});
window.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!el.panel.hidden){closeMenu(true);return;}
 if(!el.panel.hidden||["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
 if(e.key==="ArrowRight"&&nodes[active+1])show(nodes[active+1].id,true);
 if(e.key==="ArrowLeft"&&nodes[active-1])show(nodes[active-1].id,true);
});
let tx=0,ty=0;
document.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});
document.addEventListener("touchend",e=>{
 if(!el.panel.hidden||e.changedTouches.length!==1)return;
 const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
 if(Math.abs(dx)<110||Math.abs(dx)<2.3*Math.abs(dy))return;
 const destination=nodes[active+(dx<0?1:-1)];if(destination)show(destination.id,true);
},{passive:true});
window.addEventListener("hashchange",()=>nodes.length&&syncHash());
window.addEventListener("popstate",()=>nodes.length&&syncHash());
window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawInk,180);},{passive:true});
fetch("./data/thought-nodes.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();})
.then(data=>{nodes=Array.isArray(data.nodes)?data.nodes:[];if(!nodes.length)throw new Error("断章データが空です");syncHash();})
.catch(err=>{el.story.innerHTML="<div class='error-paper'><h1>本文を読み込めませんでした。</h1><p>"+clean(err)+"</p><a href='./'>入口へ戻る</a></div>";});