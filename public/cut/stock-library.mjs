/* Copyright-conscious stock media browser, integrated with SUBEHA CUT's existing importer. */
import {STOCK_MAX_BYTES,STOCK_REUSE_NOTE,openverseQuery,commonsQuery,normalizeStockResults,sourceSearchLinks,stockFileName,safeHttps} from './stock-sources.mjs';
const $=id=>document.getElementById(id);
let opened=false,requestSerial=0,current=[],lastQuery='nature';
const api=()=>window.__subehaCut;
function node(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x;}
function status(text){$('stock-status').textContent=text;}
function setup(){if($('stock-library'))return;
 const overlay=node('div','stock-overlay');overlay.id='stock-library';overlay.hidden=true;
 const sheet=node('section','stock-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','無料素材を探す');
 sheet.innerHTML=`<header class="stock-header"><h2>素材を探す</h2><button id="stock-close" aria-label="閉じる" type="button">×</button></header>
 <p class="stock-intro">無料素材を探して、動画・画像・音声として取り込みます。<strong>宗教団体の宣伝にも使う場合、個別の権利確認が必要です。</strong></p>
 <form id="stock-form"><input id="stock-query" type="search" maxlength="100" placeholder="例：sky, nature, temple, abstract" required value="nature" aria-label="素材の検索語"><select id="stock-kind" aria-label="素材の種類"><option value="image">画像</option><option value="video">動画</option><option value="audio">音声</option></select><select id="stock-provider" aria-label="素材の検索先"><option value="Openverse">Openverse</option><option value="Commons">Wikimedia Commons</option></select><button type="submit">検索</button></form>
 <div class="stock-hints"><span>おすすめ:</span><button type="button" data-keyword="nature">自然</button><button type="button" data-keyword="temple">寺院</button><button type="button" data-keyword="stars">星空</button><button type="button" data-keyword="abstract">抽象</button></div>
 <p class="stock-terms">著作権表示が<strong>CC0またはパブリックドメイン</strong>の結果のみ表示します。素材の情報は提供元で再確認してください。人物が団体の信者・支持者であるかのような誤認表示を避けてください。</p>
 <label class="stock-confirm"><input id="stock-confirm" type="checkbox"> 利用条件と人物・商標等の権利を確認して取り込む</label>
 <div class="stock-credits-toolbar"><button type="button" id="stock-credit-list">使用素材の記録を確認</button><button type="button" id="stock-credit-export">権利情報をテキスト保存</button></div><p id="stock-status" role="status" aria-live="polite">検索すると素材が表示されます。</p><div id="stock-results" class="stock-results"></div>
 <aside class="stock-external"><strong>ほかの素材サイト</strong><p>Pixabay・Pexelsは公式サイトでダウンロードし、「端末から追加」で取り込めます（アプリからの自動取得は未対応）。</p><div><a id="stock-pixabay" target="_blank" rel="noopener noreferrer">Pixabayで探す</a><a id="stock-pexels" target="_blank" rel="noopener noreferrer">Pexelsで探す</a><button type="button" id="stock-local">端末から追加</button></div></aside>
 <p class="stock-legal"></p>`;
 overlay.append(sheet);document.body.append(overlay);
 sheet.querySelector('.stock-legal').textContent=STOCK_REUSE_NOTE;
 $('stock-close').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened)close();});
 $('stock-kind').onchange=()=>{if($('stock-kind').value==='video')$('stock-provider').value='Commons';else if($('stock-provider').value==='Commons')$('stock-provider').value='Openverse';};
 $('stock-provider').onchange=()=>{if($('stock-kind').value==='video'&&$('stock-provider').value==='Openverse')$('stock-provider').value='Commons';};
 $('stock-form').onsubmit=e=>{e.preventDefault();search();};
 sheet.querySelectorAll('[data-keyword]').forEach(b=>b.onclick=()=>{$('stock-query').value=b.dataset.keyword;search();});
 $('stock-local').onclick=()=>{const el=$('stock-kind').value==='audio'?'pro-audio-picker':'file-picker';close();$(el)?.click();};
 $('stock-credit-list').onclick=()=>{const rows=api()?.state?.project?.stockCredits||[];status(rows.length?rows.map((x,i)=>`${i+1}. ${x.title}（${x.license}）― ${x.source}`).join(' ／ '):'まだ素材の取り込み記録はありません。');};
 $('stock-credit-export').onclick=()=>{const rows=api()?.state?.project?.stockCredits||[];if(!rows.length){status('権利情報を記録した素材はありません。');return;}const body='SUBEHA CUT 素材の使用記録\n（正式な利用許諾や肖像権を保証するものではありません）\n\n'+rows.map((x,i)=>`${i+1}. ${x.title}\n提供元: ${x.provider}\n作者: ${x.credit}\nライセンス: ${x.license}\nライセンス詳細: ${x.licenseUrl}\n原典: ${x.source}\n`).join('\n');const blob=new Blob([body],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob);const a=node('a');a.href=u;a.download='subeha-cut-素材の権利記録.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);status('権利情報の保存を開始しました');};
 updateLinks();
}
function updateLinks(){const links=sourceSearchLinks($('stock-query').value||lastQuery);$('stock-pixabay').href=links.pixabay;$('stock-pexels').href=links.pexels;}
function open(){setup();opened=true;$('stock-library').hidden=false;document.body.classList.add('stock-open');$('stock-query').focus();if(!current.length)search();}
function close(){opened=false;requestSerial++;if($('stock-library'))$('stock-library').hidden=true;document.body.classList.remove('stock-open');}
async function search(){const q=$('stock-query').value.trim(),kind=$('stock-kind').value;let provider=$('stock-provider').value;
 if(!q){status('検索語を入力してください');return;}
 if(kind==='video'&&provider==='Openverse'){provider='Commons';$('stock-provider').value=provider;}
 lastQuery=q;updateLinks();const token=++requestSerial;
 $('stock-results').replaceChildren();status('検索中…');
 try{
  const url=provider==='Openverse'?openverseQuery(q,kind):commonsQuery(q,kind);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),14000);
  let response;try{response=await fetch(url,{mode:'cors',signal:controller.signal,headers:{Accept:'application/json'}});}finally{clearTimeout(timeout);}
  if(!response.ok)throw Error(`検索サービスの応答 ${response.status}`);
  const json=await response.json();if(!opened||token!==requestSerial)return;
  current=normalizeStockResults(provider,json,kind);
  status(current.length?`${current.length}件見つかりました。素材ページで利用条件を確認してください。`:'条件に合う素材が見つかりませんでした。英語の検索語に変えるか検索先を変更してください。');
  for(const item of current)renderItem(item);
 }catch(err){if(token!==requestSerial)return;console.warn('stock search',err);status('検索できませんでした。接続状態を確認し、別の検索先を試してください。');}
}
function renderItem(item){const card=node('article','stock-card');
 const preview=node('div','stock-preview');if(item.kind==='image'&&item.thumbnail){const img=new Image();img.src=item.thumbnail;img.alt=item.title;img.loading='lazy';preview.append(img);}else preview.textContent=item.kind==='audio'?'♫ 音声素材':'▶ 動画素材';
 const info=node('div','stock-info');const title=node('strong','stock-name',item.title);const by=node('small','stock-by',`${item.provider} / ${item.credit} / ${item.license}`);const page=node('a','stock-origin','元の素材を見る');page.href=item.source;page.target='_blank';page.rel='noopener noreferrer';
 const license=node('a','stock-license','利用条件');license.href=item.licenseUrl;license.target='_blank';license.rel='noopener noreferrer';
 const buttons=node('div','stock-actions');const add=node('button','stock-add','編集に追加');add.type='button';add.onclick=()=>transfer(item,add,false);
 const local=node('button','stock-download','端末へ保存');local.type='button';local.onclick=()=>transfer(item,local,true);
 buttons.append(add,local);info.append(title,by,page,license,buttons);card.append(preview,info);$('stock-results').append(card);
}
function fileInput(kind){return $(kind==='audio'?'pro-audio-picker':'file-picker');}
function applyFile(file,item){const input=fileInput(item.kind);if(!input||typeof DataTransfer==='undefined')throw Error('このブラウザでは直接取り込みができません。端末へ保存してから追加してください。');
 const dt=new DataTransfer();dt.items.add(file);
 const assets=new Set(api().state.assets.keys());let listener;
 listener=()=>{
  const added=[...api().state.assets].find(([id,a])=>!assets.has(id)&&a.name===file.name);
  if(!added)return;
  window.removeEventListener('subeha-cut-change',listener);
  const project=api().state.project;project.stockCredits ||= [];
  if(!project.stockCredits.some(x=>x.assetId===added[0]))project.stockCredits.push({assetId:added[0],provider:item.provider,title:item.title,source:item.source,license:item.license,licenseUrl:item.licenseUrl,credit:item.credit,recordedAt:new Date().toISOString()});
  api().save();
 };
 window.addEventListener('subeha-cut-change',listener);setTimeout(()=>window.removeEventListener('subeha-cut-change',listener),30000);
 input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
}
async function transfer(item,button,onlyDownload){
 if(!onlyDownload&&!$('stock-confirm').checked){status('まず利用条件と人物・商標等の権利確認にチェックを入れてください。');return;}
 if(!safeHttps(item.url)){status('安全な取得先URLを確認できません');return;}
 button.disabled=true;const old=button.textContent;button.textContent='取得中…';
 try{
  const res=await fetch(item.url,{mode:'cors',redirect:'follow'});if(!res.ok)throw Error(`ダウンロード失敗: ${res.status}`);
  const length=Number(res.headers.get('content-length'))||0;
  if(length>STOCK_MAX_BYTES||item.bytes>STOCK_MAX_BYTES)throw Error('80MBを超える素材は直接追加できません');
  const bytes=await res.blob();if(bytes.size>STOCK_MAX_BYTES)throw Error('80MBを超える素材は直接追加できません');
  const mime=bytes.type&&bytes.type!=='application/octet-stream'?bytes.type:item.mime;
  if(!mime.startsWith(item.kind+'/'))throw Error('取得内容が選んだ素材種別と一致しません');
  const file=new File([bytes],stockFileName(item),{type:mime});
  if(onlyDownload){const url=URL.createObjectURL(file);const a=node('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);status('端末への保存を開始しました');}
  else{applyFile(file,item);status('素材を編集に取り込んでいます…');close();api().toast('素材を取り込み中です。読み込みに成功すると時間軸へ追加されます。');}
 }catch(e){console.warn('stock download',e);status(`${e.message}。取得先が外部サイトからの読み込みを禁止している場合は「元の素材を見る」から保存してください。`);}finally{button.disabled=false;button.textContent=old;}
}
window.__subehaStockOpen=open;
window.__subehaStockClose=close;
