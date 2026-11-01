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
  let html = "";
  let lastIndex = 0;
  for (const match of String(value).matchAll(urlPattern)) {
    html += escapeHTML(value.slice(lastIndex, match.index));
    const url = match[0];
    html += `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a>`;
    lastIndex = match.index + url.length;
  }
  html += escapeHTML(value.slice(lastIndex));
  return html;
}

function sectionHead(node){
  return `
    <header class="section-head">
      <div class="node-number">${escapeHTML(node.id)}</div>
      <div class="section-title-wrap">
        <h1 class="section-title">${escapeHTML(node.title)}</h1>
        <div class="section-title-rule" aria-hidden="true"></div>
      </div>
    </header>`;
}

function renderPrimary(node){
  const body = node.body || [];
  const opening = body.slice(0,8).map((p,index)=>{
    const cls = index === 4 ? "quote-highlight" : "";
    return `<p class="${cls}">${linkifyText(p)}</p>`;
  }).join("");

  const ideas = body.slice(8,12).map(p=>
    `<p class="idea-line">${linkifyText(p.replace(/^・/,""))}</p>`
  ).join("");

  const closing = body.slice(12).map(p=>`<p>${linkifyText(p)}</p>`).join("");

  return `
    <section class="node-section node-1-1" id="node-${escapeHTML(node.id)}" data-id="${escapeHTML(node.id)}">
      ${sectionHead(node)}
      <div class="prose">
        ${opening}
        <div class="idea-box">
          <span class="idea-ornament" aria-hidden="true"></span>
          ${ideas}
        </div>
        <div class="closing-group">${closing}</div>
      </div>
    </section>`;
}

function renderStandard(node){
  const classes = ["node-section", `node-${node.id}`];
  if(node.id === "1-2" || node.id === "1-3") classes.push("mini-section");

  const paragraphs = (node.body || []).map(p=>{
    const bullet = /^・/.test(p);
    return `<p${bullet ? ' class="idea-line"' : ""}>${linkifyText(bullet ? p.replace(/^・/,"") : p)}</p>`;
  }).join("");

  return `
    <section class="${classes.join(" ")}" id="node-${escapeHTML(node.id)}" data-id="${escapeHTML(node.id)}">
      ${sectionHead(node)}
      <div class="prose">${paragraphs}</div>
    </section>`;
}

function render(){
  journalContent.innerHTML = nodes.map(node => node.id === "1-1" ? renderPrimary(node) : renderStandard(node)).join("");

  nodeIndex.innerHTML = nodes.map(node => `
    <a class="index-row" href="#node-${escapeHTML(node.id)}" data-index-id="${escapeHTML(node.id)}">
      <small>${escapeHTML(node.id)}</small>
      <strong>${escapeHTML(node.title)}</strong>
    </a>
  `).join("");

  document.querySelectorAll("[data-index-id]").forEach(link=>{
    link.addEventListener("click",event=>{
      event.preventDefault();
      closeOverlay();
      jumpTo(link.dataset.indexId);
    });
  });

  const initial = location.hash.replace("#node-","");
  if(initial && nodes.some(node=>node.id === initial)) requestAnimationFrame(()=>jumpTo(initial,false));
}

function jumpTo(id,smooth=true){
  const target = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if(!target) return;
  target.scrollIntoView({behavior:smooth ? "smooth" : "auto",block:"start"});
  history.replaceState(null,"",`#node-${id}`);
}

function openOverlay(){
  panel.hidden = false;
  mapButton.setAttribute("aria-expanded","true");
  document.body.style.overflow = "hidden";
  closePanel.focus({preventScroll:true});
}

function closeOverlay(){
  panel.hidden = true;
  mapButton.setAttribute("aria-expanded","false");
  document.body.style.overflow = "";
}

mapButton.addEventListener("click",()=> panel.hidden ? openOverlay() : closeOverlay());
closePanel.addEventListener("click",()=>{closeOverlay();mapButton.focus()});

window.addEventListener("keydown",event=>{
  if(event.key === "Escape" && !panel.hidden){
    closeOverlay();
    mapButton.focus();
  }
});

const observer = new IntersectionObserver(entries=>{
  const visible = entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
  if(!visible) return;
  const id = visible.target.dataset.id;
  if(id) history.replaceState(null,"",`#node-${id}`);
},{rootMargin:"-30% 0px -55% 0px",threshold:[0,.1,.5]});

fetch(DATA_URL)
  .then(response=>{if(!response.ok) throw new Error(`HTTP ${response.status}`);return response.json()})
  .then(data=>{
    nodes = data.nodes || [];
    render();
    document.querySelectorAll(".node-section").forEach(section=>observer.observe(section));
  })
  .catch(error=>{
    journalContent.innerHTML = `<section class="node-section"><header class="section-head"><div class="node-number">ERR</div><div class="section-title-wrap"><h1 class="section-title">記録を読み込めませんでした。</h1></div></header><div class="prose"><p>${escapeHTML(String(error))}</p></div></section>`;
  });
