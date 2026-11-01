const DATA_URL = "./data/thought-nodes.json";
const journalContent = document.querySelector("#journalContent");
const panel = document.querySelector("#utilityPanel");
const mapButton = document.querySelector("#mapButton");
const closePanel = document.querySelector("#closePanel");
const nodeIndex = document.querySelector("#nodeIndex");
let nodes = [];

function escapeHTML(value=""){
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function linkifyText(value=""){
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  let html = "", lastIndex = 0;
  for(const match of String(value).matchAll(urlPattern)){
    html += escapeHTML(value.slice(lastIndex,match.index));
    const url = match[0];
    html += `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`;
    lastIndex = match.index + url.length;
  }
  return html + escapeHTML(value.slice(lastIndex));
}
function head(node){
  return `<header class="section-head"><span class="section-id">${escapeHTML(node.id)}</span><h1>${escapeHTML(node.title)}</h1><span class="head-star" aria-hidden="true">✦</span></header>`;
}
function renderPrimary(node){
  const b = node.body || [];
  const opening = b.slice(0,8).map((p,i)=>`<p${i===4?' class="highlight-line"':''}>${linkifyText(p)}</p>`).join("");
  const ideas = b.slice(8,12).map(p=>`<p>${linkifyText(p.replace(/^・/,""))}</p>`).join("");
  const closing = b.slice(12).map(p=>`<p>${linkifyText(p)}</p>`).join("");
  return `<section class="entry entry-primary" id="node-${escapeHTML(node.id)}" data-id="${escapeHTML(node.id)}">
    ${head(node)}
    <div class="prose primary-prose">${opening}</div>
    <div class="eye-divider" aria-hidden="true"><span></span></div>
    <div class="idea-panel"><span class="panel-hand" aria-hidden="true">☞</span><span class="panel-stars" aria-hidden="true">✦　✧</span>${ideas}<i>Useless<br>Beautiful<br>Ideas.</i></div>
    <div class="prose closing-prose">${closing}</div>
    <div class="moon-divider" aria-hidden="true"><span>☾</span><span>◦</span><span>☽</span></div>
  </section>`;
}
function renderSecondary(node){
  const paragraphs = (node.body||[]).map(p=>`<p>${linkifyText(p)}</p>`).join("");
  const extra = node.id === "1-2"
    ? `<div class="section-figure ghost-figure"><div class="tiny-ghost"><i></i><i></i></div><span>♡</span></div><div class="mini-medallion"><span>☾</span><small>それでも、<br>きっとどこかで<br>救われる。</small></div>`
    : node.id === "1-3"
      ? `<div class="section-figure clove-figure"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Clove%20(PSF).png" alt=""><span class="mini-bow"></span></div><div class="clove-card"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Clove%20(PSF).png" alt=""><small>丁子</small></div><div class="mini-seal">歯</div>`
      : `<div class="section-figure wish-figure">☾</div>`;
  return `<section class="entry entry-card entry-${escapeHTML(node.id)}" id="node-${escapeHTML(node.id)}" data-id="${escapeHTML(node.id)}">${head(node)}<div class="prose">${paragraphs}</div>${extra}</section>`;
}
function render(){
  journalContent.innerHTML = nodes.map(n=>n.id==='1-1'?renderPrimary(n):renderSecondary(n)).join('');
  nodeIndex.innerHTML = nodes.map(n=>`<a class="index-row" href="#node-${escapeHTML(n.id)}" data-index-id="${escapeHTML(n.id)}"><small>${escapeHTML(n.id)}</small><strong>${escapeHTML(n.title)}</strong></a>`).join('');
  document.querySelectorAll('[data-index-id]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();closeOverlay();jumpTo(link.dataset.indexId)}));
  const initial = location.hash.replace('#node-','');
  if(initial && nodes.some(n=>n.id===initial)) requestAnimationFrame(()=>jumpTo(initial,false));
}
function jumpTo(id,smooth=true){
  const target=document.querySelector(`[data-id="${CSS.escape(id)}"]`); if(!target)return;
  target.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start'}); history.replaceState(null,'',`#node-${id}`);
}
function openOverlay(){panel.hidden=false;mapButton.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';closePanel.focus({preventScroll:true})}
function closeOverlay(){panel.hidden=true;mapButton.setAttribute('aria-expanded','false');document.body.style.overflow=''}
mapButton.addEventListener('click',()=>panel.hidden?openOverlay():closeOverlay());
closePanel.addEventListener('click',()=>{closeOverlay();mapButton.focus()});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){closeOverlay();mapButton.focus()}});
fetch(DATA_URL).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}).then(data=>{nodes=data.nodes||[];render()}).catch(err=>{journalContent.innerHTML=`<section class="entry"><h1>記録を読み込めませんでした。</h1><p>${escapeHTML(String(err))}</p></section>`});
