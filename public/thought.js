const DATA_URL = "./data/thought-nodes.json";

const rail = document.querySelector("#rail");
const branchNav = document.querySelector("#branchNav");
const panel = document.querySelector("#utilityPanel");
const mapButton = document.querySelector("#mapButton");
const closePanel = document.querySelector("#closePanel");
const nodeIndex = document.querySelector("#nodeIndex");
const trinketPanel = document.querySelector("#trinketPanel");
const trinketButton = document.querySelector("#trinketButton");
const closeTrinketPanel = document.querySelector("#closeTrinketPanel");
const readingModeButton = document.querySelector("#readingModeButton");
const playValentine = document.querySelector("#playValentine");
const playEye = document.querySelector("#playEye");
const drawerHandle = document.querySelector("#drawerHandle");
const trinketDrawer = document.querySelector("#trinketDrawer");
const tidyTrinkets = document.querySelector("#tidyTrinkets");
const moveableTrinkets = [...document.querySelectorAll(".moveable-trinket")];

let nodes = [];
let current = 0;

function escapeHTML(value=""){
  return value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function linkifyText(value=""){
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  let html = "";
  let lastIndex = 0;
  for (const match of value.matchAll(urlPattern)) {
    html += escapeHTML(value.slice(lastIndex, match.index));
    const url = match[0];
    html += `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`;
    lastIndex = match.index + url.length;
  }
  html += escapeHTML(value.slice(lastIndex));
  return html;
}

function render(){
  rail.innerHTML = nodes.map(node => `
    <article class="node" data-id="${escapeHTML(node.id)}" id="node-${escapeHTML(node.id)}">
      <div class="card">
        <div class="card-head">
          <p class="node-id">記録 ${escapeHTML(node.id)}</p>
          <p class="status-chip">記録済</p>
        </div>
        <h1>${escapeHTML(node.title)}</h1>
        <div class="body">
          ${node.body.map(p => `<p>${linkifyText(p)}</p>`).join("")}
        </div>
        <p class="card-note"><strong>取扱上の注意</strong>　この記録は閲覧用です。内容に異常がなければ、そのまま次へお進みください。</p>
      </div>
    </article>
  `).join("");

  nodeIndex.innerHTML = nodes.map(node => `
    <a class="index-row" href="#node-${escapeHTML(node.id)}" data-index-id="${escapeHTML(node.id)}">
      <small>${escapeHTML(node.id)}</small>
      <strong>${escapeHTML(node.title)}</strong>
    </a>
  `).join("");

  document.querySelectorAll("[data-index-id]").forEach(a=>{
    a.addEventListener("click", e=>{
      e.preventDefault();
      closeOverlay(panel, mapButton);
      jumpTo(a.dataset.indexId);
    });
  });

  updateBranches();
}

function updateBranches(){
  const node = nodes[current];
  if(!node){ branchNav.innerHTML=""; return; }
  const nextNode = node.next ? nodes.find(n=>n.id===node.next) : null;
  const children = (node.children || []).map(id=>nodes.find(n=>n.id===id)).filter(Boolean);
  const links = [];
  if(nextNode){
    links.push(`<button class="branch-link" type="button" data-target="${escapeHTML(nextNode.id)}">${escapeHTML(nextNode.id)} → ${escapeHTML(nextNode.title)}</button>`);
  }
  links.push(...children.map(child => `
    <button class="branch-link" type="button" data-target="${escapeHTML(child.id)}">
      ${escapeHTML(child.id)} ↘ ${escapeHTML(child.title)}
    </button>
  `));
  branchNav.innerHTML = links.join("");
  branchNav.querySelectorAll("[data-target]").forEach(btn=>{
    btn.addEventListener("click",()=>jumpTo(btn.dataset.target));
  });
}

function jumpTo(id){
  const i = nodes.findIndex(n=>n.id===id);
  if(i<0)return;
  current=i;
  document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:"smooth",inline:"center",block:"start"});
  history.replaceState(null,"",`#node-${id}`);
  updateBranches();
}

function syncFromScroll(){
  const wrap = document.querySelector(".rail-wrap");
  const cards = [...document.querySelectorAll(".node")];
  const center = wrap.scrollLeft + wrap.clientWidth/2;
  let best=0, dist=Infinity;
  cards.forEach((el,i)=>{
    const c = el.offsetLeft + el.offsetWidth/2;
    const d = Math.abs(c-center);
    if(d<dist){dist=d;best=i;}
  });
  if(best!==current){current=best;updateBranches();}
}

function closeAllOverlays(){
  closeOverlay(panel,mapButton,false);
  closeOverlay(trinketPanel,trinketButton,false);
  document.body.classList.remove("panel-open");
}

function openOverlay(target,button){
  closeAllOverlays();
  target.hidden=false;
  button.setAttribute("aria-expanded","true");
  document.body.classList.add("panel-open");
  target.querySelector("button")?.focus({preventScroll:true});
}

function closeOverlay(target,button,manageBody=true){
  if(!target) return;
  target.hidden=true;
  button?.setAttribute("aria-expanded","false");
  if(manageBody && panel.hidden && trinketPanel.hidden) document.body.classList.remove("panel-open");
}

mapButton.addEventListener("click",()=>openOverlay(panel,mapButton));
closePanel.addEventListener("click",()=>{closeOverlay(panel,mapButton);mapButton.focus()});
trinketButton.addEventListener("click",()=>openOverlay(trinketPanel,trinketButton));
closeTrinketPanel.addEventListener("click",()=>{closeOverlay(trinketPanel,trinketButton);trinketButton.focus()});

readingModeButton?.addEventListener("click",()=>{
  const active = document.body.classList.toggle("reading-mode");
  readingModeButton.setAttribute("aria-pressed",String(active));
  readingModeButton.textContent = active ? "装飾" : "読書";
});

playValentine?.addEventListener("click",()=>{
  const open = trinketPanel.classList.toggle("valentine-open");
  playValentine.setAttribute("aria-expanded",String(open));
});

playEye?.addEventListener("click",()=>{
  const closed = trinketPanel.classList.toggle("eye-closed");
  playEye.setAttribute("aria-pressed",String(closed));
});

drawerHandle?.addEventListener("click",()=>{
  const open = trinketPanel.classList.toggle("drawer-open");
  drawerHandle.setAttribute("aria-expanded",String(open));
  trinketDrawer.setAttribute("aria-hidden",String(!open));
});

function px(value){
  const n = Number.parseFloat(value || "0");
  return Number.isFinite(n) ? n : 0;
}

moveableTrinkets.forEach(item=>{
  let state = null;
  item.addEventListener("pointerdown",event=>{
    state={id:event.pointerId,x:event.clientX,y:event.clientY,dx:px(item.style.getPropertyValue("--dx")),dy:px(item.style.getPropertyValue("--dy"))};
    item.setPointerCapture(event.pointerId);
  });
  item.addEventListener("pointermove",event=>{
    if(!state || state.id!==event.pointerId) return;
    item.style.setProperty("--dx",`${state.dx + event.clientX - state.x}px`);
    item.style.setProperty("--dy",`${state.dy + event.clientY - state.y}px`);
  });
  const end=event=>{
    if(!state || state.id!==event.pointerId) return;
    if(item.hasPointerCapture(event.pointerId)) item.releasePointerCapture(event.pointerId);
    state=null;
  };
  item.addEventListener("pointerup",end);
  item.addEventListener("pointercancel",end);
});

function resetTrinkets(){
  trinketPanel.classList.remove("valentine-open","eye-closed","drawer-open");
  playValentine?.setAttribute("aria-expanded","false");
  playEye?.setAttribute("aria-pressed","false");
  drawerHandle?.setAttribute("aria-expanded","false");
  trinketDrawer?.setAttribute("aria-hidden","true");
  moveableTrinkets.forEach(item=>{
    item.style.removeProperty("--dx");
    item.style.removeProperty("--dy");
  });
}

tidyTrinkets?.addEventListener("click",resetTrinkets);

window.addEventListener("keydown",e=>{
  if(e.key==="Escape" && (!panel.hidden || !trinketPanel.hidden)){
    closeAllOverlays();
    return;
  }
  if(!panel.hidden || !trinketPanel.hidden) return;
  if(e.key==="ArrowRight" && current<nodes.length-1) jumpTo(nodes[current+1].id);
  if(e.key==="ArrowLeft" && current>0) jumpTo(nodes[current-1].id);
});

document.querySelector(".rail-wrap").addEventListener("scroll",()=>{
  clearTimeout(window.__syncTimer);
  window.__syncTimer=setTimeout(syncFromScroll,80);
},{passive:true});

fetch(DATA_URL)
  .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()})
  .then(data=>{
    nodes=data.nodes || [];
    render();
    const initial=location.hash.replace("#node-","");
    if(initial && nodes.some(n=>n.id===initial)) requestAnimationFrame(()=>jumpTo(initial));
  })
  .catch(err=>{
    rail.innerHTML=`<article class="node"><div class="card"><div class="card-head"><p class="node-id">ERROR</p></div><h1>記録を読み込めませんでした。</h1><div class="body"><p>${escapeHTML(String(err))}</p></div></div></article>`;
  });
