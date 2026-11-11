/* SUBEHA CUT — open-stock discovery. Metadata is informational, never a rights guarantee.
 * No scraping, credentials or third-party source hotlinking for saved projects.
 */
export const STOCK_MAX_BYTES=80*1024*1024;
export const STOCK_KINDS=Object.freeze(['image','video','audio']);
const allowedMime={image:/^image\/(?:jpeg|png|webp|gif)$/i,video:/^video\/(?:mp4|webm|ogg)$/i,audio:/^audio\/(?:mpeg|mp3|mp4|ogg|wav|webm|flac)$/i};
const LICENSES=new Map([['cc0','CC0'],['public domain','パブリックドメイン'],['public domain mark','パブリックドメイン（要確認）'],['pdm','パブリックドメイン（要確認）']]);
export const STOCK_REUSE_NOTE='著作権上の自由利用と、宗教団体の広告に使えることは同義ではありません。人物の肖像・宗教的支持の誤認・商標・建築物・撮影された作品などは個別に確認してください。';
export function safeHttps(value){try{const u=new URL(String(value));return u.protocol==='https:'?u.href:null;}catch{return null;}}
export function safeTitle(text,fallback='素材'){return String(text||fallback).replace(/<[^>]*>/g,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,110)||fallback;}
export function isPermissiveLicense(value){const v=String(value||'').trim().toLowerCase().replace(/\s+1\.0$/,'');if(LICENSES.has(v))return LICENSES.get(v);if(/^cc0(?:\s+[\d.]+)?$/i.test(v))return 'CC0';return null;}
export function openverseQuery(term,kind='image',page=1){
 if(!['image','audio'].includes(kind))throw Error('Openverseは画像・音声に対応します');
 const u=new URL(`https://api.openverse.org/v1/${kind==='image'?'images':'audio'}/`);
 u.searchParams.set('q',String(term||'').trim().slice(0,100));u.searchParams.set('license','cc0');
 u.searchParams.set('page_size','18');u.searchParams.set('page',String(Math.max(1,Math.min(40,Math.floor(Number(page)||1)))));
 return u.toString();
}
export function commonsQuery(term,kind='image'){
 if(!STOCK_KINDS.includes(kind))throw Error('未知の素材種別です');
 const u=new URL('https://commons.wikimedia.org/w/api.php');
 const query=String(term||'').trim().slice(0,100)+(kind==='image'?'':` filetype:${kind}`);
 for(const [k,v] of Object.entries({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'24',prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiurlwidth:'320',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist|Credit',format:'json',origin:'*'}))u.searchParams.set(k,v);
 return u.toString();
}
export function mapOpenverse(item,kind='image'){
 if(!['image','audio'].includes(kind) || !item || String(item.license).toLowerCase()!=='cc0')return null;
 const url=safeHttps(item.url),source=safeHttps(item.foreign_landing_url),thumbnail=safeHttps(item.thumbnail);
 if(!url||!source)return null;
 const title=safeTitle(item.title);const mime=mimeFromURL(url,kind) || mimeFromURL('https://placeholder.invalid/file.'+String(item.filetype||'').replace(/[^a-z0-9]/gi,''),kind);
 if(!mime||!allowedMime[kind].test(mime))return null;
 return {id:String(item.id||url),provider:'Openverse',kind,title,url,source,thumbnail,license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',credit:String(item.creator||'作者名不明').slice(0,130),mime,bytes:null};
}
export function mimeFromURL(url,kind){try{let p=new URL(url).pathname.toLowerCase();const m=p.match(/\.([a-z0-9]+)$/)?.[1];
 const table={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:kind==='audio'?'audio/mp4':'video/mp4',webm:kind==='audio'?'audio/webm':'video/webm',ogv:'video/ogg',ogg:'audio/ogg',oga:'audio/ogg',mp3:'audio/mpeg',wav:'audio/wav',flac:'audio/flac'};return table[m]||null;
 }catch{return null;}}
export function mapCommons(page,kind='image'){
 const inf=page?.imageinfo?.[0],meta=inf?.extmetadata||{};
 const license=isPermissiveLicense(meta.LicenseShortName?.value);
 const url=safeHttps(inf?.url),source=safeHttps(inf?.descriptionurl),thumbnail=safeHttps(inf?.thumburl);
 const mime=String(inf?.mime||'');
 if(!license||!url||!source||!allowedMime[kind]?.test(mime)||Number(inf?.size||0)>STOCK_MAX_BYTES)return null;
 // Artist HTML is publisher-supplied markup; never insert it into the DOM as HTML.
 const credit=String(meta.Artist?.value||meta.Credit?.value||'作者名不明').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').slice(0,150).trim();
 return {id:String(page.pageid||url),provider:'Wikimedia Commons',kind,title:safeTitle(page.title?.replace(/^File:/,'')),url,source,thumbnail,license,licenseUrl:safeHttps(meta.LicenseUrl?.value)||'https://commons.wikimedia.org/wiki/Commons:Licensing',credit,mime,bytes:Number(inf.size)||null};
}
export function normalizeStockResults(provider,body,kind){
 const rows=provider==='Openverse'?(body?.results||[]):Object.values(body?.query?.pages||{});
 return rows.map(x=>provider==='Openverse'?mapOpenverse(x,kind):mapCommons(x,kind)).filter(Boolean);
}
export function sourceSearchLinks(term){const q=encodeURIComponent(String(term||'').trim().slice(0,100)||'nature');return {pixabay:`https://pixabay.com/images/search/${q}/`,pexels:`https://www.pexels.com/search/${q}/`};}
export function stockFileName(item){const extension=({"image/jpeg":'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/webm':'.webm','video/ogg':'.ogv','audio/mpeg':'.mp3','audio/mp4':'.m4a','audio/webm':'.webm','audio/ogg':'.ogg','audio/wav':'.wav','audio/flac':'.flac'})[item.mime]||'.bin';return safeTitle(item.title).replace(/\.[a-z0-9]{2,5}$/i,'').slice(0,70)+extension;}
