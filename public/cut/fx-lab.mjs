/* Mobile-first, touch-driven grading and layerable procedural effects. */
import {FX_TYPES,FX_LABELS,FX_LOOKS,addFx,applyLookToClip,fxAmountAt} from './fx-lab-core.mjs';
import {OPTICAL_TYPES,OPTICAL_PARAMS} from './optical-fx.mjs';
import {spans} from './transitions.mjs';
import {FILTER_TYPES,filterStyle,addFilter,moveFilter,cloneFilterStack,filterCount} from './filter-stack.mjs';
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const REFERENCE_EFFECTS=[
 ['shake','シェイク','◌'],['prism-shift','プリズム','◭'],['offset','オフセット','▤'],
 ['oldfilm','古い映画','▣'],['mosaic','モザイク','▦'],['focusblur','焦点ぼけ','◉'],
 ['rgb','RGB','◈'],['pattern','パターン','▧'],['scan','スキャン','≋'],
 ['kaleido','カレイド','◇'],['vignette','周辺減光','●'],['pixelate','ピクセル化','▦'],
 ['grain','フィルム粒子','·']
].filter(([type])=>FX_TYPES.includes(type));
function mount(){
 const api=window.__subehaCut;if(!api||$('cut-fx-lab'))return;
 const state=api.state,root=$('app'),sheet=document.createElement('section');sheet.id='cut-fx-lab';sheet.hidden=true;
 sheet.innerHTML='<header><button type="button" id="cut-fx-close">‹</button><strong id="cut-fx-title">エフェクト</strong><button type="button" id="cut-fx-compare" title="加工前の映像と比べる" aria-label="加工前の映像と比べる">比較</button><button type="button" id="cut-fx-done">✓</button></header><nav class="cut-fx-tabs"><button type="button" data-page="filters">フィルタ</button><button type="button" data-page="grade">調整</button><button type="button" data-page="effects">エフェクト</button></nav><div id="cut-fx-content"></div>';
 root.append(sheet);
 let page='filters',pending=false,focusedFx=null;
 const activeClip=()=>state.project.clips.find(c=>c.id===state.selectedClip)||api.locate(state.project.clips,state.current)?.clip||null;
 const currentTime=clip=>{const span=spans(state.project.clips).find(s=>s.clip.id===clip.id);return Math.max(0,state.current-(span?.start||0));};
 function update(fn,commit=false){const c=activeClip();if(!c||state.recording)return;fn(c);api.draw();if(commit){pending=false;api.save();}else pending=true;}
 function store(){if(pending){pending=false;api.save();}}
 const close=()=>{window.__subehaCompareOriginal=false;window.__subehaCompareClipId=null;api.draw();store();sheet.hidden=true;document.body.classList.remove('cut-effects-mode');};$('cut-fx-close').onclick=close;$('cut-fx-done').onclick=close;
 window.__subehaFXClose=close;
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)close();});
 for(const b of sheet.querySelectorAll('[data-page]'))b.onclick=()=>{store();page=b.dataset.page;focusedFx=null;render();};
 const compare=$('cut-fx-compare');
 const setCompare=(active)=>{window.__subehaCompareOriginal=!!active&&!state.recording;window.__subehaCompareClipId=window.__subehaCompareOriginal?activeClip()?.id:null;compare.classList.toggle('pressed',window.__subehaCompareOriginal);api.draw();};
 compare.addEventListener('pointerdown',e=>{if(e.isPrimary){e.preventDefault();compare.setPointerCapture(e.pointerId);setCompare(true);}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])compare.addEventListener(event,()=>setCompare(false));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setCompare(false);});
 function render(){const scroll=sheet.scrollTop;const c=activeClip();sheet.dataset.page=page;sheet.dataset.detail=page==='effects'&&focusedFx?'true':'false';document.body.classList.toggle('cut-effects-mode',!sheet.hidden&&page==='effects');$('cut-fx-title').textContent=({filters:'フィルタ',grade:'調整',effects:'エフェクト'})[page]||'エフェクト';
  sheet.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(!c){$('cut-fx-content').innerHTML='<p class="cut-fx-empty">先にタイムラインで動画または画像を選んでください。</p>';return;}
  if(page==='filters')filters(c);else if(page==='looks')looks(c);else if(page==='grade')grade(c);else effects(c,page==='optics');sheet.scrollTop=scroll;
 }
 function filters(c){
  const rows=c.filterStack||[];
  const existingLegacy=c.filter&&c.filter!=='none';
  $('cut-fx-content').innerHTML=`<p class="cut-fx-help">好きな色フィルターを何枚でも重ねられます（最大16個）。強さと順番を変えると、すぐ映像に反映されます。上の「比較」を押している間は加工前を表示します。</p>
  <div class="cut-filter-picker">${Object.entries(FILTER_TYPES).map(([key,value])=>`<button data-new-filter="${key}" title="${value.description}">＋ ${value.label}</button>`).join('')}</div>
  ${existingLegacy?'<p class="cut-filter-legacy">以前設定した色フィルターも重なっています。 <button id="cut-filter-legacy-clear">以前の設定を解除</button></p>':''}
  <div id="cut-filter-stack">${rows.length?rows.map((f,i)=>`<section class="cut-filter-row${f.enabled===false?' is-off':''}" data-filter-id="${clean(f.id)}"><header><span class="cut-filter-order" data-drag-filter="${clean(f.id)}" title="押して上下に動かす">⠿</span><strong>${i+1}. ${FILTER_TYPES[f.type]?.label||'不明なフィルター'}</strong><div class="cut-filter-buttons"><button data-toggle-filter="${clean(f.id)}" aria-label="フィルターの切替">${f.enabled===false?'○':'●'}</button><button data-up-filter="${clean(f.id)}" aria-label="上へ">↑</button><button data-down-filter="${clean(f.id)}" aria-label="下へ">↓</button><button data-remove-filter="${clean(f.id)}" aria-label="この効果を削除">×</button></div></header><label>強さ <output data-filter-output="${clean(f.id)}">${Math.round((f.amount??.7)*100)}%</output><input type="range" data-filter-amount="${clean(f.id)}" min="0" max="1" step=".01" value="${f.amount??.7}" aria-label="${FILTER_TYPES[f.type]?.label||'色'}の強さ"></label></section>`).join(''):'<p class="cut-fx-empty">まだ色フィルターがありません。上から何個でも追加できます。</p>'}</div>
  <div class="cut-filter-bottom"><button id="cut-filters-copy">ほかの全クリップにコピー</button><button id="cut-filters-reset" class="cut-fx-danger">色フィルターをすべて外す</button></div><p class="cut-fx-help">現在 ${filterCount(rows)} 個有効。元の動画は変更されません。適用内容は作品と一緒に保存されます。</p>`;
  const selectedAsset=state.assets.get(c.assetId);
  for(const b of $('cut-fx-content').querySelectorAll('[data-new-filter]')){
   const thumb=document.createElement('i');thumb.className='cut-filter-thumbnail';
   if(selectedAsset?.thumb)thumb.style.backgroundImage='url('+JSON.stringify(selectedAsset.thumb)+')';
   thumb.style.filter=filterStyle(b.dataset.newFilter,.7);
   b.prepend(thumb);
  }
  const find=id=>(activeClip()?.filterStack||[]).find(f=>f.id===id);
  for(const b of $('cut-fx-content').querySelectorAll('[data-new-filter]'))b.onclick=()=>{try{update(x=>x.filterStack=addFilter(x.filterStack,b.dataset.newFilter),true);render();}catch(err){api.toast(err.message);}};
  for(const r of $('cut-fx-content').querySelectorAll('[data-filter-amount]')){
   r.oninput=()=>{const f=find(r.dataset.filterAmount);if(!f)return;f.amount=+r.value;const output=$('cut-fx-content').querySelector('[data-filter-output="'+r.dataset.filterAmount+'"]');if(output)output.textContent=Math.round(f.amount*100)+'%';pending=true;api.draw();};
   r.onchange=store;r.onpointerup=store;r.onpointercancel=store;
  }
  for(const action of ['toggle','up','down','remove'])for(const b of $('cut-fx-content').querySelectorAll(`[data-${action}-filter]`))b.onclick=()=>{
   const id=b.dataset[action+'Filter'];update(x=>{const a=x.filterStack||[],i=a.findIndex(f=>f.id===id);if(i<0)return;
    if(action==='toggle')a[i].enabled=a[i].enabled===false;
    if(action==='up')x.filterStack=moveFilter(a,id,i-1);
    if(action==='down')x.filterStack=moveFilter(a,id,i+1);
    if(action==='remove')a.splice(i,1);
   },true);render();
  };
  const legacy=$('cut-filter-legacy-clear');if(legacy)legacy.onclick=()=>{update(x=>x.filter='none',true);render();};
  $('cut-filters-reset').onclick=()=>{update(x=>{x.filterStack=[];x.filter='none';},true);render();};
  $('cut-filters-copy').onclick=()=>{const origin=activeClip();if(!origin)return;const stack=cloneFilterStack(origin.filterStack),legacy=origin.filter||'none';
   for(const other of state.project.clips)if(other.id!==origin.id){other.filterStack=cloneFilterStack(stack);other.filter=legacy;}
   api.save();api.draw();api.toast('全クリップに色フィルターをコピーしました');};
  // The handle is draggable on a touchscreen; arrow buttons remain for accessibility.
  for(const handle of $('cut-fx-content').querySelectorAll('[data-drag-filter]')){
   let dragging=false,startY=0,targetIndex=-1;
   handle.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;dragging=true;startY=e.clientY;targetIndex=-1;handle.setPointerCapture(e.pointerId);handle.classList.add('dragging');});
   handle.addEventListener('pointermove',e=>{if(!dragging)return;e.preventDefault();const rows=[...$('cut-filter-stack').querySelectorAll('[data-filter-id]')];targetIndex=rows.findIndex(row=>e.clientY<row.getBoundingClientRect().bottom);if(targetIndex<0)targetIndex=rows.length-1;rows.forEach((row,i)=>row.classList.toggle('drop-target',i===targetIndex));});
   const finish=e=>{if(!dragging)return;dragging=false;handle.classList.remove('dragging');if(targetIndex>=0&&Math.abs(e.clientY-startY)>6){update(c=>c.filterStack=moveFilter(c.filterStack,handle.dataset.dragFilter,targetIndex),true);render();}else $('cut-filter-stack').querySelectorAll('[data-filter-id]').forEach(r=>r.classList.remove('drop-target'));};
   handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',()=>{dragging=false;handle.classList.remove('dragging');});
  }
 }
 function looks(c){
  $('cut-fx-content').innerHTML='<p class="cut-fx-help">選んだルックは後から色も効果も自由に変更できます。</p><div class="cut-fx-looks">'+Object.entries(FX_LOOKS).map(([k,v])=>`<button type="button" data-look="${k}"><span class="cut-fx-cover cut-fx-cover-${k}">◈</span><b>${v.name}</b></button>`).join('')+'</div><button type="button" id="cut-fx-reset-all" class="cut-fx-danger">全調整を解除</button>';
  $('cut-fx-content').querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{update(clip=>Object.assign(clip,applyLookToClip(clip,b.dataset.look)),true);page='grade';render();api.toast('編集可能なルックを適用しました');});
  $('cut-fx-reset-all').onclick=()=>{update(clip=>{clip.grade={};clip.fxStack=[];clip.effect='none';clip.filter='none';clip.adjust={};},true);render();};
 }
 const values=[['exposure','明るさ',-100,100],['contrast','コントラスト',-80,100],['saturation','彩度',-100,200],['warmth','色温度',-100,100],['fade','フィルムの白浮き',0,100]];
 function grade(c){
  $('cut-fx-content').innerHTML='<p class="cut-fx-help">指でスライダーを動かしてすぐにプレビュー。映像は元のまま非破壊で保存。</p><div class="cut-fx-grade">'+values.map(([key,label,min,max])=>`<label>${label}<span id="cut-grade-val-${key}">${c.grade?.[key]||0}</span><input type="range" data-grade="${key}" min="${min}" max="${max}" step="1" value="${c.grade?.[key]||0}"></label>`).join('')+'</div><button id="cut-fx-grade-reset">色調をリセット</button>';
  $('cut-fx-content').querySelectorAll('[data-grade]').forEach(input=>{input.oninput=()=>{const k=input.dataset.grade,$v=$('cut-grade-val-'+k);$v.textContent=input.value;update(c=>{c.grade={...(c.grade||{}),[k]:+input.value};});};input.onchange=store;input.onpointerup=store;});
  $('cut-fx-grade-reset').onclick=()=>{update(c=>c.grade={},true);render();};
 }
 function opticalValue(fx,key){
  const parameter=OPTICAL_PARAMS[key],n=Number(fx.optics?.[key]);
  return Number.isFinite(n)?Math.max(parameter.min,Math.min(parameter.max,n)):parameter.default;
 }
 function opticalControls(fx){
  if(!OPTICAL_TYPES.includes(fx.type))return '';
  const id=clean(fx.id),cx=opticalValue(fx,'centerX'),cy=opticalValue(fx,'centerY');
  const rows=Object.entries(OPTICAL_PARAMS).map(([key,p])=>{
   const v=opticalValue(fx,key);
   return '<label>'+p.label+' <output data-optic-output="'+id+'-'+key+'">'+v.toFixed(p.step<1?2:0)+'</output>'+
    '<input type="range" data-optic-id="'+id+'" data-optic-key="'+key+'" min="'+p.min+'" max="'+p.max+'" step="'+p.step+'" value="'+v+'"></label>';
  }).join('');
  return '<details class="cut-optics" data-optic-section="'+id+'"><summary>光学レンズの設定（方向・中心・細かさ）</summary>'+
   '<div class="cut-optic-controls">'+rows+'</div>'+
   '<p>レンズの中心を指で移動できます。変更はプレビューと書き出しに反映されます。</p>'+
   '<div class="cut-optic-pad" data-optic-pad="'+id+'" role="group" aria-label="レンズ中心を動かす">'+
   '<i style="left:'+Math.round(cx*100)+'%;top:'+Math.round((1-cy)*100)+'%"></i></div></details>';
 }
 function effects(c,onlyOptics=false){
  const arr=c.fxStack||[];
  const rows=focusedFx?arr.filter(fx=>fx.id===focusedFx):arr;
  sheet.dataset.detail=page==='effects'&&!!focusedFx&&rows.length?'true':'false';
  $('cut-fx-content').innerHTML='<p class="cut-fx-help">エフェクトは重ねて使えます。表示中の時間に「◆キー」を付けると強さが時間変化します。</p><div class="cut-fx-picker cut-fx-carousel">'+(onlyOptics?OPTICAL_TYPES.map(type=>[type,FX_LABELS[type],'◇']):REFERENCE_EFFECTS).map(([type,label,glyph])=>`<button type="button" data-add-fx="${type}" title="${label}"><span class="cut-fx-glyph" aria-hidden="true">${glyph}</span><span>${label}</span></button>`).join('')+'</div><div id="cut-fx-stack">'+(rows.length?rows.map((fx,index)=>`<section class="cut-fx-unit" data-fx-row="${clean(fx.id)}"><header><b>${index+1}. ${FX_LABELS[fx.type]||fx.type}</b><div><button data-up="${clean(fx.id)}" aria-label="上へ">↑</button><button data-down="${clean(fx.id)}" aria-label="下へ">↓</button><button data-remove="${clean(fx.id)}" aria-label="削除">×</button></div></header><label>強さ <output data-fx-value="${clean(fx.id)}">${Math.round(fxAmountAt(fx,currentTime(c))*100)}%</output><input type="range" data-fx-input="${clean(fx.id)}" min="0" max="1" step=".01" value="${fxAmountAt(fx,currentTime(c))}"></label>${opticalControls(fx)}<div class="cut-fx-keys"><button data-key="${clean(fx.id)}">◆ 現在位置にキー</button><button data-start="${clean(fx.id)}">IN</button><button data-end="${clean(fx.id)}">OUT</button><button data-clear="${clean(fx.id)}">キー削除</button></div><small>キー ${fx.keys?.length||0}個 ${Number(fx.start)>0?' / IN '+fx.start.toFixed(1)+'s':''} ${Number(fx.end)>0?' / OUT '+fx.end.toFixed(1)+'s':''}</small></section>`).join(''):'<div class="cut-fx-empty">まだ効果がありません。上から追加できます。</div>')+'</div>';
  for(const b of $('cut-fx-content').querySelectorAll('[data-add-fx]'))b.onclick=()=>{
   const clip=activeClip();if(!clip)return;
   let added=null;
   update(c=>{
    const initial=c.fxStack||[];
    const next=addFx(initial,b.dataset.addFx);
    if(next.length===initial.length){api.toast('エフェクトは10個まで追加できます');return;}
    added=next[next.length-1];
    // Videoleap places an effect at the current timeline position, not at 00:00.
    added.start=Math.max(0,currentTime(c));c.fxStack=next;
   },true);
   if(added){focusedFx=added.id;api.refreshAll();}
   render();
  };
  const find=id=>(activeClip()?.fxStack||[]).find(fx=>fx.id===id);
  for(const slider of $('cut-fx-content').querySelectorAll('[data-optic-id]')){
   slider.oninput=()=>{
    if(state.recording)return;
    const fx=find(slider.dataset.opticId);if(!fx)return;
    const key=slider.dataset.opticKey;fx.optics={...(fx.optics||{}),[key]:Number(slider.value)};
    const out=$('cut-fx-content').querySelector('[data-optic-output="'+fx.id+'-'+key+'"]');
    if(out)out.textContent=Number(slider.value).toFixed(OPTICAL_PARAMS[key].step<1?2:0);
    const pad=$('cut-fx-content').querySelector('[data-optic-pad="'+fx.id+'"]');
    if(pad&&(key==='centerX'||key==='centerY')){
     const dot=pad.querySelector('i');dot.style.left=Math.round(opticalValue(fx,'centerX')*100)+'%';
     dot.style.top=Math.round((1-opticalValue(fx,'centerY'))*100)+'%';
    }
    pending=true;api.draw();
   };
   slider.onchange=store;slider.onpointerup=store;slider.onpointercancel=store;
  }
  for(const pad of $('cut-fx-content').querySelectorAll('[data-optic-pad]')){
   let grabbed=false;
   const move=e=>{
    if(!grabbed||state.recording)return;
    const fx=find(pad.dataset.opticPad);if(!fx)return;
    const rect=pad.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/Math.max(1,rect.width)));
    const y=Math.max(0,Math.min(1,1-(e.clientY-rect.top)/Math.max(1,rect.height)));
    fx.optics={...(fx.optics||{}),centerX:x,centerY:y};
    pad.querySelector('i').style.left=Math.round(x*100)+'%';
    pad.querySelector('i').style.top=Math.round((1-y)*100)+'%';
    for(const [key,v] of [['centerX',x],['centerY',y]]){
     const range=$('cut-fx-content').querySelector('[data-optic-key="'+key+'"][data-optic-id="'+fx.id+'"]');
     const out=$('cut-fx-content').querySelector('[data-optic-output="'+fx.id+'-'+key+'"]');
     if(range)range.value=String(v);if(out)out.textContent=v.toFixed(2);
    }
    pending=true;api.draw();
   };
   pad.addEventListener('pointerdown',e=>{if(state.recording)return;e.preventDefault();grabbed=true;pad.setPointerCapture(e.pointerId);move(e);});
   pad.addEventListener('pointermove',move);
   const finish=()=>{if(grabbed){grabbed=false;store();}};
   pad.addEventListener('pointerup',finish);pad.addEventListener('pointercancel',finish);
  }
  for(const range of $('cut-fx-content').querySelectorAll('[data-fx-input]')){
   range.oninput=()=>{const fx=find(range.dataset.fxInput);if(!fx)return;fx.amount=+range.value;
    if((fx.keys||[]).length){const t=currentTime(activeClip()),existing=fx.keys.find(k=>Math.abs(k.time-t)<.05);if(existing)existing.amount=fx.amount;else fx.keys.push({time:t,amount:fx.amount});}
    const o=$('cut-fx-content').querySelector('[data-fx-value="'+range.dataset.fxInput+'"]');if(o)o.textContent=Math.round(fx.amount*100)+'%';pending=true;api.draw();};
   range.onchange=store;range.onpointerup=store;
  }
  for(const action of ['up','down','remove','key','start','end','clear'])for(const b of $('cut-fx-content').querySelectorAll(`[data-${action}]`))b.onclick=()=>{
   const id=b.dataset[action],t=currentTime(activeClip());update(clip=>{const a=clip.fxStack||[],i=a.findIndex(x=>x.id===id),fx=a[i];if(!fx)return;
     if(action==='remove')a.splice(i,1);
     if(action==='up'&&i>0)[a[i-1],a[i]]=[a[i],a[i-1]];
     if(action==='down'&&i<a.length-1)[a[i+1],a[i]]=[a[i],a[i+1]];
     if(action==='key'){fx.keys ||= [];fx.keys=fx.keys.filter(k=>Math.abs(k.time-t)>.05);fx.keys.push({time:t,amount:fx.amount});}
     if(action==='start')fx.start=t;
     if(action==='end')fx.end=t;
     if(action==='clear')fx.keys=[];
   },true);render();};
 }
 window.__subehaFXFocus=(clipId,fxId)=>{
  const clip=state.project.clips.find(c=>c.id===clipId);
  if(!clip||!(clip.fxStack||[]).some(f=>f.id===fxId))return false;
  state.selectedClip=clipId;focusedFx=fxId;page='effects';
  openEffectsPanel();requestAnimationFrame(()=>{
   const node=sheet.querySelector('[data-fx-row="'+fxId+'"]');node?.scrollIntoView({block:'nearest',inline:'nearest'});
  });return true;
 };
 function openEffectsPanel(){
  $('leap-mini-sheet')&&($('leap-mini-sheet').hidden=true);$('leap-extras')&&($('leap-extras').hidden=true);
  document.body.classList.remove('pro-open');document.querySelector('.tools-shell')?.classList.remove('pro-visible');
  $('cut-direct-sheet')&&($('cut-direct-sheet').hidden=true);sheet.hidden=false;render();
 }
 window.__subehaFXOpen=(target='filters')=>{if(['filters','grade','effects'].includes(target))page=target;else if(target==='optics')page='effects';
  focusedFx=null;openEffectsPanel();};
 /* Legacy source clients can still use __subehaFXOpen, but not open bespoke tabs. */
 window.addEventListener('subeha-cut-change',()=>{if(!sheet.hidden&&!pending)requestAnimationFrame(render);});
}
if(window.__subehaCut){if(document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',()=>requestAnimationFrame(mount),{once:true});}
