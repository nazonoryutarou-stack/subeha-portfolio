const DATA_URL = "./data/thought-nodes.json";

const rail = document.querySelector("#rail");
const branchNav = document.querySelector("#branchNav");
const panel = document.querySelector("#utilityPanel");
const mapButton = document.querySelector("#mapButton");
const closePanel = document.querySelector("#closePanel");
const nodeIndex = document.querySelector("#nodeIndex");

let nodes = [];
let current = 0;

function escapeHTML(value=""){
  return value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function render(){
  rail.innerHTML = nodes.map((node, i) => `
    <article class="node" data-id="${escapeHTML(node.id)}" id="node-${escapeHTML(node.id)}">
      <div class="card">
        <p class="node-id">${escapeHTML(node.id)}</p>
        <h1>${escapeHTML(node.title)}</h1>
        <div class="body">
          ${node.body.map(p => `<p>${escapeHTML(p)}</p>`).join("")}
        </div>
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
      panel.hidden = true;
      jumpTo(a.dataset.indexId);
    });
  });

  updateBranches();
}

function updateBranches(){
  const node = nodes[current];
  if(!node){ branchNav.innerHTML=""; return; }
  const children = (node.children || []).map(id=>nodes.find(n=>n.id===id)).filter(Boolean);
  branchNav.innerHTML = children.map(child => `
    <button class="branch-link" type="button" data-target="${escapeHTML(child.id)}">
      ${escapeHTML(child.id)} → ${escapeHTML(child.title)}
    </button>
  `).join("");
  branchNav.querySelectorAll("[data-target]").forEach(btn=>{
    btn.addEventListener("click",()=>jumpTo(btn.dataset.target));
  });
}

function jumpTo(id){
  const i = nodes.findIndex(n=>n.id===id);
  if(i<0)return;
  current=i;
  document.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});
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

mapButton.addEventListener("click",()=>{panel.hidden=false;mapButton.setAttribute("aria-expanded","true")});
closePanel.addEventListener("click",()=>{panel.hidden=true;mapButton.setAttribute("aria-expanded","false")});
window.addEventListener("keydown",e=>{
  if(!panel.hidden && e.key==="Escape"){panel.hidden=true;return}
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
    rail.innerHTML=`<article class="node"><div class="card"><p class="node-id">ERROR</p><h1>記録を読み込めませんでした。</h1><div class="body"><p>${escapeHTML(String(err))}</p></div></div></article>`;
  });
