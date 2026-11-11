import test from 'node:test';import assert from 'node:assert/strict';
import {STOCK_MAX_BYTES,openverseQuery,commonsQuery,mapOpenverse,mapCommons,normalizeStockResults,isPermissiveLicense,safeHttps,sourceSearchLinks,stockFileName,STOCK_REUSE_NOTE} from '../stock-sources.mjs';
test('Openverse: accepts CC0 only, encodes user query and limits pages',()=>{
 const url=new URL(openverseQuery('空 寺院&unsafe=1','image',999));assert.equal(url.searchParams.get('q'),'空 寺院&unsafe=1');assert.equal(url.searchParams.get('license'),'cc0');assert.equal(url.searchParams.get('page'),'40');
 assert.throws(()=>openverseQuery('test','video'));
});
test('Commons: restricts file namespace and adds CORS origin',()=>{
 const u=new URL(commonsQuery('night sky','video'));assert.equal(u.searchParams.get('gsrnamespace'),'6');assert.equal(u.searchParams.get('origin'),'*');assert.match(u.searchParams.get('gsrsearch'),/filetype:video/);
});
test('Safe URLs and royalty-free status are not treated as unlimited permissions',()=>{
 assert.equal(safeHttps('javascript:alert(1)'),null);assert.equal(safeHttps('http://example.com/item'),null);assert.equal(isPermissiveLicense('CC BY-SA 4.0'),null);assert.equal(isPermissiveLicense('CC0 1.0'),'CC0');assert.match(STOCK_REUSE_NOTE,/宗教団体/);
});
test('Openverse CC0 items normalized and source preserved',()=>{
 const valid={id:'abc',title:'Sky',license:'cc0',url:'https://example.com/a.jpg',thumbnail:'https://example.com/thumb.jpg',foreign_landing_url:'https://example.com/page',creator:'photographer'};
 const item=mapOpenverse(valid,'image');assert.equal(item.license,'CC0');assert.equal(item.kind,'image');assert.equal(stockFileName(item),'Sky.jpg');
 assert.equal(mapOpenverse({...valid,license:'by-nc'},'image'),null);assert.equal(mapOpenverse({...valid,url:'http://example.com/a.jpg'},'image'),null);
 assert.deepEqual(normalizeStockResults('Openverse',{results:[valid,{...valid,license:'by-nc'}]},'image').length,1);
});
test('Commons: prevent permissive imports of BY-NC/SA, non-media, oversized files',()=>{
 const page={pageid:2,title:'File:Temple.jpg',imageinfo:[{url:'https://upload.wikimedia.org/a.jpg',thumburl:'https://upload.wikimedia.org/t.jpg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Temple.jpg',mime:'image/jpeg',size:1400,extmetadata:{LicenseShortName:{value:'CC0 1.0'},Artist:{value:'<b>artist</b>'}}}]};
 let item=mapCommons(page,'image');assert.equal(item.credit,'artist');assert.equal(item.license,'CC0');
 assert.equal(mapCommons({...page,imageinfo:[{...page.imageinfo[0],extmetadata:{LicenseShortName:{value:'CC BY-NC 4.0'}}}]},'image'),null);
 assert.equal(mapCommons({...page,imageinfo:[{...page.imageinfo[0],size:STOCK_MAX_BYTES+1}]},'image'),null);
 assert.equal(mapCommons(page,'video'),null);
});
test('External sites use links, not unapproved scraping',()=>{
 const l=sourceSearchLinks('祈り&test=hi');assert.match(l.pixabay,/https:\/\/pixabay\.com\/images\/search/);assert.ok(!l.pixabay.includes('&test='));assert.match(l.pexels,/pexels\.com/);
});
