import fs from 'node:fs';
import path from 'node:path';

const dataPath = process.argv[2] || 'public/data/thought-nodes.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const publicDir = path.resolve(path.dirname(dataPath), '..');
const outDir = path.join(publicDir, 'thought');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const slug = s => String(s).replace(/[^0-9A-Za-z_-]/g,'-');
function hash(str){let h=2166136261; for(const ch of str){h^=ch.charCodeAt(0); h=Math.imul(h,16777619)} return h>>>0}
function rng(seed){let a=seed>>>0; return ()=>{a+=0x6D2B79F5; let t=a; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296}}
function pick(r,a){return a[Math.floor(r()*a.length)]}

const themes = {
  cosmic:{accent:'#8c3150', soft:'#e7a7bc', dark:'#130e12', motif:'☾', pool:['star','moon','eye','photo','seal','ribbon','tag']},
  apparition:{accent:'#74334f', soft:'#d9b4c3', dark:'#161015', motif:'◉', pool:['ghost','eye','locket','ribbon','star','seal','heart']},
  botanical:{accent:'#7b263f', soft:'#d49ab0', dark:'#150e11', motif:'✣', pool:['sprig','specimen','ribbon','seal','star','tag','eye']},
  wish:{accent:'#78415b', soft:'#dbc6d5', dark:'#161116', motif:'✦', pool:['star','bottle','moon','heart','tag','seal','ribbon']}
};
function detectTheme(node){
  const t=(node.title+' '+(node.body||[]).join(' '));
  if(/丁子|グローブ|スパイス|家紋/.test(t)) return 'botanical';
  if(/幽霊|霊視|霊|力|麻酔/.test(t)) return 'apparition';
  if(/幸せ|肝臓|世界/.test(t) && (node.body||[]).length<=3) return 'wish';
  return 'cosmic';
}

function decorMarkup(node, themeName){
  const theme=themes[themeName]; const r=rng(hash(node.id+'|'+node.title));
  const items=[]; const count=10 + Math.min(6, Math.floor((node.body||[]).join('').length/120));
  const sides=['left','right'];
  for(let i=0;i<count;i++){
    const type=pick(r,theme.pool); const side=sides[i%2];
    const top=(7+r()*84).toFixed(2); const rot=(-13+r()*26).toFixed(1); const scale=(0.78+r()*.5).toFixed(2);
    items.push(`<span class="orn orn-${type} orn-${side}" style="--top:${top}%;--rot:${rot}deg;--scale:${scale}" aria-hidden="true"></span>`);
  }
  return items.join('\n');
}

function paragraphHTML(node, idx, p, themeName){
  const text=esc(p.replace(/^・/,''));
  if(/^・/.test(p)) return `<li>${text}</li>`;
  const len=p.length;
  const highlight = idx===Math.min(4,(node.body||[]).length-1) && len<80;
  const pull = themeName==='wish' || ((idx===1||idx===2) && len<42 && (node.body||[]).length<7);
  return `<p${highlight?' class="marker"':pull?' class="pull"':''}>${text}</p>`;
}

function bodyHTML(node, themeName){
  const body=node.body||[]; let html=''; let list=[];
  const flush=()=>{ if(list.length){html+=`<ul class="idea-box">${list.join('')}</ul>`;list=[]} };
  body.forEach((p,i)=>{
    if(/^・/.test(p)){list.push(paragraphHTML(node,i,p,themeName)); return}
    flush(); html+=paragraphHTML(node,i,p,themeName);
    if(i===Math.floor(body.length/2)-1 && body.length>6) html+=`<div class="mid-rule" aria-hidden="true"><span>${themes[themeName].motif}</span></div>`;
  }); flush();
  return html;
}

function navFor(node, nodes){
  const i=nodes.findIndex(n=>n.id===node.id); const prev=nodes[i-1]; const next=node.next?nodes.find(n=>n.id===node.next):nodes[i+1];
  return `<nav class="page-nav" aria-label="断章の移動">
    ${prev?`<a class="nav-prev" href="./${slug(prev.id)}.html"><small>PREV</small><span>${esc(prev.title)}</span></a>`:'<span></span>'}
    ${next?`<a class="nav-next" href="./${slug(next.id)}.html"><small>NEXT</small><span>${esc(next.title)}</span></a>`:'<span></span>'}
  </nav>`;
}

function indexLinks(nodes,current){return nodes.map(n=>`<a class="index-link${n.id===current?' is-current':''}" href="./${slug(n.id)}.html"><small>${esc(n.id)}</small><span>${esc(n.title)}</span></a>`).join('')}

function page(node,nodes){
  const themeName=detectTheme(node); const theme=themes[themeName];
  const short=(node.body||[]).join('').length<90;
  return `<!doctype html>
<html lang="ja" style="--accent:${theme.accent};--soft:${theme.soft};--night:${theme.dark}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="${esc(node.title)} — すべての歯が見えるの断章。">
<meta name="theme-color" content="${theme.dark}">
<title>${esc(node.id)} ${esc(node.title)}｜すべての歯が見える</title>
<link rel="stylesheet" href="./generated.css">
</head>
<body class="theme-${themeName}${short?' is-short':''}">
<div class="stage">
  <header class="masthead">
    <div class="mast-moon">☾</div>
    <div class="mast-title"><a href="../">すべての歯が見える</a><small>WORDS / OCCULT NOTE</small></div>
    <details class="menu"><summary><i></i><i></i><i></i><small>MENU</small></summary><div class="menu-panel">${indexLinks(nodes,node.id)}</div></details>
  </header>
  <div class="side-field side-left" aria-hidden="true"><span class="vertical-note">OCCULT NOTE</span></div>
  <div class="side-field side-right" aria-hidden="true"><span class="vertical-phrase">見えるもの、見えないもの。</span></div>
  <div class="orn-field">${decorMarkup(node,themeName)}</div>
  <main class="paper-wrap">
    <article class="paper-card">
      <header class="article-head"><span class="node-id">${esc(node.id)}</span><h1>${esc(node.title)}</h1><div class="title-rule"></div></header>
      <section class="prose">${bodyHTML(node,themeName)}</section>
      <div class="ending-rule" aria-hidden="true"><span>☾</span><b>✦</b><span>☽</span></div>
      ${navFor(node,nodes)}
    </article>
  </main>
  <footer class="stage-foot"><span>☾</span><p>この世界の、どうでもいいものたちへ</p><span>☽</span></footer>
</div>
</body>
</html>`;
}

const css=`:root{--paper:#f5eadb;--paper2:#ecddc9;--ink:#2c2022;--gold:#b99b69;--gold2:#ddc59c;--wine:#711e3b;--cream:#fff8ed}
*{box-sizing:border-box}html{background:#0f0b0e;color:var(--ink)}body{margin:0;min-height:100svh;background:radial-gradient(circle at 18% 6%,color-mix(in srgb,var(--accent) 28%,transparent),transparent 24%),linear-gradient(#100b0e,#171014 48%,#0e0a0d);font-family:"Yu Mincho","Hiragino Mincho ProN",serif;-webkit-font-smoothing:antialiased}.stage{position:relative;width:min(100%,980px);min-height:100svh;margin:auto;overflow:hidden;background:linear-gradient(90deg,rgba(255,255,255,.015),transparent 12% 88%,rgba(255,255,255,.015));box-shadow:0 0 90px #000}.stage:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,#d6ba8d 0 1px,transparent 1.4px);background-size:97px 111px;opacity:.18}.masthead{position:relative;z-index:20;height:138px;display:grid;grid-template-columns:100px 1fr 80px;align-items:center;padding:18px 20px;border-bottom:1px solid rgba(211,184,139,.45);color:#f4e7d5;background:linear-gradient(rgba(14,10,13,.94),rgba(21,14,18,.98))}.mast-moon{font-size:62px;color:#ceb48a;text-align:center;filter:drop-shadow(0 0 12px rgba(212,181,133,.25))}.mast-title{text-align:center}.mast-title a{display:block;color:inherit;text-decoration:none;font-size:clamp(30px,7vw,57px);letter-spacing:.08em;line-height:1.1}.mast-title small{display:block;margin-top:10px;font:600 10px/1 Georgia,serif;letter-spacing:.42em;color:#d7c0a0}.menu{position:relative;justify-self:end}.menu summary{list-style:none;width:58px;height:70px;display:grid;align-content:center;gap:7px;cursor:pointer}.menu summary::-webkit-details-marker{display:none}.menu summary i{width:34px;border-top:1px solid #f4e7d5;margin:auto}.menu summary small{text-align:center;font:600 8px/1 system-ui;letter-spacing:.25em}.menu-panel{position:absolute;right:0;top:72px;width:min(310px,82vw);padding:14px;background:#171014;border:1px solid #9d7d59;box-shadow:0 18px 50px rgba(0,0,0,.48)}.index-link{display:grid;grid-template-columns:54px 1fr;gap:9px;padding:11px 8px;color:#eadbca;text-decoration:none;border-bottom:1px solid rgba(212,184,140,.18)}.index-link:last-child{border-bottom:0}.index-link small{color:#b9996a}.index-link.is-current{background:rgba(126,38,70,.32)}
.paper-wrap{position:relative;z-index:5;padding:0 13.5% 54px}.paper-card{position:relative;min-height:1120px;padding:76px 9% 54px;background:linear-gradient(rgba(255,250,242,.96),rgba(244,232,215,.97)),repeating-linear-gradient(0deg,rgba(80,55,45,.03) 0 1px,transparent 1px 4px);border:1px solid #8a6f62;box-shadow:0 20px 60px rgba(0,0,0,.42),0 0 0 5px rgba(38,23,29,.95),0 0 0 7px rgba(186,153,102,.55)}.paper-card:before,.paper-card:after{content:"";position:absolute;top:0;bottom:0;width:12px;background:radial-gradient(circle at 6px 9px,transparent 0 4px,#e5d3bd 4.5px 5.5px,transparent 6px) 0 0/12px 18px repeat-y;opacity:.8}.paper-card:before{left:-10px}.paper-card:after{right:-10px}.article-head{position:relative;margin-bottom:34px}.node-id{font:500 clamp(19px,3.8vw,29px)/1 Georgia,serif;letter-spacing:.12em}.article-head h1{display:inline;margin:0 0 0 18px;font-size:clamp(29px,6.2vw,50px);font-weight:500;letter-spacing:.05em}.title-rule{height:1px;margin-top:13px;background:linear-gradient(90deg,#7c6459 0 82%,transparent)}.title-rule:after{content:"✦ ✧";float:right;transform:translateY(-8px);padding-left:9px;background:var(--paper);color:var(--gold);letter-spacing:.45em}.prose{display:grid;gap:1.35em}.prose p{margin:0;font-size:clamp(17px,2.45vw,22px);line-height:2.05;letter-spacing:.02em;text-wrap:pretty}.prose .marker{display:inline-block;justify-self:start;padding:6px 15px;background:linear-gradient(90deg,transparent,var(--soft) 12%,color-mix(in srgb,var(--soft) 72%,white) 84%,transparent);border-radius:18% 8% 20% 12%/45% 18% 35% 22%;font-size:clamp(18px,2.6vw,23px)}.prose .pull{margin:9px 0;padding:14px 17px;border-left:3px solid var(--accent);background:rgba(255,255,255,.28);font-size:clamp(19px,2.8vw,25px)}.idea-box{position:relative;list-style:none;margin:22px -2% 8px;padding:23px 28px 23px 42px;border:1px solid #a38670;background:linear-gradient(rgba(255,253,247,.72),rgba(237,222,202,.52));box-shadow:inset 0 0 0 4px rgba(255,251,243,.7)}.idea-box:before{content:"◉";position:absolute;left:50%;top:-18px;transform:translateX(-50%);padding:0 10px;background:var(--paper);color:#7a4457;font-size:24px}.idea-box li{position:relative;padding:10px 0 10px 19px;border-bottom:1px solid rgba(134,105,84,.2);font-size:clamp(16px,2.3vw,20px);line-height:1.75}.idea-box li:last-child{border-bottom:0}.idea-box li:before{content:"✣";position:absolute;left:-5px;color:var(--accent)}.mid-rule,.ending-rule{display:flex;align-items:center;gap:12px;margin:25px 0;color:var(--gold)}.mid-rule:before,.mid-rule:after,.ending-rule:before,.ending-rule:after{content:"";height:1px;flex:1;background:linear-gradient(90deg,transparent,#b89564,transparent)}.ending-rule{margin:38px 0 20px;justify-content:center}.ending-rule b{font-size:9px}.page-nav{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:24px;border-top:1px solid rgba(117,89,75,.26)}.page-nav a{display:grid;gap:5px;color:var(--ink);text-decoration:none}.page-nav small{font:700 8px/1 system-ui;letter-spacing:.25em;color:#8b6c5e}.nav-next{text-align:right}
.side-field{position:absolute;z-index:7;top:138px;bottom:55px;width:13.5%;pointer-events:none;background:linear-gradient(180deg,rgba(90,25,52,.38),rgba(26,15,20,.15) 45%,rgba(105,38,62,.28));border-left:1px solid rgba(188,153,101,.26);border-right:1px solid rgba(188,153,101,.26)}.side-left{left:0}.side-right{right:0}.vertical-note,.vertical-phrase{position:absolute;color:#d9c2a4;letter-spacing:.15em;font-size:11px}.vertical-note{left:24%;top:19%;writing-mode:vertical-rl}.vertical-phrase{right:23%;top:42%;writing-mode:vertical-rl;color:#c8af98}.orn-field{position:absolute;z-index:10;inset:138px 0 55px;pointer-events:none}.orn{position:absolute;top:var(--top);transform:rotate(var(--rot)) scale(var(--scale))}.orn-left{left:2.3%}.orn-right{right:2.3%}.orn-star{width:27px;height:27px}.orn-star:before{content:"✦";font-size:26px;color:var(--gold)}.orn-moon:before{content:"☾";font-size:36px;color:#d8c09b}.orn-eye{width:56px;height:34px;border:2px solid var(--gold);border-radius:70% 30%;background:#efe2d1}.orn-eye:before{content:"";position:absolute;left:50%;top:50%;width:17px;height:17px;border-radius:50%;background:#5f233d;box-shadow:inset 0 0 0 5px #171014;transform:translate(-50%,-50%)}.orn-ribbon{width:48px;height:74px;background:linear-gradient(90deg,#661a35,#a23b5d,#65142f);clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%)}.orn-seal{width:48px;height:48px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ad5362,#751c37 58%,#4b1023);box-shadow:0 6px 11px rgba(0,0,0,.28)}.orn-seal:before{content:"歯";position:absolute;inset:0;display:grid;place-items:center;color:#d8b8a6}.orn-tag{width:48px;height:92px;background:#eadac6;border:1px solid #9d7d66}.orn-tag:before{content:"すべての\A歯が見える";white-space:pre;position:absolute;inset:8px;writing-mode:vertical-rl;font-size:9px;line-height:1.4}.orn-ghost{width:46px;height:60px;border-radius:50% 50% 22% 22%;background:#f3e8da;box-shadow:0 5px 12px rgba(0,0,0,.18)}.orn-ghost:before{content:"··";position:absolute;left:14px;top:15px;letter-spacing:8px;color:#2e2225;font-weight:bold}.orn-heart:before{content:"♡";font-size:36px;color:#c77895}.orn-locket{width:52px;height:62px;border:3px solid var(--gold);border-radius:50%;background:radial-gradient(circle,#c59eac,#7d3554 55%,#28151d)}.orn-photo{width:54px;height:75px;background:linear-gradient(#201820,#4d3540);border:5px solid #eee0cc;box-shadow:0 4px 10px rgba(0,0,0,.3)}.orn-sprig{width:55px;height:60px}.orn-sprig:before{content:"✣\A ╱│╲";white-space:pre;position:absolute;color:#6b3b2e;font-size:22px;line-height:1.1}.orn-specimen{width:58px;height:78px;background:#efe0cd;border:1px solid #947361}.orn-specimen:before{content:"✣";position:absolute;inset:8px;display:grid;place-items:center;border:1px solid #b39a81;color:#6b3c2f;font-size:28px}.orn-bottle{width:42px;height:66px;border:2px solid #8f6b62;border-radius:4px 4px 12px 12px;background:linear-gradient(to top,rgba(125,35,65,.72) 0 55%,rgba(255,255,255,.14) 55%)}.orn-bottle:before{content:"";position:absolute;left:10px;right:10px;top:-12px;height:14px;border:2px solid #8f6b62;background:#d6bea4}.stage-foot{position:relative;z-index:15;height:55px;display:flex;align-items:center;justify-content:center;gap:18px;color:#d9c2a4;border-top:1px solid rgba(188,153,101,.32);background:#100c0e}.stage-foot p{margin:0;font-size:12px;letter-spacing:.12em}.is-short .paper-card{min-height:760px;display:flex;flex-direction:column;justify-content:center}.theme-botanical .paper-card{background:linear-gradient(rgba(255,249,239,.96),rgba(241,228,208,.98))}.theme-apparition .side-field{background:linear-gradient(180deg,rgba(88,42,68,.4),rgba(22,14,19,.12),rgba(87,28,51,.35))}.theme-wish .paper-card{background:linear-gradient(rgba(255,251,243,.98),rgba(242,232,220,.98))}
@media(max-width:640px){.stage{width:100%}.masthead{height:104px;grid-template-columns:60px 1fr 52px;padding:10px 8px}.mast-moon{font-size:42px}.mast-title a{font-size:clamp(24px,8vw,36px)}.mast-title small{font-size:7px;letter-spacing:.28em}.menu summary{width:48px}.paper-wrap{padding:0 10.5% 42px}.side-field{top:104px;bottom:48px;width:10.5%}.orn-field{inset:104px 0 48px}.paper-card{min-height:900px;padding:48px 8% 40px}.article-head h1{display:block;margin:8px 0 0;font-size:clamp(27px,8vw,38px)}.node-id{font-size:18px}.prose p{font-size:17px;line-height:1.96}.idea-box{margin:18px -4%;padding:22px 18px 22px 31px}.idea-box li{font-size:15px}.orn-left{left:.8%}.orn-right{right:.8%}.vertical-note,.vertical-phrase{font-size:8px}.stage-foot{height:48px}.stage-foot p{font-size:9px}.menu-panel{position:fixed;right:8px;top:88px}.page-nav{gap:8px}.page-nav a span{font-size:12px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;
fs.writeFileSync(path.join(outDir,'generated.css'), css);
for(const node of data.nodes||[]) fs.writeFileSync(path.join(outDir,`${slug(node.id)}.html`), page(node,data.nodes||[]));
const root=data.root || data.nodes?.[0]?.id;
fs.writeFileSync(path.join(outDir,'index.html'), `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="すべての歯が見えるの断章。"><title>断章｜すべての歯が見える</title><meta http-equiv="refresh" content="0;url=./${slug(root)}.html"></head><body><p><a href="./${slug(root)}.html">断章を読む</a></p></body></html>`);
console.log(`generated ${data.nodes.length} thought pages in ${outDir}`);
