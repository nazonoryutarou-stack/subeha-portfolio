import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {validate,visible,chronological} from './thought/model.mjs';
import path from 'node:path';
import {renderWordTree} from './thought/word-tree.mjs';
const root=path.resolve(import.meta.dirname,'..');
const a=validate(JSON.parse(await readFile(path.join(root,'content/thought/archive.json'),'utf8')));
const fs=visible(a).sort((x,y)=>x.order-y.order),by=new Map(fs.map(f=>[f.id,f]));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=(id,p)=>`${p}thought/fragments/${id}/`;
const link=(id,p,label)=>by.has(id)?`<a class="step" data-to="${id}" href="${url(id,p)}">${label} <b>${esc(by.get(id).branchNumber)}</b><span aria-hidden="true">${label==='直前へ'?'←':'→'}</span></a>`:'';

const cite=f=>f.citation?`<aside class="citation" aria-label="引用元">${['author','source','work','note'].filter(k=>f.citation[k]).map(k=>`<p>${esc(f.citation[k])}</p>`).join('')}${f.citation.url?`<a href="${esc(f.citation.url)}" rel="noopener noreferrer">出典を開く</a>`:''}</aside>`:'';
function shell(p,title,body,id=''){return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f5f2ea"><title>${esc(title)}｜${a.siteName}</title><link rel="stylesheet" href="${p}nav.css"><link rel="stylesheet" href="${p}thought/archive.css"><script defer src="${p}thought/archive.js"></script></head><body data-current="${id}"><a class="skip-link" href="#main">本文へ</a><div class="archive-shell"><nav class="global-nav" aria-label="主要メニュー"><a class="brand" href="${p}">${a.siteName}</a><div class="nav-links"><a href="${url(a.entryId,p)}">読む</a><a href="${p}thought/map/">思考樹</a><a href="${p}thought/index/">索引</a><a href="${p}thought/citations/">引用</a></div></nav><main id="main">${body}</main><footer class="archive-footer"><span>${a.siteName}</span></footer></div></body></html>\n`;}
async function emit(file,html){const target=path.join(root,'public',file);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);}
function treePage(p,title){
 const tree=renderWordTree(fs,a.entryId,id=>url(id,p));
 return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#f5f2ea">
  <title>${esc(title)}｜${a.siteName}</title>
  <link rel="stylesheet" href="${p}thought/tree.css">
  <link rel="stylesheet" href="${p}nav.css">
  <link rel="stylesheet" href="${p}thought/tree-state.css">
  <script src="${p}thought/tree.js" defer></script>
  <script src="${p}thought/archive.js" defer></script>
</head>
<body data-current="">
  <a class="skip-link" href="#main">本文へ</a>
  <main id="main">
    <nav class="global-nav" aria-label="主要メニュー">
      <a class="brand" href="${p}">${a.siteName}</a>
      <div class="nav-links">
        <a href="${p}thought/map/">言葉</a>
        <a href="${p}thought/index/">索引</a>
      </div>
    </nav>
    <header><h1>言葉</h1><a class="back" href="${url(a.entryId,p)}" data-to="${a.entryId}">読む</a></header>
    <section class="tree-wrap" aria-label="言葉の枝。左から右へつながります">
      <div class="tree-stage" data-word-tree>${tree}</div>
    </section>
    <div class="legend tree-legend"><span><i class="position-dot" aria-hidden="true"></i>現在地</span><span><i class="travel-line" aria-hidden="true"></i>通過経路</span><span>未読</span></div>
    <nav class="tree-actions" aria-label="言葉の表示"><a href="${p}thought/timeline/">時系列</a><a href="${p}thought/citations/">引用</a></nav>
  </main>
</body>
</html>
`;
}
await emit('index.html',treePage('./','言葉'));
await rm(path.join(root,'public/thought/fragments'),{recursive:true,force:true});
for(const f of fs){const p='../../../';const branches=f.branchIds.filter(id=>by.has(id));await emit(`thought/fragments/${f.id}/index.html`,shell(p,`断章 ${f.branchNumber}`,`<div class="reader"><aside class="route"><span class="label">通過経路</span><ol data-trail><li aria-current="step">${esc(f.branchNumber)}</li></ol><a href="${p}thought/map/">全体図 ↗</a></aside><article class="manuscript"><header><span class="label">${f.kind==='quotation'?'引用':'断章'}</span><h1 class="branch-number">${esc(f.branchNumber)}</h1>${f.writtenAt||f.publishedAt?`<time>${esc(f.writtenAt||f.publishedAt)}</time>`:''}</header><div class="body-copy ${f.body===null?'unregistered':''}">${f.body===null?(f.kind==='quotation'?'引用未登録':'本文未登録'):esc(f.body)}</div>${cite(f)}<nav class="reading-nav" aria-label="断章の移動">${link(f.previousId,p,'直前へ')}${link(f.nextId,p,'次へ')}</nav>${branches.length?`<section class="branching"><h2>分岐 <span>${branches.length}</span></h2><div class="branch-options">${branches.map(id=>link(id,p,'断章')).join('')}</div></section>`:''}</article></div>`,f.id));}
await emit('thought/map/index.html',treePage('../../','言葉'));
const rows=items=>items.map(f=>`<a class="index-row" data-to="${f.id}" href="${url(f.id,'../../')}"><b>${esc(f.branchNumber)}</b><span>${f.body===null?(f.kind==='quotation'?'引用未登録':'本文未登録'):'断章'}</span><time>${esc(f.writtenAt||f.publishedAt||'日時未登録')}</time></a>`).join('');
await emit('thought/index/index.html',shell('../../','索引',`<header class="page-heading"><span class="label">索引</span><h1>断章<span class="heading-count">${fs.length}</span></h1></header><label class="search" hidden>枝番号・分類で探す<input type="search" data-search placeholder="枝番号 / 分類"></label><div class="index-list">${rows(fs)}</div><a class="text-link" href="../timeline/">時系列 ↗</a>`));
await emit('thought/timeline/index.html',shell('../../','時系列',`<header class="page-heading"><span class="label">時系列</span><h1>記録順</h1></header><div class="index-list">${rows(chronological(fs))}</div><a class="text-link" href="../index/">枝番号順 ↗</a>`));
await emit('thought/citations/index.html',shell('../../','引用',`<header class="page-heading"><span class="label">引用</span><h1>引用</h1></header>${fs.filter(f=>f.kind==='quotation').map(f=>`<article class="quote-card">${link(f.id,'../../','断章')}<blockquote>${esc(f.body||'引用未登録')}</blockquote>${cite(f)}</article>`).join('')||'<p>引用未登録</p>'}`));
await writeFile(path.join(root,'public/thought/meta.json'),JSON.stringify({entryId:a.entryId,fragments:fs.map(({id,branchNumber,previousId,nextId,branchIds,tags,order})=>({id,branchNumber,previousId,nextId,branchIds,tags,order}))}));
console.log(`Thought archive: ${fs.length} fragments, 11 static pages. No legacy content imported.`);
