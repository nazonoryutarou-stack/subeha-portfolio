import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir,stat}from'node:fs/promises';import path from'node:path';import {validate,visible,edges,chronological}from'../../scripts/thought/model.mjs';
import {renderWordTree} from '../../scripts/thought/word-tree.mjs';
const root=path.resolve(import.meta.dirname,'../..'),a=JSON.parse(await readFile(path.join(root,'content/thought/archive.json'),'utf8'));const copy=()=>structuredClone(a);
test('all current records have no authored or imported content',()=>{validate(a);assert.equal(a.fragments.length,6);for(const f of a.fragments){assert.equal(f.body,null);assert.equal(f.citation,null);assert.equal(f.textOrigin,null);}});
test('branch labels are independent of connections',()=>{const b=copy();b.fragments[0].branchNumber='99';validate(b);assert.deepEqual(edges(visible(b)),edges(visible(a)));});
test('reject dangling IDs, duplicate edges and unsourced text',()=>{for(const mutate of [b=>b.fragments[0].nextId='missing',b=>b.fragments[1].branchIds.push('f-003'),b=>{b.fragments[0].status='published';b.fragments[0].body='test';}]){const b=copy();mutate(b);assert.throws(()=>validate(b));}});
test('unpublished records and their connections are omitted',()=>{const b=copy();b.fragments[2].status='draft';validate(b);assert(!visible(b).some(f=>f.id==='f-003'));assert(!edges(visible(b)).some(e=>e.to==='f-003'));});
test('quotation URL and calendar dates are validated',()=>{let b=copy();b.fragments[3].status='published';b.fragments[3].body='test';b.fragments[3].textOrigin='designated-quotation';b.fragments[3].citation={author:'test'};validate(b);b.fragments[3].citation.url='javascript:alert(1)';assert.throws(()=>validate(b));b=copy();b.fragments[0].writtenAt='2026-02-30';assert.throws(()=>validate(b));});
test('old nested tree supports cycles, shared nodes and 1000 fragments without recursion',()=>{
 const b=copy();b.fragments[5].nextId='f-001';const html=renderWordTree(b.fragments,b.entryId,id=>`/${id}/`);assert.equal([...html.matchAll(/data-fragment=/g)].length,7);assert(html.includes('再接続'));
 const big=Array.from({length:1000},(_,i)=>({...a.fragments[0],id:`n${i}`,branchNumber:String(i+1),nextId:i<999?`n${i+1}`:null,branchIds:[]}));assert.equal([...renderWordTree(big,'n0',id=>`/${id}/`).matchAll(/data-fragment=/g)].length,1000);
 const merged=copy();merged.fragments[3].nextId='f-005';assert.equal([...renderWordTree(merged.fragments,merged.entryId,id=>`/${id}/`).matchAll(/data-fragment=/g)].length,7);
});
test('chronology does not manufacture dates',()=>{const b=copy();b.fragments[4].writtenAt='2026-01-01';assert.equal(chronological(b.fragments)[0].id,'f-005');});
test('all generated links resolve, and branches work without JavaScript',async()=>{const files=['index.html',...a.fragments.map(f=>`thought/fragments/${f.id}/index.html`),...'map index timeline citations'.split(' ').map(x=>`thought/${x}/index.html`)];for(const file of files){const html=await readFile(path.join(root,'public',file),'utf8');for(const [,href]of html.matchAll(/(?:href|src)="([^"]+)"/g)){if(href.startsWith('#')||/^(https?:|mailto:)/.test(href))continue;const target=path.resolve(root,'public',path.dirname(file),href);const s=await stat(target);if(s.isDirectory())await stat(path.join(target,'index.html'));}assert(!html.includes('words/data.json'));}const fork=await readFile(path.join(root,'public/thought/fragments/f-002/index.html'),'utf8');assert(fork.includes('f-003/'));assert(fork.includes('f-004/'));assert(fork.includes('本文未登録'));});
test('reduced motion and mobile controls remain available',async()=>{const css=await readFile(path.join(root,'public/thought/archive.css'),'utf8');assert(css.includes('prefers-reduced-motion:reduce'));assert(css.includes('min-height:48px'));});

test('rendered parent connections use the real IDs, not branch strings',()=>{
 const html=renderWordTree(a.fragments,a.entryId,id=>`/${id}/`),nodes=new Map();
 const matches=[...html.matchAll(/<li data-parent="([^"]+)"><a[^>]*data-node="([^"]+)" data-fragment="([^"]+)"/g)];
 for(const m of html.matchAll(/data-node="([^"]+)" data-fragment="([^"]+)"/g))nodes.set(m[1],m[2]);
 const actual=matches.map(m=>({from:nodes.get(m[1]),to:m[3]}));
 assert.deepEqual(actual.sort((x,y)=>x.to.localeCompare(y.to)),edges(a.fragments).sort((x,y)=>x.to.localeCompare(y.to)));
 const b=copy();b.fragments[0].branchNumber='99';const changed=renderWordTree(b.fragments,b.entryId,id=>`/${id}/`);assert(changed.includes('href="/f-001/"'));assert(changed.includes('断章 99'));
});
test('original product CSS is restored byte for byte and words are already in HTML',async()=>{
 const original=await readFile(path.join(root,'public/tree.css'),'utf8'),restored=await readFile(path.join(root,'public/thought/tree.css'),'utf8');assert.equal(restored,original);
 const html=await readFile(path.join(root,'public/index.html'),'utf8');assert(html.includes('class="tree"'));assert(html.includes('data-word-tree'));assert(!html.includes('data-src='));assert(html.includes('本文未登録'));assert(!html.includes('thought-graph'));
 const js=await readFile(path.join(root,'public/thought/tree.js'),'utf8');assert(!js.includes('fetch('));assert(js.includes('const sx = pr.right - stageRect.left - 1;'));assert(js.includes('const curve = Math.max(24, Math.min(70, span * .46));'));
});
