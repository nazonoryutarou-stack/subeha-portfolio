/* Copyright-conscious stock media browser, integrated with SUBEHA CUT's existing importer. */
import {STOCK_MAX_BYTES,STOCK_REUSE_NOTE,openverseQuery,commonsQuery,normalizeStockResults,sourceSearchLinks,stockFileName,safeHttps,normalizeLibraryKind,STOCK_EXTERNAL_CATALOG} from './stock-sources.mjs';
import {pixabayQuery,normalizePixabay,readStockCache,writeStockCache,readableError,PIXABAY_LICENSE_URL,PIXABAY_API_DOCS} from './stock-fast.mjs';
const $=id=>document.getElementById(id);
let opened=false,requestSerial=0,current=[],lastQuery='nature',activeController=null,pixabayKey='';
const cacheStorage=()=>{try{return window.localStorage;}catch{return null;}};
const api=()=>window.__subehaCut;
function node(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!=null)x.textContent=text;return x;}
function status(text){$('stock-status').textContent=text;}
function setup(){if($('stock-library'))return;
 const overlay=node('div','stock-overlay');overlay.id='stock-library';overlay.hidden=true;
 const sheet=node('section','stock-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label','無料素材を探す');
 sheet.innerHTML=`<header class="stock-header"><h2>素材を探す</h2><button id="stock-close" aria-label="閉じる" type="button">×</button></header>
 <p class="stock-intro">動画・音楽・効果音・3Dモデルなど、制作に使う素材を探します。<strong>宗教団体の宣伝にも使う場合、個別の権利確認が必要です。</strong></p>
 <form id="stock-form"><input id="stock-query" type="search" maxlength="100" placeholder="例：sky, nature, temple, abstract" required value="nature" aria-label="素材の検索語"><select id="stock-kind" aria-label="素材の種類"><option value="image">画像</option><option value="video">動画</option><option value="audio">音声</option><option value="music">音楽</option><option value="sfx">効果音</option><option value="model">3Dモデル</option><option value="vrm">VRMアバター</option><option value="texture">テクスチャ</option><option value="hdri">HDRI（照明）</option></select><select id="stock-provider" aria-label="素材の検索先"><option value="Openverse">Openverse</option><option value="Commons">Wikimedia Commons</option><option value="Pixabay">Pixabay（画像・動画）</option></select><button type="submit">検索</button></form>
 <details class="stock-pixabay-config" id="stock-pixabay-config"><summary>Pixabay API設定（画像・動画）</summary><p>Pixabayの公式APIキーを入力。キーはこのページを閉じるまでメモリ内だけで保持し、GitHub・ブラウザ保存領域・編集プロジェクトには保存しません。検索リクエストではPixabayに送信されます。</p><div class="stock-pixabay-key-row"><input type="password" id="stock-pixabay-key" placeholder="Pixabay APIキー" autocomplete="off" spellcheck="false" aria-label="Pixabay APIキー"><button type="button" id="stock-pixabay-save">このページで使用</button><button type="button" id="stock-pixabay-clear">解除</button></div><div class="stock-pixabay-doc"><a href="https://pixabay.com/api/docs/" target="_blank" rel="noopener noreferrer">公式APIとキーの取得</a><a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noopener noreferrer">コンテンツの利用条件</a></div><small id="stock-pixabay-key-state">APIキー未設定</small></details>
 <div class="stock-hints"><span>おすすめ:</span><button type="button" data-keyword="nature">自然</button><button type="button" data-keyword="temple">寺院</button><button type="button" data-keyword="stars">星空</button><button type="button" data-keyword="abstract">抽象</button></div>
 <p class="stock-terms" id="stock-terms">著作権表示が<strong>CC0またはパブリックドメイン</strong>の結果のみ表示します。素材の情報は提供元で再確認してください。人物が団体の信者・支持者であるかのような誤認表示を避けてください。</p>
 <label class="stock-confirm"><input id="stock-confirm" type="checkbox"> 利用条件と人物・商標等の権利を確認して取り込む</label>
 <div class="stock-credits-toolbar"><button type="button" id="stock-credit-list">使用素材の記録を確認</button><button type="button" id="stock-credit-export">権利情報をテキスト保存</button></div><p id="stock-status" role="status" aria-live="polite">検索すると素材が表示されます。</p><div id="stock-results" class="stock-results"></div>
 <aside class="stock-external"><strong>無料素材の配布元</strong><p>3D/VRM・NASA・Freesoundなどは、配布元で個別のライセンスを確認してダウンロードしてください。CC0でも人物の肖像・商標・団体への推奨誤認は別途注意。</p><div id="stock-catalog-links"></div><div><a id="stock-pixabay" target="_blank" rel="noopener noreferrer">Pixabayで探す</a><a id="stock-pexels" target="_blank" rel="noopener noreferrer">Pexelsで探す</a><button type="button" id="stock-local">端末から追加</button></div></aside>
 <p class="stock-legal"></p>`;
 overlay.append(sheet);document.body.append(overlay);
 sheet.querySelector('.stock-legal').textContent=STOCK_REUSE_NOTE;
 $('stock-close').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened)close();});
 $('stock-kind').onchange=()=>{
  const kind=$('stock-kind').value,selected=$('stock-provider').value;
  if(kind==='video'&&selected==='Openverse')$('stock-provider').value=pixabayKey?'Pixabay':'Commons';
  if(['audio','music','sfx'].includes(kind)&&selected==='Pixabay')$('stock-provider').value='Openverse';
  updateLinks();
 };
 $('stock-provider').onchange=()=>{
  if($('stock-kind').value==='video'&&$('stock-provider').value==='Openverse')$('stock-provider').value='Commons';
  if(['audio','music','sfx'].includes($('stock-kind').value)&&$('stock-provider').value==='Pixabay')$('stock-provider').value='Openverse';
  updateLinks();
 };
 $('stock-pixabay-save').onclick=()=>{
  const raw=$('stock-pixabay-key').value.trim();$('stock-pixabay-key').value='';
  if(!raw){status('PixabayのAPIキーを入力してください。');return;}
  pixabayKey=raw;
  $('stock-pixabay-key-state').textContent='APIキー設定済み（このページ内だけで有効）';
  if(['image','video'].includes($('stock-kind').value)){$('stock-provider').value='Pixabay';updateLinks();search();}
  else status('キーを設定しました。画像または動画を選ぶとPixabayで検索できます。');
 };
 $('stock-pixabay-clear').onclick=()=>{pixabayKey='';$('stock-pixabay-key').value='';$('stock-pixabay-key-state').textContent='APIキー未設定';status('Pixabayキーをこのページのメモリから解除しました。');};

 $('stock-form').onsubmit=e=>{e.preventDefault();search();};
 sheet.querySelectorAll('[data-keyword]').forEach(b=>b.onclick=()=>{$('stock-query').value=b.dataset.keyword;search();});
 $('stock-local').onclick=()=>{const kind=$('stock-kind').value;if(['model','vrm'].includes(kind)){close();window.__subehaCGOpen?.();$('cg-obj-picker')?.click();return;}const el=['audio','music','sfx'].includes(kind)?'pro-audio-picker':'file-picker';close();$(el)?.click();};
 $('stock-credit-list').onclick=()=>{const rows=api()?.state?.project?.stockCredits||[];status(rows.length?rows.map((x,i)=>`${i+1}. ${x.title}（${x.license}）― ${x.source}`).join(' ／ '):'まだ素材の取り込み記録はありません。');};
 $('stock-credit-export').onclick=()=>{const rows=api()?.state?.project?.stockCredits||[];if(!rows.length){status('権利情報を記録した素材はありません。');return;}const body='SUBEHA CUT 素材の使用記録\n（正式な利用許諾や肖像権を保証するものではありません）\n\n'+rows.map((x,i)=>`${i+1}. ${x.title}\n提供元: ${x.provider}\n作者: ${x.credit}\nライセンス: ${x.license}\nライセンス詳細: ${x.licenseUrl}\n原典: ${x.source}\n`).join('\n');const blob=new Blob([body],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob);const a=node('a');a.href=u;a.download='subeha-cut-素材の権利記録.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);status('権利情報の保存を開始しました');};
 updateLinks();
}
function updateLinks(){const links=sourceSearchLinks($('stock-query').value||lastQuery);$('stock-pixabay').href=links.pixabay;$('stock-pexels').href=links.pexels;
 const kind=$('stock-kind').value,items=STOCK_EXTERNAL_CATALOG[kind]||[],host=$('stock-catalog-links');host.replaceChildren();
 for(const item of items){const row=node('div','stock-source-row');const anchor=node('a','stock-source-link',item.name+'  ↗');anchor.href=links[item.key];anchor.target='_blank';anchor.rel='noopener noreferrer';const caption=node('small',null,item.license);row.append(anchor,caption);host.append(row);}
 const isModel=['model','vrm','texture','hdri'].includes(kind),is3D=['model','vrm'].includes(kind);
 const isPixabay=$('stock-provider').value==='Pixabay';
 const pixOption=$('stock-provider').querySelector('[value="Pixabay"]');
 if(pixOption)pixOption.disabled=!['image','video'].includes(kind);
 $('stock-pixabay-config').hidden=isModel||!['image','video'].includes(kind);
 $('stock-terms').textContent=isModel?'3D素材は配布元で個別に利用条件を確認してください。':isPixabay?
  'PixabayはCC0限定ではなくPixabay Content Licenseです。検索画面へのPixabayの出典リンクを付け、改変・広告利用・素材単独再配布禁止などの条件を確認してください。人物・商標・支持の誤認に注意。':
  '検索結果はCC0またはパブリックドメインの表記がある素材に限定しています。元サイトで再確認してください。';
 $('stock-provider').disabled=isModel;$('stock-form').querySelector('button[type=submit]').textContent=isModel?'配布元を表示':'検索';
 $('stock-local').hidden=['texture','hdri'].includes(kind);
 $('stock-local').textContent=is3D?'3Dモデルを端末から読み込む':'端末から追加';
 $('stock-confirm').closest('label').hidden=isModel;

}
function open(){setup();opened=true;$('stock-library').hidden=false;document.body.classList.add('stock-open');$('stock-query').focus();if(!current.length)search();}
function close(){opened=false;requestSerial++;activeController?.abort();activeController=null;if($('stock-library'))$('stock-library').hidden=true;document.body.classList.remove('stock-open');}
async function search(){
 const q=$('stock-query').value.trim(),selectedKind=$('stock-kind').value,kind=normalizeLibraryKind(selectedKind);
 if(!q){status('検索語を入力してください');return;}
 let provider=$('stock-provider').value;
 if(kind==='video'&&provider==='Openverse'){provider=pixabayKey?'Pixabay':'Commons';$('stock-provider').value=provider;}
 if(kind==='audio'&&provider==='Pixabay'){provider='Openverse';$('stock-provider').value=provider;}
 lastQuery=q;updateLinks();
 const token=++requestSerial;
 activeController?.abort();activeController=null;
 if(['model','vrm','texture','hdri'].includes(kind)){
  current=[];$('stock-results').replaceChildren();
  status('3D素材は上の配布元から検索できます。公式サイトで利用条件を確認してください。');return;
 }
 const term=selectedKind==='music'?q+' music':selectedKind==='sfx'?q+' sound effect':q;
 const cached=readStockCache(cacheStorage(),provider,kind,term);
 if(cached){
  current=cached;renderResults(current);
  status(current.length?provider+'：'+current.length+'件（保存済みの検索結果を即時表示）':provider+'：保存済みの検索結果は0件です。');
  return;
 }
 if(provider==='Pixabay'&&!pixabayKey){
  $('stock-pixabay-config').open=true;
  status('Pixabay検索にはAPIキーが必要です。上の「Pixabay API設定」でキーを入力してください。');
  $('stock-pixabay-key').focus();return;
 }
 // Keep old cards visible while searching: never blank the media library on a slow call.
 status(provider+'で検索中… 前の結果は表示したままです。');
 const controller=new AbortController();activeController=controller;
 let timedOut=false;
 const timeout=setTimeout(()=>{timedOut=true;controller.abort();},9000);
 const started=performance.now();
 try{
  const url=provider==='Pixabay'?pixabayQuery(pixabayKey,term,kind):
            provider==='Openverse'?openverseQuery(term,kind):commonsQuery(term,kind);
  const response=await fetch(url,{mode:'cors',signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw Error(readableError(response.status,provider));
  const json=await response.json();
  if(!opened||token!==requestSerial)return;
  const items=provider==='Pixabay'?normalizePixabay(json,kind):normalizeStockResults(provider,json,kind);
  current=items;
  writeStockCache(cacheStorage(),provider,kind,term,items);
  renderResults(current);
  const ms=Math.round(performance.now()-started);
  status(provider+'：'+items.length+'件・検索 '+ms+'ms'+(!items.length?'。候補なし。英語の語句や別の提供元を試してください。':'。元の素材ページで権利を確認してください。'));
 }catch(err){
  if(token!==requestSerial||!opened)return;
  if(err?.name==='AbortError'&&!timedOut)return;
  // Do not log the Pixabay URL/API key. Show a concise, actionable error.
  const reason=timedOut?'9秒で検索がタイムアウトしました。':'検索失敗：'+String(err?.message||'ネットワークまたはCORS制約。');
  status(provider+'：'+reason+' 別の提供元に切り替えるか再検索してください。');
 }finally{clearTimeout(timeout);if(activeController===controller)activeController=null;}
}
function renderResults(items){
 const box=$('stock-results');box.replaceChildren();
 for(const item of items)renderItem(item);
}
function renderItem(item){const card=node('article','stock-card');
 const preview=node('div','stock-preview');if((item.kind==='image'||item.kind==='video')&&item.thumbnail){const img=new Image();img.src=item.thumbnail;img.alt=item.title;img.loading='lazy';img.decoding='async';preview.append(img);}else preview.textContent=item.kind==='audio'?'♫ 音声素材':'▶ 動画素材';
 const info=node('div','stock-info');const title=node('strong','stock-name',item.title);const by=node('small','stock-by',`${item.provider} / ${item.credit} / ${item.license}`);const page=node('a','stock-origin',item.provider==='Pixabay'?'Pixabayで原典を見る':'元の素材を見る');page.href=item.source;page.target='_blank';page.rel='noopener noreferrer';
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
