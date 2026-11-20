import {openverseQuery,commonsQuery,normalizeStockResults,sourceSearchLinks,safeHttps,STOCK_REUSE_NOTE} from '../cut/stock-sources.mjs';
import {pixabayQuery,normalizePixabay,readStockCache,writeStockCache} from '../cut/stock-fast.mjs';
const $=id=>document.getElementById(id);
let results=[],currentKind='image',cc0Only=false,serial=0,controller=null;
const kinds={image:'画像',video:'動画',audio:'音楽・効果音',vrm:'VRM',model:'3Dモデル',texture:'テクスチャ',hdri:'HDRI'};
function mk(tag,className,text){const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=String(text);return x;}
function link(url,label,cls){const a=mk('a',cls,label),href=safeHttps(url);if(!href)return null;a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function addResultCard(item){
 const box=mk('article','card'),preview=mk('div','preview'),meta=mk('div','meta');
 if(item.thumbnail){
  const image=mk('img');image.loading='lazy';image.referrerPolicy='no-referrer';image.alt='';
  image.src=safeHttps(item.thumbnail)||'';image.onerror=()=>{image.remove();preview.textContent=item.kind==='audio'?'♫':item.kind==='image'?'▧':'▣';};
  preview.append(image);
 }else preview.textContent=item.kind==='audio'?'♫':item.kind==='model'?'◇':'▣';
 const name=mk('strong','',item.title||'無題の素材');
 const label=mk('span','label',item.license||'利用条件を確認');
 const source=mk('small','',item.provider+' / '+(item.credit||'作者未確認'));
 const actions=mk('div','card-actions');
 const page=link(item.source,'素材ページ');if(page)actions.append(page);
 if(item.url&&item.kind!=='model'&&item.kind!=='texture'&&item.kind!=='hdri'){const file=link(item.url,'原ファイル');if(file)actions.append(file);}
 const terms=link(item.licenseUrl,'利用条件');if(terms)actions.append(terms);
 meta.append(name,label,source,actions);box.append(preview,meta);
 return box;
}
function display(){
 const root=$('results');root.replaceChildren();
 const shown=(cc0Only?results.filter(x=>String(x.license).toUpperCase()==='CC0'):results);
 $('cc0-filter').setAttribute('aria-pressed',String(cc0Only));
 $('all-filter').setAttribute('aria-pressed',String(!cc0Only));
 for(const item of shown)root.append(addResultCard(item));
 if(!shown.length){const p=mk('p','disclaimer','条件に合うAPI結果はありません。下の各サイトも検索できます。');root.append(p);}
}
function queryLinks(q,kind){
 const s=sourceSearchLinks(q),Q=encodeURIComponent(q);
 const base=[
  {name:'Openverse',url:'https://openverse.org/search/?q='+Q,description:'CCライセンス画像・音声 / 原素材ごとに確認',kinds:['image','audio']},
  {name:'Wikimedia Commons',url:'https://commons.wikimedia.org/w/index.php?search='+Q+'&title=Special:MediaSearch',description:'写真・動画・音声 / ファイル単位で条件確認',kinds:['image','video','audio']},
  {name:'Pixabay',url:kind==='video'?'https://pixabay.com/videos/search/'+Q+'/':s.pixabay,description:'画像・動画・音楽・効果音 / Pixabay Content License',kinds:['image','video','audio']},
  {name:'Pexels',url:kind==='video'?'https://www.pexels.com/search/videos/'+Q+'/':s.pexels,description:'写真・動画 / Pexels License',kinds:['image','video']},
  {name:'Mixkit',url:'https://mixkit.co/',description:'無料動画・音楽・効果音 / 素材ごとの条件',kinds:['video','audio']},
  {name:'Freesound',url:s.freesound,description:'効果音・環境音 / CC0・CC BY・NCなど混在',kinds:['audio']},
  {name:'YouTubeオーディオライブラリ',url:'https://www.youtube.com/audiolibrary',description:'音楽・効果音 / YouTube使用条件を確認',kinds:['audio']},
  {name:'NASA',url:'https://images.nasa.gov/search?q='+Q,description:'宇宙画像・映像・音声 / NASAの使用条件と第三者権利',kinds:['image','video','audio']},
  {name:'Internet Archive',url:s.internetArchive,description:'古い動画・音楽・文化資料 / 作品別の権利確認',kinds:['image','video','audio']},
  {name:'Poly Haven',url:kind==='model'?s.polyModels:kind==='texture'?s.polyTextures:s.polyHDRI,description:'CC0の3Dモデル・テクスチャ・HDRI',kinds:['model','texture','hdri']},
  {name:'ambientCG',url:'https://ambientcg.com/list',description:'CC0のPBRテクスチャ・HDRI・3D',kinds:['texture','hdri','model']},
  {name:'Kenney',url:'https://kenney.nl/assets',description:'ゲーム向け3Dモデル・画像 / CC0素材多数',kinds:['model','texture']},
  {name:'Sketchfab',url:'https://sketchfab.com/search?q='+Q+'&features=downloadable',description:'ダウンロード可能な3Dモデル / 個別ライセンス',kinds:['model']},
  {name:'VRoid Hub',url:s.vroid,description:'VRMアバター / 作者ごとの再利用・改変・商用条件',kinds:['vrm']},
  {name:'BOOTH（VRM）',url:'https://booth.pm/ja/search/VRM',description:'VRMモデル・衣装 / 販売者と商品ごとの条件',kinds:['vrm']},
  {name:'OpenGameArt',url:'https://opengameart.org/',description:'ゲーム用2D/3D/音声 / ライセンス混在',kinds:['image','audio','model','texture']}
 ];
 const node=$('sources');node.replaceChildren();
 for(const row of base.filter(x=>x.kinds.includes(kind))){
  const a=link(row.url,'','source');if(!a)continue;
  a.append(mk('strong','',row.name),mk('span','',row.description));node.append(a);
 }
}
async function getJSON(url,signal){
 const timeoutController=new AbortController();
 const timer=setTimeout(()=>timeoutController.abort(),11000);
 const cancel=()=>timeoutController.abort();
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  const response=await fetch(url,{signal:timeoutController.signal,mode:'cors',credentials:'omit',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  return await response.json();
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
function mapNasa(body,kind){
 const rows=body?.collection?.items||[];
 return rows.slice(0,24).map((row,i)=>{
  const d=row.data?.[0],url='https://images.nasa.gov/details/'+encodeURIComponent(d?.nasa_id||'');
  if(!d?.nasa_id)return null;
  return {id:'nasa-'+d.nasa_id,provider:'NASA',kind,title:d.title||d.nasa_id,
   source:url,thumbnail:safeHttps(row.links?.find(l=>l.rel==='preview')?.href),
   url:null,license:'NASAの利用条件を確認',licenseUrl:'https://www.nasa.gov/nasa-brand-center/images-and-media/',
   credit:d.center||'NASA'};
 }).filter(Boolean);
}
function polyEntries(body,q,kind){
 const typed={model:'models',texture:'textures',hdri:'hdris'}[kind];
 return Object.entries(body||{}).filter(([id,x])=>{
  // The endpoint query already filters type; asset metadata uses provider-specific type enums.
  const words=[id,x.name||'',...(x.tags||[]),...(x.categories||[])].join(' ').toLowerCase();
  return words.includes(q.toLowerCase());
 }).slice(0,40).map(([id,x])=>({id:'poly-'+id,provider:'Poly Haven',kind,title:x.name||id,source:'https://polyhaven.com/a/'+encodeURIComponent(id),
  thumbnail:safeHttps('https://cdn.polyhaven.com/asset_img/thumbs/'+encodeURIComponent(id)+'.png'),
  url:null,license:'CC0',licenseUrl:'https://polyhaven.com/license',credit:'Poly Haven'}));
}
async function search(){
 const q=$('query').value.trim().slice(0,100),kind=$('kind').value;
 if(!q)return;
 currentKind=kind;const token=++serial;
 if(controller)controller.abort();controller=new AbortController();
 const signal=controller.signal;
 $('search-status').textContent='検索中…';results=[];display();queryLinks(q,kind);
 const tasks=[];
 const add=(label,url,map)=>tasks.push((async()=>{
  try{
   const body=await getJSON(url,signal);return {label,rows:map(body)};
  }catch(e){if(signal.aborted)return {label,rows:[]};return {label,rows:[],error:e?.message||'通信エラー'};}
 })());
 if(['image','audio'].includes(kind))add('Openverse',openverseQuery(q,kind),body=>normalizeStockResults('Openverse',body,kind));
 if(['image','audio','video'].includes(kind))add('Wikimedia Commons',commonsQuery(q,kind),body=>normalizeStockResults('Wikimedia Commons',body,kind));
 if(['image','video','audio'].includes(kind)){
  const url=new URL('https://images-api.nasa.gov/search');url.searchParams.set('q',q);url.searchParams.set('media_type',kind);url.searchParams.set('page_size','20');
  add('NASA',url.toString(),body=>mapNasa(body,kind));
 }
 if(['model','texture','hdri'].includes(kind)){
  const u=new URL('https://api.polyhaven.com/assets');u.searchParams.set('t',{model:'models',texture:'textures',hdri:'hdris'}[kind]);
  add('Poly Haven',u.toString(),body=>polyEntries(body,q,kind));
 }
 if(['image','video'].includes(kind)&&$('pixabay-key').value.trim()){
  const key=$('pixabay-key').value.trim();
  let old=null;try{old=readStockCache(localStorage,'Pixabay',kind,q);}catch{}
  if(old)tasks.push(Promise.resolve({label:'Pixabay',rows:old}));
  else{
   add('Pixabay',pixabayQuery(key,q,kind),body=>{
    const rows=normalizePixabay(body,kind);
    try{writeStockCache(localStorage,'Pixabay',kind,q,rows);}catch{}
    return rows;
   });
  }
 }
 const response=await Promise.all(tasks);
 if(token!==serial)return;
 results=response.flatMap(x=>x.rows||[]);
 const unique=new Set();results=results.filter(x=>{const key=x.provider+':'+x.id;if(unique.has(key))return false;unique.add(key);return true;});
 display();
 const failures=response.filter(x=>x.error).map(x=>x.label+'('+x.error+')');
 $('search-status').textContent=results.length+'件の候補'+(failures.length?' / API失敗: '+failures.join('、'):'')+'。専門サイトの検索結果は下記リンクから。';
}
$('search-form').onsubmit=e=>{e.preventDefault();search();};
$('kind').onchange=()=>{queryLinks($('query').value.trim(),$('kind').value);search();};
$('cc0-filter').onclick=()=>{cc0Only=true;display();};
$('all-filter').onclick=()=>{cc0Only=false;display();};
queryLinks($('query').value,'image');search();
