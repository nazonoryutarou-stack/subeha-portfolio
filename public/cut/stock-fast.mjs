/* Fast stock query support. Pixabay API: https://pixabay.com/api/docs/
   No API key is persisted, logged, embedded in a static URL, or included in a cache entry.
   Pixabay requires search results to be cached for 24 hours. */
import {STOCK_MAX_BYTES,safeHttps,safeTitle,mimeFromURL} from './stock-sources.mjs';
export const PIXABAY_LICENSE_URL='https://pixabay.com/service/license-summary/';
export const PIXABAY_API_DOCS='https://pixabay.com/api/docs/';
export const PIXABAY_CACHE_MS=24*60*60*1000;
const OTHER_CACHE_MS=10*60*1000;
const PREFIX='subeha-stock-cache-v2:';
const CACHE_CAP=16;
const clean=(s)=>String(s||'').trim().slice(0,100);
export function pixabayQuery(key,term,kind='image',page=1){
 if(!['image','video'].includes(kind))throw Error('Pixabay APIは画像と動画のみ対応しています');
 if(!String(key||'').trim())throw Error('Pixabay APIキーを入力してください');
 const url=new URL(kind==='video'?'https://pixabay.com/api/videos/':'https://pixabay.com/api/');
 url.searchParams.set('key',String(key).trim());
 url.searchParams.set('q',clean(term));
 url.searchParams.set('lang','ja');
 url.searchParams.set('safesearch','true');
 url.searchParams.set('per_page','24');
 url.searchParams.set('page',String(Math.max(1,Math.min(20,Math.floor(Number(page)||1)))));
 if(kind==='image')url.searchParams.set('image_type','all');
 return url.toString();
}
const pickVideo=(videos={})=>{
 // Prefer sharp but small mobile source. The API provides a size in bytes.
 for(const key of ['medium','small','tiny']){
  const v=videos[key];
  if(v&&safeHttps(v.url)&&Number(v.size)>0&&Number(v.size)<=STOCK_MAX_BYTES)return v;
 }
 return null;
};
export function mapPixabay(item,kind='image'){
 if(!item || !['image','video'].includes(kind))return null;
 const source=safeHttps(item.pageURL);
 if(!source||new URL(source).hostname!=='pixabay.com')return null;
 const title=safeTitle(item.tags||'Pixabay '+(kind==='video'?'動画':'画像'));
 const base={id:'pixabay-'+String(item.id||''),provider:'Pixabay',kind,title,source,license:'Pixabay Content License',licenseUrl:PIXABAY_LICENSE_URL,credit:String(item.user||'作者名不明').slice(0,130)};
 if(kind==='image'){
  const url=safeHttps(item.largeImageURL)||safeHttps(item.webformatURL);
  const thumbnail=safeHttps(item.previewURL)||safeHttps(item.webformatURL);
  if(!url||!thumbnail)return null;
  const mime=mimeFromURL(url,'image')||'image/jpeg';
  if(!/^image\/(jpeg|png|webp)$/i.test(mime))return null;
  return {...base,url,thumbnail,mime,bytes:null};
 }
 const v=pickVideo(item.videos);
 if(!v)return null;
 return {...base,url:safeHttps(v.url),thumbnail:safeHttps(v.thumbnail),mime:'video/mp4',bytes:Number(v.size),duration:Number(item.duration)||null};
}
export function normalizePixabay(body,kind){
 return (Array.isArray(body?.hits)?body.hits:[]).map(item=>mapPixabay(item,kind)).filter(Boolean);
}
export function cacheKey(provider,kind,term){
 return PREFIX+encodeURIComponent([provider,kind,clean(term).toLocaleLowerCase()].join('|'));
}
export function readStockCache(storage,provider,kind,term,now=Date.now()){
 if(!storage)return null;
 try{
  const raw=storage.getItem(cacheKey(provider,kind,term));if(!raw)return null;
  const record=JSON.parse(raw),ttl=provider==='Pixabay'?PIXABAY_CACHE_MS:OTHER_CACHE_MS;
  if(!Number.isFinite(record.savedAt)||now-record.savedAt<0||now-record.savedAt>=ttl||!Array.isArray(record.items))return null;
  return record.items;
 }catch{return null;}
}
export function writeStockCache(storage,provider,kind,term,items,now=Date.now()){
 if(!storage||!Array.isArray(items))return false;
 try{
  const key=cacheKey(provider,kind,term);
  storage.setItem(key,JSON.stringify({savedAt:now,items:items.slice(0,32)}));
  const rows=[];
  for(let i=0;i<storage.length;i++){
   const name=storage.key(i);
   if(name?.startsWith(PREFIX)){
    let savedAt=0;try{savedAt=JSON.parse(storage.getItem(name)).savedAt||0;}catch{}
    rows.push({name,savedAt});
   }
  }
  rows.sort((a,b)=>b.savedAt-a.savedAt);
  for(const row of rows.slice(CACHE_CAP))storage.removeItem(row.name);
  return true;
 }catch{return false;}
}
export function readableError(status,provider){
 if(status===429)return provider+'へのリクエストが上限に達しました。少し経ってから再試行してください。';
 if(status===401||status===403)return provider==='Pixabay'?'APIキーが無効、または利用が許可されていません。Pixabayの設定を確認してください。':provider+'の利用が拒否されました。';
 return provider+'の検索に失敗しました（HTTP '+status+'）。';
}
