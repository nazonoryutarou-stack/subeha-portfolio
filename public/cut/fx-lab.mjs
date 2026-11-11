/* Mobile-first, touch-driven grading and layerable procedural effects. */
import {FX_TYPES,FX_LABELS,FX_LOOKS,addFx,applyLookToClip,fxAmountAt} from './fx-lab-core.mjs';
import {spans} from './transitions.mjs';
const $=id=>document.getElementById(id);
const clean=s=>String(s||'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
function mount(){
 const api=window.__subehaCut;if(!api||$('cut-fx-lab'))return;
 const state=api.state,root=$('app'),sheet=document.createElement('section');sheet.id='cut-fx-lab';sheet.hidden=true;
 sheet.innerHTML='<header><button type="button" id="cut-fx-close">‹</button><strong id="cut-fx-title">カラー・演出ラボ</strong><button type="button" id="cut-fx-done">✓</button></header><nav class="cut-fx-tabs"><button type="button" data-page="looks">ルック</button><button type="button" data-page="grade">色調</button><button type="button" data-page="effects">効果レイヤー</button></nav><div id="cut-fx-content"></div>';
 root.append(sheet);
 let page='looks',pending=false;
 const activeClip=()=>state.project.clips.find(c=>c.id===state.selectedClip)||api.locate(state.project.clips,state.current)?.clip||null;
 const currentTime=clip=>{const span=spans(state.project.clips).find(s=>s.clip.id===clip.id);return Math.max(0,state.current-(span?.start||0));};
 function update(fn,commit=false){const c=activeClip();if(!c||state.recording)return;fn(c);api.draw();if(commit){pending=false;api.save();}else pending=true;}
 function store(){if(pending){pending=false;api.save();}}
 const close=()=>{store();sheet.hidden=true;};$('cut-fx-close').onclick=close;$('cut-fx-done').onclick=close;
 for(const b of sheet.querySelectorAll('[data-page]'))b.onclick=()=>{store();page=b.dataset.page;render();};
 function render(){const c=activeClip();$('cut-fx-title').textContent=c?'カラー・演出 · '+String(c.name).slice(0,17):'カラー・演出ラボ';
  sheet.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  if(!c){$('cut-fx-content').innerHTML='<p class="cut-fx-empty">先にタイムラインで動画または画像を選んでください。</p>';return;}
  if(page==='looks')looks(c);else if(page==='grade')grade(c);else effects(c);
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
 function effects(c){
  const arr=c.fxStack||[];
  $('cut-fx-content').innerHTML='<p class="cut-fx-help">エフェクトは重ねて使えます。表示中の時間に「◆キー」を付けると強さが時間変化します。</p><div class="cut-fx-picker">'+FX_TYPES.map(type=>`<button type="button" data-add-fx="${type}">＋ ${FX_LABELS[type]}</button>`).join('')+'</div><div id="cut-fx-stack">'+(arr.length?arr.map((fx,index)=>`<section class="cut-fx-unit" data-fx-row="${clean(fx.id)}"><header><b>${index+1}. ${FX_LABELS[fx.type]||fx.type}</b><div><button data-up="${clean(fx.id)}" aria-label="上へ">↑</button><button data-down="${clean(fx.id)}" aria-label="下へ">↓</button><button data-remove="${clean(fx.id)}" aria-label="削除">×</button></div></header><label>強さ <output data-fx-value="${clean(fx.id)}">${Math.round(fxAmountAt(fx,currentTime(c))*100)}%</output><input type="range" data-fx-input="${clean(fx.id)}" min="0" max="1" step=".01" value="${fxAmountAt(fx,currentTime(c))}"></label><div class="cut-fx-keys"><button data-key="${clean(fx.id)}">◆ 現在位置にキー</button><button data-start="${clean(fx.id)}">IN</button><button data-end="${clean(fx.id)}">OUT</button><button data-clear="${clean(fx.id)}">キー削除</button></div><small>キー ${fx.keys?.length||0}個 ${Number(fx.start)>0?' / IN '+fx.start.toFixed(1)+'s':''} ${Number(fx.end)>0?' / OUT '+fx.end.toFixed(1)+'s':''}</small></section>`).join(''):'<div class="cut-fx-empty">まだ効果がありません。上から追加できます。</div>')+'</div>';
  for(const b of $('cut-fx-content').querySelectorAll('[data-add-fx]'))b.onclick=()=>{update(clip=>clip.fxStack=addFx(clip.fxStack,b.dataset.addFx),true);render();};
  const find=id=>(activeClip()?.fxStack||[]).find(fx=>fx.id===id);
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
 window.__subehaFXOpen=(target='looks')=>{if(['looks','grade','effects'].includes(target))page=target;
  $('leap-mini-sheet')&&($('leap-mini-sheet').hidden=true);$('leap-extras')&&($('leap-extras').hidden=true);
  document.body.classList.remove('pro-open');document.querySelector('.tools-shell')?.classList.remove('pro-visible');
  $('cut-direct-sheet')&&($('cut-direct-sheet').hidden=true);sheet.hidden=false;render();};
 window.addEventListener('subeha-cut-change',()=>{if(!sheet.hidden&&!pending)requestAnimationFrame(render);});
}
if(window.__subehaCut){if(document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',()=>requestAnimationFrame(mount),{once:true});}
