/* すべての歯が見える / editorial reader */
const DATA_URL = "./data/thought-nodes.json";
const CONTENT = document.querySelector("#pageContent");
const INDEX = document.querySelector("#nodeIndex");
const RAIL = document.querySelector("#chapterRail");
const PANEL = document.querySelector("#utilityPanel");
const MAP = document.querySelector("#mapButton");
const CLOSE = document.querySelector("#closePanel");
const TOP = document.querySelector("#topButton");
const ASSETS = {
  buddha: "https://commons.wikimedia.org/wiki/Special:FilePath/Head_of_a_Buddha_image.jpg?width=850",
  hail: "https://commons.wikimedia.org/wiki/Special:FilePath/Hail_stones.jpg?width=800",
  danjiri: "https://commons.wikimedia.org/wiki/Special:FilePath/2019_Danjiri_festival_at_Otori_Shrine008.jpg?width=1100",
  hyosube: "https://commons.wikimedia.org/wiki/Special:FilePath/SekienHyousube.jpg?width=400"
};
let nodes = [];
let currentId = "";

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(ch){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
  });
}
function para(text, klass) {
  return '<p class="prose ' + (klass || '') + '">' + esc(text).replace(/\n/g, "<br>") + '</p>';
}
function panelPhoto(src, alt, klass) {
  return '<img loading="lazy" decoding="async" class="' + klass + '" src="' + src + '" alt="' + esc(alt) + '">';
}
function renderFeature(node) {
  const p = node.body;
  return [
    '<article class="feature-page" aria-labelledby="feature-title">',
      '<header class="feature-cover">',
        '<p class="microline">SUBETE NO HA GA MIERU <span>—</span> THE RITUAL NOTES / 001</p>',
        '<div class="cover-composition">',
          '<div class="ink-burst" aria-hidden="true"></div>',
          '<div class="cover-face">' + panelPhoto(ASSETS.buddha, "仏像の頭部の写真。ページの象徴的なコラージュ素材", "tone-image") + '</div>',
          '<div class="red-disc" aria-hidden="true"></div>',
          '<div class="cover-vertical" aria-hidden="true">すべての歯が見える</div>',
          '<div class="cover-title"><span class="number-ring">1-1</span><p class="microline">INTRODUCTION / WHO IS SUBEHA?</p><h1 id="feature-title">' + esc(node.title) + '</h1><span class="title-stroke" aria-hidden="true"></span></div>',
          '<span class="cover-seal" aria-hidden="true">歯</span>',
        '</div>',
      '</header>',
      '<div class="feature-body">',
        '<div class="colophon"><span>CHAPTER 01</span><span>PERSONAL NOTES &amp; RITUAL THEORY</span><span>READING / 1-1</span></div>',
        '<section class="prose-section section-opening"><div class="section-index">01 / ORIGIN</div>',
          para(p[0], "opening-text"),
          '<div class="small-seal" aria-hidden="true">自称<br>霊能</div>',
        '</section>',
        '<section class="prose-section two-up section-hail"><div class="prose-column"><div class="section-index">02 / NOVEMBER 11, 2019</div>',
          para(p[1]),
          '<span class="hand-note">神に一服盛られたのだと思う。</span></div>',
          '<figure class="photo-montage hail-montage"><div class="image-frame">' + panelPhoto(ASSETS.hail, "雹の参考写真（2019年の大阪の記録写真ではありません）", "tone-image") + '</div>',
          '<img class="kakigori" loading="lazy" src="./assets/kakigori-diagram.svg" alt="雹とかき氷の線画"><figcaption>FIG. 01 — 雹と氷菓の参考イメージ。写真は当日の記録ではありません。</figcaption></figure>',
        '</section>',
        '<section class="prose-section section-theory"><div class="section-index">03 / ON THE UNSEEN</div><div class="theory-grid"><div class="theory-copy">',
          para(p[2], "theory-text"),
          '<div class="red-rule" aria-hidden="true"></div></div>',
          '<figure class="orbit-figure"><img src="./assets/ritual-orbit.svg" loading="lazy" alt="重なる円と軌道による祭祀の概念図"><figcaption>RITUAL / STRUCTURE — 図式化された仮説</figcaption></figure></div>',
        '</section>',
        '<section class="prose-section section-ritual"><div class="section-index">04 / DEFINITIONS</div>',
          para(p[3]), '<span class="section-ghost" aria-hidden="true">祭<br>祀</span>',
        '</section>',
        '<section class="prose-section section-name"><div class="section-index">05 / NAMING</div>',
          '<div class="name-grid"><div>', para(p[4]), '</div><div class="nile-mark" aria-hidden="true"><img src="./hitotsu-ore-choji.png" alt=""><span>SMILE<br>IN THE NILE</span></div></div>',
        '</section>',
        '<section class="prose-section section-sake"><div class="section-index">06 / PROFESSIONAL LIFE</div>',
          '<p class="sake-label">愛されて7年目である。</p>',
          para(p[5]), '<span class="sake-stamp" aria-hidden="true">酒</span>',
        '</section>',
        '<section class="prose-section section-persimmon"><div class="section-index">07 / DECLARATION</div>',
          '<div class="persimmon-grid"><div>', para(p[6]), '</div>',
          '<figure><img src="./assets/persimmon-engraving.svg" loading="lazy" alt="柿の版画風イラスト"><figcaption>柿（盗んでない）</figcaption></figure></div>',
        '</section>',
        '<section class="prose-section section-funeral"><div class="section-index">08 / FINAL OBJECTIVE</div>',
          para(p[7], "final-text"),
          '<figure class="danjiri-figure"><div class="danjiri-photo">' + panelPhoto(ASSETS.danjiri, "大鳥大社でのだんじり祭。本文の内容を示す参考写真", "tone-image") + '</div><figcaption>FIG. 02 — だんじり祭の参考資料（2019年、大鳥大社）</figcaption></figure>',
        '</section>',
        '<aside class="kappa-footnote" aria-label="注釈"><div class="section-index">FOOTNOTE / ※</div>',
          '<div class="footnote-grid"><p>' + esc(node.footnote || "") + '</p>',
          '<figure>' + panelPhoto(ASSETS.hyosube, "鳥山石燕による妖怪「ひょうすべ」の絵。河童の一種とされる", "tone-image") + '<figcaption>鳥山石燕「ひょうすべ」（河童の類）</figcaption></figure></div>',
        '</aside>',
        '<div class="source-note"><p>IMAGE CREDITS / 素材</p><small>',
          '<a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:Head_of_a_Buddha_image.jpg">仏頭：Honey Kochphon Onshawee / CC0</a> ・ ',
          '<a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:Hail_stones.jpg">雹：Simiprof / CC0</a> ・ ',
          '<a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:2019_Danjiri_festival_at_Otori_Shrine008.jpg">だんじり：Naokijp / CC BY-SA 4.0</a> ',
          '（表示をモノクロ加工） ・ ',
          '<a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:SekienHyousube.jpg">ひょうすべ：鳥山石燕 / パブリックドメイン</a>',
          ' ・ 図版／墨の描画：当サイト制作</small>',
        '</div>',
      '</div>',
    '</article>'
  ].join("");
}
function renderGeneric(node) {
  return '<article class="generic-article"><header class="generic-cover"><p class="microline">SUBETE NO HA GA MIERU / ' + esc(node.id) + '</p><span class="number-ring">' + esc(node.id) + '</span><h1>' + esc(node.title) + '</h1><img src="./hitotsu-ore-choji.png" alt="" aria-hidden="true"></header><div class="generic-copy">' + (node.body || []).map(function(text){return para(text)}).join('') + '</div></article>';
}
function renderNav(node) {
  const prevIndex = nodes.findIndex(function(n){return n.id === node.id}) - 1;
  const prev = prevIndex >= 0 ? nodes[prevIndex] : null;
  const targets = [];
  if(prev) targets.push({id:prev.id,label:"前の断章"});
  if(node.next && nodes.some(function(n){return n.id === node.next})) targets.push({id:node.next,label:"次の断章"});
  (node.children || []).forEach(function(id){if(nodes.some(function(n){return n.id === id}))targets.push({id:id,label:"分岐"})});
  if(!targets.length) return '';
  return '<nav class="chapter-links" aria-label="前後の断章">' + targets.map(function(target){
    const t=nodes.find(function(n){return n.id===target.id});
    return '<a href="#node-' + esc(t.id) + '"><span>' + esc(target.label) + ' / ' + esc(t.id) + '</span><strong>' + esc(t.title) + '</strong><b aria-hidden="true">↗</b></a>';
  }).join('') + '</nav>';
}
function renderIndex() {
  const links=nodes.map(function(n){
    const sel=n.id === currentId;
    return '<a class="index-link ' + (sel ? 'is-current' : '') + '" href="#node-' + esc(n.id) + '" ' + (sel?'aria-current="page"':'') + '><span>' + esc(n.id) + '</span><strong>' + esc(n.title) + '</strong><b>↗</b></a>';
  }).join('');
  INDEX.innerHTML=links;
  RAIL.innerHTML='<p class="rail-label">CONTENTS / 断章一覧</p>' + links;
}
function renderCurrent() {
  if(!nodes.length) return;
  const id=decodeURIComponent(window.location.hash.replace(/^#node-/, ''));
  let node=nodes.find(function(n){return n.id===id});
  if(!node) node=nodes[0];
  currentId=node.id;
  document.title=node.id + ' ' + node.title + '｜すべての歯が見える';
  CONTENT.innerHTML=(node.id === '1-1' ? renderFeature(node) : renderGeneric(node)) + renderNav(node);
  renderIndex();
  window.scrollTo({top:0,behavior:'instant'});
  closeIndex();
}
function openIndex(){
  PANEL.hidden=false;
  MAP.setAttribute('aria-expanded','true');
  document.body.classList.add('index-open');
  CLOSE.focus();
}
function closeIndex(){
  PANEL.hidden=true;
  MAP.setAttribute('aria-expanded','false');
  document.body.classList.remove('index-open');
}
MAP.addEventListener('click',function(){PANEL.hidden?openIndex():closeIndex()});
CLOSE.addEventListener('click',function(){closeIndex();MAP.focus()});
PANEL.addEventListener('click',function(e){if(e.target===PANEL)closeIndex()});
document.addEventListener('keydown',function(e){if(e.key==='Escape' && !PANEL.hidden){closeIndex();MAP.focus()}});
window.addEventListener('hashchange',renderCurrent);
TOP.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
fetch(DATA_URL)
  .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
  .then(function(data){nodes=Array.isArray(data.nodes)?data.nodes:[];renderCurrent()})
  .catch(function(e){CONTENT.innerHTML='<div class="load-error">記録を読み込めませんでした。<br>' + esc(e.message) + '</div>'});
