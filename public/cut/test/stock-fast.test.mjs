import test from 'node:test';
import assert from 'node:assert/strict';
import {pixabayQuery,normalizePixabay,mapPixabay,cacheKey,readStockCache,writeStockCache,PIXABAY_CACHE_MS,readableError} from '../stock-fast.mjs';
const key='FAKE_DO_NOT_USE_KEY';
const image={id:123,pageURL:'https://pixabay.com/photos/flower-123/',tags:'flower, yellow',previewURL:'https://cdn.pixabay.com/photo/a_150.jpg',largeImageURL:'https://pixabay.com/get/a_1280.jpg',user:'Example Author'};
const video={id:456,pageURL:'https://pixabay.com/videos/id-456/',tags:'clouds, moving',user:'Video Author',duration:12,videos:{medium:{url:'https://cdn.pixabay.com/video/medium.mp4',thumbnail:'https://cdn.pixabay.com/video/medium.jpg',size:6_000_000},small:{url:'https://cdn.pixabay.com/video/small.mp4',thumbnail:'https://cdn.pixabay.com/video/small.jpg',size:500_000}}};
test('Pixabay image/video API endpoints use encoded keywords, require key and do not support audio',()=>{
 const u=new URL(pixabayQuery(key,'雲 & 空','image'));assert.equal(u.hostname,'pixabay.com');assert.equal(u.pathname,'/api/');assert.equal(u.searchParams.get('q'),'雲 & 空');assert.equal(u.searchParams.get('lang'),'ja');assert.equal(u.searchParams.get('key'),key);
 const v=new URL(pixabayQuery(key,'clouds','video'));assert.equal(v.pathname,'/api/videos/');
 assert.throws(()=>pixabayQuery(key,'voice','audio'));assert.throws(()=>pixabayQuery('','cloud','image'));
});
test('Pixabay results have correct Content License, source attribution, and usable media',()=>{
 const mapped=mapPixabay(image,'image');
 assert.equal(mapped.license,'Pixabay Content License');assert.equal(mapped.provider,'Pixabay');assert.equal(mapped.mime,'image/jpeg');assert.equal(mapped.credit,'Example Author');assert.equal(mapped.kind,'image');
 assert.ok(mapped.source.includes('pixabay.com'));assert.equal(normalizePixabay({hits:[image]},'image').length,1);
 assert.equal(mapPixabay({...image,pageURL:'https://attacker.invalid/123'},'image'),null);
 const v=mapPixabay(video,'video');assert.equal(v.mime,'video/mp4');assert.equal(v.bytes,6_000_000);assert.ok(v.thumbnail.endsWith('medium.jpg'));
 assert.equal(mapPixabay({...video,videos:{...video.videos,medium:{...video.videos.medium,size:110_000_000}}},'video').url,'https://cdn.pixabay.com/video/small.mp4');
 assert.equal(mapPixabay({...video,videos:{medium:{...video.videos.medium,size:110_000_000}}},'video'),null);
});
test('24h Pixabay cache keyed by public query never stores keys',()=>{
 const map=new Map();const storage={get length(){return map.size},key:i=>[...map.keys()][i]||null,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const items=normalizePixabay({hits:[image]},'image'),at=1_800_000_000_000;
 assert.equal(readStockCache(storage,'Pixabay','image','flowers',at),null);
 assert.equal(writeStockCache(storage,'Pixabay','image','flowers',items,at),true);
 assert.equal(readStockCache(storage,'Pixabay','image','flowers',at+PIXABAY_CACHE_MS-1).length,1);
 assert.equal(readStockCache(storage,'Pixabay','image','flowers',at+PIXABAY_CACHE_MS),null);
 assert.ok(cacheKey('Pixabay','image','flower')!==cacheKey('Pixabay','video','flower'));
 assert.ok(![...map.values()].join('').includes(key));
});
test('Status errors do not echo API query tokens',()=>{
 assert.match(readableError(429,'Pixabay'),/上限/);
 assert.match(readableError(401,'Pixabay'),/APIキー/);
});
