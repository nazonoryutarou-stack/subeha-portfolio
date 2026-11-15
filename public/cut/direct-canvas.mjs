/* Touch-first overlay manipulation. DOM handles are editor-only; never appear in export frames. */
import {activeCue,captionLayout,captionAppearance} from './subtitles.mjs';
import {clamp,containsRotated,textBounds,moveBy,scaleBy,stepRotation,positionFromClient,pointerGap,pointerAngle} from './direct-geometry.mjs';
import {applyOverlayTransform} from './touch-edit.mjs';
import {widthFromDrag,nearbyGuides} from './title-gestures.mjs';
import {TEXT_FONTS,TEXT_PRESETS,applyTextPreset} from './text-styles.mjs';
import {PBR_TITLE_PRESETS,normalizedPbrTitle,applyPbrPreset} from './pbr-title-core.mjs';
import {canUsePbrTitle} from './pbr-title-render.mjs';
import {TEXT_MOTION_TYPES,TEXT_MOTION_UNITS,TEXT_MOTION_EASINGS,TITLE_KEYFRAME_FIELDS,normalizedTextMotion,titleAt,upsertTitleKeyframe} from './text-motion-core.mjs';
const $=id=>document.getElementById(id);
const colors=['#ffffff','#000000','#ff526d','#ffe066','#5fd8f5','#ad80ff','#70f4a4'];
const safe=s=>String(s||'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
function mount(){
 const api=window.__subehaCut;if(!api||$('cut-direct-frame'))return;
 const {state,canvas,ctx,save,draw,refreshAll}=api,stage=$('preview-stage');
 window.__subehaDirectTextActive=true;
 const box=document.createElement('div');box.id='cut-direct-frame';box.hidden=true;
 box.innerHTML='<span class="cut-direct-caption">テキスト</span><button class="cut-direct-handle cut-direct-resize" title="サイズを変える" aria-label="サイズ変更">↘</button><button class="cut-direct-handle cut-direct-rotate" title="回転" aria-label="回転">⟳</button><button class="cut-direct-handle cut-direct-width" title="指で文字枠の幅を変える" aria-label="文字の折り返し幅を変える">↔</button>';
 stage.append(box);
 const guides=document.createElement('div');guides.id='cut-title-guides';guides.hidden=true;guides.innerHTML='<i class="cut-guide-v"></i><i class="cut-guide-h"></i>';stage.append(guides);
 const bar=document.createElement('div');bar.id='cut-direct-bar';bar.hidden=true;
 bar.innerHTML='<button data-do="edit">編集</button><button data-do="straighten" aria-label="角度を0度に戻す">⟲ 0°</button><button data-do="duplicate">複製</button><button data-do="delete">削除</button><button data-do="close">✓</button>';
 stage.append(bar);
 const panel=document.createElement('div');panel.id='cut-direct-sheet';panel.hidden=true;
 panel.innerHTML=`<header><strong id="cut-direct-title">文字を編集</strong><button id="cut-direct-close" aria-label="閉じる">×</button></header>
  <div id="cut-title-tabs" class="cut-title-tabs" role="tablist"><button data-tab="words" class="active">文字</button><button data-tab="font">字体</button><button data-tab="appearance">色と縁</button><button data-tab="layout">配置</button><button data-tab="motion">動き</button></div>
  <div id="cut-title-words" class="cut-title-pane"><textarea id="cut-direct-input" rows="3" maxlength="500" aria-label="文字を編集" placeholder="映像に表示する文字"></textarea><div class="cut-direct-palette">${colors.map(c=>`<button data-color="${c}" style="--swatch:${c}" title="${c}" aria-label="文字色 ${c}"></button>`).join('')}<input type="color" id="cut-direct-color" title="任意の文字色"></div><p>文字を2回タップして編集。枠を移動、右端で改行幅を変更、↘で拡大、上部⟳で回転できます。</p></div>
  <div id="cut-title-font" class="cut-title-pane" hidden><div id="cut-title-font-list" class="cut-title-font-list"></div><div id="cut-title-presets" class="cut-title-font-list"></div></div>
  <div id="cut-title-appearance" class="cut-title-pane" hidden><div class="cut-title-inputs"><label>文字色 <input data-appearance="color" type="color"></label><label>縁取り色 <input data-appearance="outlineColor" type="color"></label><label>背景色 <input data-appearance="boxColor" type="color"></label></div><div id="cut-title-appearance-sliders"></div><button id="cut-direct-bg" class="cut-title-pill">▧ 背景を表示／非表示</button></div>
  <div id="cut-title-layout" class="cut-title-pane" hidden><div class="cut-title-alignment"><button data-align="left">左寄せ</button><button data-align="center">中央</button><button data-align="right">右寄せ</button></div><div id="cut-title-layout-sliders"></div><button id="cut-title-center" class="cut-title-pill">＋ 画面の中央へ</button></div>
  <div id="cut-title-motion" class="cut-title-pane" hidden><div class="cut-title-alignment"><button data-motion="none">なし</button><button data-motion="fade">ふわっと</button><button data-motion="pop">飛び出す</button><button data-motion="slide">下から</button></div><p>文字の登場演出を選べます。動画と文字は別々に編集できます。</p></div>
  <p class="cut-title-tip">編集枠と操作ボタンは、完成動画には映りません。</p>`;
 $('app').append(panel);
 const pbrTab=document.createElement('button');pbrTab.type='button';pbrTab.dataset.tab='pbr';pbrTab.textContent='立体文字';
 $('cut-title-tabs').append(pbrTab);
 const pbrPane=document.createElement('div');pbrPane.id='cut-title-pbr';pbrPane.className='cut-title-pane';pbrPane.hidden=true;
 pbrPane.innerHTML='<label class="cut-pbr-enable"><input id="cut-pbr-enable" type="checkbox"> 立体文字のGPU材質を有効にする</label>'+
 '<p>文字形状を押し出したように見せる2.5D描画。日本語の文字にも対応します。</p>'+
 '<div id="cut-pbr-presets" class="cut-pbr-presets"></div>'+
 '<div id="cut-pbr-controls" class="cut-pbr-controls"></div>'+
 '<details class="cut-pbr-light-details" open><summary>☀ 2つのライトを指で調整</summary>'+
 '<div class="cut-pbr-lightpad" id="cut-pbr-lightpad" aria-label="光源方向の操作盤"><button type="button" data-pbr-light="1">☀1</button><button type="button" data-pbr-light="2">☀2</button></div>'+
 '<p>光源の点をドラッグ。中心ほど正面から、外側ほど斜めから照らします。</p>'+
 '<div id="cut-pbr-light-controls" class="cut-pbr-controls"></div></details>'+
 '<p id="cut-pbr-gpu-status" role="status">GPUの対応状況を確認中</p>'+
 '<p>文字・単語・行単位のアニメと同時に使用した場合は軽量2D表示に戻ります。全体アニメではGPU材質を維持します。</p>';
 $('cut-title-motion').after(pbrPane);
 const pbrControls=[
  ['pbrMetallic','金属度',0,1,.01],['pbrRoughness','表面の粗さ',.04,1,.01],
  ['pbrBumpiness','表面の凹凸',0,1,.01],['pbrEnvironment','環境反射',0,1,.01],
  ['pbrDepth','文字の厚み',0,36,1],['pbrBevel','縁の丸み',.5,12,.5],
  ['pbrSpin','反射の回転',-1,1,.05]
 ];
 const pbrLightControls=[
  ['pbrLight1Angle','光源1の角度',0,360,1],['pbrLight1Elevation','光源1の高さ',.05,1,.01],
  ['pbrLight1Intensity','光源1の明るさ',0,2,.05],
  ['pbrLight2Angle','光源2の角度',0,360,1],['pbrLight2Elevation','光源2の高さ',.05,1,.01],
  ['pbrLight2Intensity','光源2の明るさ',0,2,.05]
 ];
 function buildPbrControl([key,label,min,max,step]){
  const el=document.createElement('label');el.className='cut-pbr-slider';
  const text=document.createElement('span');text.textContent=label;
  const output=document.createElement('output');output.dataset.pbrOutput=key;
  const input=document.createElement('input');input.type='range';input.min=min;input.max=max;input.step=step;input.dataset.pbrProp=key;
  el.append(text,output,input);return el;
 }
 const presetBox=$('cut-pbr-presets');for(const [key,preset] of Object.entries(PBR_TITLE_PRESETS)){
  const b=document.createElement('button');b.type='button';b.dataset.pbrPreset=key;b.textContent=preset.label;b.style.setProperty('--pbr-color',preset.color);
  presetBox.append(b);
 }
 $('cut-pbr-controls').append(...pbrControls.map(buildPbrControl));
 $('cut-pbr-light-controls').append(...pbrLightControls.map(buildPbrControl));
 const pbrTint=document.createElement('div');pbrTint.className='cut-pbr-tints';
 for(const [prop,label] of [['pbrColor','材質の色'],['pbrLight1Color','ライト1の色'],['pbrLight2Color','ライト2の色']]){
  const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type='color';input.dataset.pbrProp=prop;
  row.append(input);pbrTint.append(row);
 }
 $('cut-pbr-light-controls').after(pbrTint);
 const advanced=document.createElement('div');advanced.id='cut-text-motion-lab';
 advanced.innerHTML=`<div class="cut-motion-grid">
  <label>アニメ<select data-tmotion="type"></select></label>
  <label>動かす単位<select data-tmotion="unit"></select></label>
  <label>方向<select data-tmotion="direction"></select></label>
  <label>登場・退場<select data-tmotion="phase"></select></label>
  <label>動きの補間<select data-tmotion="easing"></select></label>
 </div>
 <label class="cut-motion-slider">効果時間 <output id="cut-motion-duration-label">0.80秒</output><input data-tmotion="duration" type="range" min=".15" max="4" step=".05" value=".8"></label>
 <label class="cut-motion-slider">文字の時間差 <output id="cut-motion-stagger-label">0.09秒</output><input data-tmotion="stagger" type="range" min="0" max=".4" step=".01" value=".09"></label>
 <label class="cut-motion-check"><input data-tmotion="reverse" type="checkbox"> 逆順に動かす</label>
 <button id="cut-motion-preview" class="cut-title-pill" type="button">▶ この文字を再生</button>
 <div class="cut-motion-keyframes"><strong>◇ 文字のキーフレーム</strong>
  <p>時刻を動かしてキーを記録すると、その時点の位置・拡大率・色・字間などを補間します。</p>
  <label class="cut-motion-check"><input id="cut-keyframe-mode" type="checkbox"> 指の操作・色と配置の変更を現在の時刻に記録</label>
  <div class="cut-motion-actions"><button id="cut-keyframe-add" type="button">＋ 現在位置にキーを追加</button><button id="cut-keyframe-clear" type="button">全キー削除</button></div>
  <label>キー間の補間 <select id="cut-keyframe-easing"></select></label>
  <small id="cut-keyframe-count">0個のキーフレーム</small>
 </div>`;
 $('cut-title-motion').append(advanced);
 const choices=(key,entries)=>{const select=panel.querySelector('[data-tmotion="'+key+'"]');for(const [value,label] of entries){const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.append(opt);}};
 choices('type',TEXT_MOTION_TYPES.map(k=>[k,({none:'なし',fade:'ふわっと',slide:'スライド',scale:'拡大',bounce:'バウンド',typewriter:'タイプライター',wave:'波',wiggle:'揺れ',flicker:'点滅',spin:'回転',fall:'落下',blur:'ぼけ',reveal:'出現'}[k]||k)]));
 choices('unit',TEXT_MOTION_UNITS.map(k=>[k,({glyph:'文字ごと',word:'単語ごと',line:'行ごと',global:'全体'}[k]||k)]));
 choices('direction',[['up','上から'],['down','下から'],['left','左から'],['right','右から']]);
 choices('phase',[['in','登場'],['out','退場'],['both','登場＋退場']]);
 choices('easing',TEXT_MOTION_EASINGS.map(k=>[k,({linear:'一定',quadInOut:'滑らか',expoOut:'急停止',circInOut:'円弧',backIn:'引いて入る',elasticOut:'弾性',backInOut:'前後に反動',circOut:'円弧の停止'}[k]||k)]));
 const keyEase=$('cut-keyframe-easing');for(const k of TEXT_MOTION_EASINGS){const option=document.createElement('option');option.value=k;option.textContent=({linear:'一定',quadInOut:'滑らか',expoOut:'急停止',circInOut:'円弧',backIn:'引いて入る',elasticOut:'弾性',backInOut:'前後に反動',circOut:'円弧の停止'}[k]||k);keyEase.append(option);}
 let selection=null,gest=null,lastTextId=null,dirty=false,lastRender=0,lastTap=null,activeTab="words";
 const fps=()=>state.current;
 const cueNow=()=>activeCue(state.project.captions||[],fps());
 function visible(kind,item){if(kind==='text')return item.text&&fps()>=item.start&&fps()<=item.start+item.duration;return item.text&&state.project.captionEnabled!==false&&fps()>=item.start&&fps()<item.end;}
 function itemFor(sel){if(!sel)return null;const items=sel.kind==='text'?state.project.texts:sel.kind==='caption'?state.project.captions:state.project.overlays;return (items||[]).find(i=>i.id===sel.id)||null;}
 function overlayProps(layer){const local=fps()-layer.start,points=[...(layer.keyframes||[])].sort((a,b)=>a.time-b.time),base={x:layer.x??.5,y:layer.y??.5,scale:layer.scale??.5,rotation:layer.rotation||0};
  if(!points.length)return base;
  let a=points[0],b=points.at(-1);if(local<=a.time)return {...base,...a};if(local>=b.time)return {...base,...b};
  for(let i=1;i<points.length;i++)if(local<=points[i].time){a=points[i-1];b=points[i];break;}
  const t=clamp((local-a.time)/(b.time-a.time),0,1),out={...base};for(const key of Object.keys(base))out[key]=(Number(a[key]??base[key]))+(Number(b[key]??base[key])-Number(a[key]??base[key]))*t;return out;
 }
 function region(kind,item){
  if(kind==='text')return textBounds(ctx,canvas,titleAt(item,Math.max(0,fps()-item.start)));
  if(kind==='caption')return captionLayout(ctx,canvas,state.project,item);
  const p=overlayProps(item),asset=state.assets.get(item.assetId),ratio=clamp((asset?.height||1)/(asset?.width||1),.08,8);
  return {x:p.x*canvas.width,y:p.y*canvas.height,w:canvas.width*p.scale,h:canvas.width*p.scale*ratio,rotation:p.rotation||0,size:p.scale*canvas.width};
 }
 const current=()=>{const item=itemFor(selection);if(!item||!visible(selection.kind,item)&&selection.kind!=='layer')return null;return {item,box:region(selection.kind,item)};};
 function layout(){
  const cur=current(),canvasRect=canvas.getBoundingClientRect(),parent=stage.getBoundingClientRect();
  if(!cur||canvasRect.width<3){box.hidden=true;bar.hidden=true;return;}
  const B=cur.box,sx=canvasRect.width/canvas.width,sy=canvasRect.height/canvas.height;
  box.style.left=(canvasRect.left-parent.left+B.x*sx)+'px';box.style.top=(canvasRect.top-parent.top+B.y*sy)+'px';
  box.style.width=Math.max(30,B.w*sx)+'px';box.style.height=Math.max(24,B.h*sy)+'px';
  box.style.transform=`translate(-50%,-50%) rotate(${B.rotation||0}deg)`;
  box.querySelector('.cut-direct-caption').textContent=selection.kind==='caption'?'字幕':selection.kind==='layer'?'レイヤー':'テキスト';
  box.hidden=false;bar.hidden=false;
  const widthHandle=box.querySelector('.cut-direct-width');widthHandle.hidden=selection.kind==='layer';
 }
 function pick(sel){selection=sel;if(sel?.kind==='text')state.selectedText=sel.id;
  if(sel?.kind==='layer')window.__subehaSelectLayer?.(sel.id);
  panel.hidden=true;layout();}
 function clear(){selection=null;box.hidden=true;bar.hidden=true;panel.hidden=true;guides.hidden=true;}
 function renderedLayers(){return [...(state.project.overlays||[])].filter(l=>l.visible!==false&&fps()>=l.start&&fps()<=l.start+l.duration).reverse().map(l=>({kind:'layer',item:l}));}
 function chooseAt(p){const candidates=[...(state.project.texts||[]).filter(t=>visible('text',t)).reverse().map(item=>({kind:'text',item})),
   ...(cueNow()?[{kind:'caption',item:cueNow()}]:[]),...renderedLayers()];
  const allowance=Math.min(canvas.width,canvas.height)*.012;
  for(const c of candidates)if(containsRotated(region(c.kind,c.item),p,allowance))return {kind:c.kind,id:c.item.id};
  return null;
 }
 function point(e){const r=canvas.getBoundingClientRect(),p=positionFromClient(e,r);return {x:p.x*canvas.width,y:p.y*canvas.height};}
 const contacts=new Map();
 function currentProps(){const cur=current();if(!cur)return null;const t=cur.item;return selection.kind==='layer'?{x:cur.box.x/canvas.width,y:cur.box.y/canvas.height,size:(cur.box.w/canvas.width)*100,rotation:cur.box.rotation}:selection.kind==='caption'?{x:cur.box.x/canvas.width,y:cur.box.y/canvas.height,size:cur.box.size*720/canvas.width,rotation:cur.box.rotation}:(p=>({x:p.x??.5,y:p.y??.76,size:p.size??62,rotation:p.rotation||0}))(titleAt(t,Math.max(0,fps()-t.start)));}
 function applyTextChanges(t,patch){
  if($('cut-keyframe-mode')?.checked||(t.titleKeyframes?.length&&Object.keys(patch).some(key=>TITLE_KEYFRAME_FIELDS.includes(key)))){
   const timed={},global={};
   for(const [k,v] of Object.entries(patch))if(TITLE_KEYFRAME_FIELDS.includes(k))timed[k]=v;else global[k]=v;
   Object.assign(t,global);
   if(Object.keys(timed).length)t.titleKeyframes=upsertTitleKeyframe(t,Math.max(0,Math.min(t.duration||3,fps()-t.start)),timed);
  }else Object.assign(t,patch);
 }
 function applyPatch(patch){const t=itemFor(selection);if(!t||state.recording)return;
  if(selection.kind==='caption'){t.style={...captionAppearance(state.project,t),...t.style,...patch};}
  else if(selection.kind==='layer'){const transfer={...patch};if(transfer.size!==undefined){transfer.scale=transfer.size/100;delete transfer.size;}Object.assign(t,applyOverlayTransform(t,fps(),transfer));}
  else if(selection.kind==='text')applyTextChanges(t,patch);
  else Object.assign(t,patch);
  dirty=true;draw();layout();
 }
 function begin(e,mode='move'){
  const p=point(e);contacts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
  const props=currentProps();if(!props)return;
  const item=itemFor(selection);if(item&&selection.kind!=='layer')props.width=(selection.kind==='caption'?captionAppearance(state.project,item):item).width??.88;
  if(contacts.size===1){
   gest={mode,from:p,fromScreen:{x:e.clientX,y:e.clientY},props,changed:false};
   if(mode==='rotate'){
    const r=canvas.getBoundingClientRect(),c={x:r.left+r.width*props.x,y:r.top+r.height*props.y};
    gest.lastAngle=Math.atan2(e.clientY-c.y,e.clientX-c.x);gest.travel=0;
   }
  }
  else if(contacts.size===2){const [a,b]=[...contacts.values()];const angle=pointerAngle(a,b);gest={mode:'pinch',props,distance:pointerGap(a,b)||1,lastAngle:angle,travel:0,changed:false};}
 }
 function motion(e){if(!contacts.has(e.pointerId)||!gest)return;
  contacts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});const g=gest;
  if(contacts.size===2){const [a,b]=[...contacts.values()];const size=scaleBy(g.props.size,g.distance,pointerGap(a,b),selection.kind==='layer'?8:12,selection.kind==='layer'?350:240);
   const rotation=stepRotation(g,pointerAngle(a,b));applyPatch({size,rotation});
  }else if(g.mode==='move'){
   if(contacts.size===1&&Math.hypot(e.clientX-g.fromScreen.x,e.clientY-g.fromScreen.y)>12){
     if(!window.__subehaTrash?.active())window.__subehaTrash?.begin(selection.kind,selection.id,e);
     else window.__subehaTrash?.move(e);
   }
   const patch=moveBy(g.props,{x:g.from.x/canvas.width,y:g.from.y/canvas.height},{x:point(e).x/canvas.width,y:point(e).y/canvas.height});
   const nearest=nearbyGuides(patch.x,patch.y);for(const axis of ['x','y'])if(nearest[axis])patch[axis]=.5;
   guides.hidden=!(nearest.x||nearest.y);guides.querySelector('.cut-guide-v').hidden=!nearest.x;guides.querySelector('.cut-guide-h').hidden=!nearest.y;
   applyPatch(patch);
  }else if(g.mode==='width'){
   const t=itemFor(selection);if(!t||selection.kind==='layer')return;
   const props=selection.kind==='caption'?captionAppearance(state.project,t):t;
   applyPatch({width:widthFromDrag(g.props.width??props.width??.88,e.clientX-g.fromScreen.x,e.clientY-g.fromScreen.y,g.props.rotation,canvas.getBoundingClientRect().width)});
  }else if(g.mode==='resize'){
   const delta=Math.hypot(e.clientX-g.fromScreen.x,e.clientY-g.fromScreen.y);
   const sign=(e.clientX-g.fromScreen.x)+(e.clientY-g.fromScreen.y)>=0?1:-1;
   applyPatch({size:clamp(g.props.size+sign*delta*(720/Math.max(canvas.getBoundingClientRect().width,1)),selection.kind==='layer'?8:12,selection.kind==='layer'?350:240)});
  }else if(g.mode==='rotate'){
   const r=canvas.getBoundingClientRect(),c={clientX:r.left+r.width*g.props.x,clientY:r.top+r.height*g.props.y};
   const end=Math.atan2(e.clientY-c.clientY,e.clientX-c.clientX);
   applyPatch({rotation:stepRotation(g,end)});
  }
  g.changed=true;
 }
 function end(e,canceled=false){
  const discarded=!canceled&&contacts.size===1&&gest?.mode==='move'&&window.__subehaTrash?.finish(e);
  window.__subehaTrash?.cancel();
  if(discarded){contacts.clear();gest=null;dirty=false;clear();return;}
  contacts.delete(e.pointerId);if(contacts.size===1){const other=[...contacts.values()][0];gest={mode:'move',from:point(other),fromScreen:{x:other.clientX,y:other.clientY},props:currentProps(),changed:false};}
  if(!contacts.size){gest=null;guides.hidden=true;if(dirty){dirty=false;save();refreshAll();layout();}}}
 canvas.addEventListener('pointerdown',e=>{
  if(state.recording||window.__subehaDirectSuspend?.()===true)return;
  const newPick=contacts.size?selection:chooseAt(point(e));if(!newPick){if(!contacts.size)clear();return;}
  e.preventDefault();e.stopImmediatePropagation();
  const now=performance.now();const doubleTap=lastTap&&lastTap.id===newPick.id&&lastTap.kind===newPick.kind&&now-lastTap.at<360&&Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y)<25;
  lastTap={...newPick,at:now,x:e.clientX,y:e.clientY};pick(newPick);if(doubleTap&&newPick.kind!=='layer'){openPanel('words');setTimeout(()=>$('cut-direct-input')?.focus(),0);}
  canvas.setPointerCapture(e.pointerId);begin(e);
 },true);
 canvas.addEventListener('pointermove',e=>{if(!contacts.has(e.pointerId))return;e.preventDefault();e.stopImmediatePropagation();motion(e);},true);
 for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{if(!contacts.has(e.pointerId))return;e.preventDefault();e.stopImmediatePropagation();end(e,type==='pointercancel');},true);
 for(const [cls,mode] of [['.cut-direct-resize','resize'],['.cut-direct-rotate','rotate'],['.cut-direct-width','width']]){
  const h=box.querySelector(cls);h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();h.setPointerCapture(e.pointerId);begin(e,mode);});
  h.addEventListener('pointermove',e=>{if(!contacts.has(e.pointerId))return;e.preventDefault();motion(e);});
  for(const type of ['pointerup','pointercancel'])h.addEventListener(type,e=>{if(contacts.has(e.pointerId))end(e,type==='pointercancel');});
 }
 const tabButtons=[...panel.querySelectorAll('#cut-title-tabs [data-tab]')];
 function showTab(tab){activeTab=tab;for(const b of tabButtons){b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab));}
  for(const p of panel.querySelectorAll('.cut-title-pane'))p.hidden=p.id!=='cut-title-'+tab;
  if(tab==='pbr')$('cut-pbr-gpu-status').textContent=canUsePbrTitle()?'WebGLによるGPU描画が利用可能':'WebGL非対応：通常の2D文字で表示します';
 }
 function effectiveStyle(){const t=itemFor(selection);return !t?{}:selection.kind==='caption'?captionAppearance(state.project,t):
  selection.kind==='text'&&$('cut-keyframe-mode')?.checked?titleAt(t,Math.max(0,fps()-t.start)):t;}
 function updateText(change){const t=itemFor(selection);if(!t||state.recording)return;
  if(selection.kind==='caption'){if('text' in change)t.text=change.text;const copy={...change};delete copy.text;t.style={...t.style,...copy};}
  else if(selection.kind==='text')applyTextChanges(t,change);else Object.assign(t,change);save();draw();layout();
 }
 function buildSlider(key,label,min,max,step,defaultValue){const st=effectiveStyle();const el=document.createElement('label');el.className='cut-title-slider';
  el.innerHTML=`<span>${label}<output>${Number(st[key]??defaultValue).toFixed(step<.1?2:step<1?1:0)}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${st[key]??defaultValue}" data-title-range="${key}">`;
  const input=el.querySelector('input');input.addEventListener('input',()=>{el.querySelector('output').textContent=Number(input.value).toFixed(step<.1?2:step<1?1:0);updateText({[key]:Number(input.value)});});return el;
 }
 function refreshSheet(){const st=effectiveStyle();
  for(const el of panel.querySelectorAll('[data-appearance]'))el.value=st[el.dataset.appearance]||'#000000';
  const area=$('cut-title-appearance-sliders');area.replaceChildren(
   buildSlider('outlineWidth','縁取りの太さ',0,.38,.01,.08),buildSlider('shadowBlur','影のぼかし',0,70,1,14),
   buildSlider('shadowX','影を左右に',-40,40,1,0),buildSlider('shadowY','影を上下に',-40,40,1,0),
   buildSlider('boxOpacity','背景の濃さ',0,1,.05,.72),buildSlider('opacity','文字の透明度',0,1,.05,1));
  $('cut-title-layout-sliders').replaceChildren(
   buildSlider('width','改行する幅',.18,.98,.01,.88),buildSlider('letterSpacing','文字の間隔',-9,28,.5,0),
   buildSlider('lineHeight','行の間隔',.75,2.2,.05,selection.kind==='caption'?1.34:1.23),
   buildSlider('rotation','角度（0°が水平）',-180,180,1,0));
  $('cut-title-font-weight')?.replaceChildren(buildSlider('weight','文字の太さ',400,900,100,800));
  for(const b of panel.querySelectorAll('[data-align]'))b.classList.toggle('active',b.dataset.align===(st.align||'center'));
  for(const b of panel.querySelectorAll('[data-motion]'))b.classList.toggle('active',b.dataset.motion===(st.motion||'none')&&(!st.textMotion||st.textMotion.type==='none'));
  const isText=selection?.kind==='text',item=itemFor(selection);
  advanced.hidden=!isText;pbrTab.hidden=!isText;
  if(isText&&item){
   const pbr=normalizedPbrTitle(st);
   $('cut-pbr-enable').checked=pbr.enabled;
   for(const b of presetBox.querySelectorAll('button'))b.classList.toggle('active',b.dataset.pbrPreset===pbr.style);
   const rawPbr={...PBR_TITLE_PRESETS[pbr.style]};
   const pbrFields={
    pbrMetallic:pbr.metallic,pbrRoughness:pbr.roughness,pbrBumpiness:pbr.bumpiness,
    pbrEnvironment:pbr.environment,pbrDepth:pbr.depth,pbrBevel:pbr.bevel,pbrSpin:pbr.spin,
    pbrLight1Angle:pbr.light1.angle,pbrLight1Elevation:pbr.light1.elevation,pbrLight1Intensity:pbr.light1.intensity,
    pbrLight2Angle:pbr.light2.angle,pbrLight2Elevation:pbr.light2.elevation,pbrLight2Intensity:pbr.light2.intensity,
    pbrColor:pbr.color,pbrLight1Color:pbr.light1.color,pbrLight2Color:pbr.light2.color
   };
   for(const input of pbrPane.querySelectorAll('[data-pbr-prop]')){
    input.value=pbrFields[input.dataset.pbrProp];
    const output=pbrPane.querySelector('[data-pbr-output="'+input.dataset.pbrProp+'"]');
    if(output)output.textContent=Number(input.value).toFixed(input.step&&Number(input.step)<1?2:0);
   }
   renderPbrLightPad(pbr);

   const motion=normalizedTextMotion(item.textMotion);
   for(const [k,v] of Object.entries(motion)){const control=panel.querySelector('[data-tmotion="'+k+'"]');if(!control)continue;if(control.type==='checkbox')control.checked=!!v;else control.value=String(v);}
   $('cut-motion-duration-label').textContent=motion.duration.toFixed(2)+'秒';
   $('cut-motion-stagger-label').textContent=motion.stagger.toFixed(2)+'秒';
   $('cut-keyframe-easing').value=TEXT_MOTION_EASINGS.includes(item.titleEasing)?item.titleEasing:'linear';
   const frames=item.titleKeyframes||[];
   $('cut-keyframe-count').textContent=frames.length+'個のキーフレーム '+(frames.length?'／ '+frames.map(f=>Number(f.time).toFixed(2)+'秒').join('、'):'');
  }
 }
 function openPanel(tab='words'){const cur=current();if(!cur)return;
  panel.hidden=false;const t=cur.item;
  $('cut-direct-title').textContent=selection.kind==='caption'?'字幕を編集':selection.kind==='layer'?'重ねた素材を編集':'文字を編集';
  $('cut-direct-input').value=t.text||'';
  const st=effectiveStyle();$('cut-direct-color').value=st.color||'#ffffff';
  $('cut-direct-bg').hidden=selection.kind==='layer';
  showTab(selection.kind==='layer'?'words':tab);refreshSheet();
 }
 tabButtons.forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
 const fonts=$('cut-title-font-list');fonts.innerHTML='<p>字体を選ぶ</p>';
 for(const [key,font] of Object.entries(TEXT_FONTS)){const b=document.createElement('button');b.textContent=({'sans':'標準','serif':'明朝','mono':'等幅','round':'丸文字','brush':'手書き'}[key]||key);b.style.fontFamily=font;b.onclick=()=>{updateText({fontFamily:key});refreshSheet();};fonts.append(b);}
 const weightBox=document.createElement('div');weightBox.id='cut-title-font-weight';fonts.after(weightBox);
 const presets=$('cut-title-presets');presets.innerHTML='<p>文字のデザイン</p>';
 for(const [key,preset] of Object.entries(TEXT_PRESETS)){const b=document.createElement('button');b.textContent=({'cinematic':'映画風','neon':'ネオン','news':'ニュース','minimal':'シンプル','vintage':'レトロ'}[key]||preset.name);b.onclick=()=>{const t=itemFor(selection);if(!t)return;const change=applyTextPreset(t,key);updateText({fontFamily:change.fontFamily,weight:change.weight,color:change.color,outlineColor:change.outlineColor,outlineWidth:change.outlineWidth,box:change.box,motion:change.motion});refreshSheet();};presets.append(b);}
 $('cut-direct-input').addEventListener('input',e=>updateText({text:e.target.value}));
 $('cut-direct-color').addEventListener('input',e=>updateText({color:e.target.value}));
 for(const el of panel.querySelectorAll('[data-appearance]'))el.oninput=()=>updateText({[el.dataset.appearance]:el.value});
 for(const sw of panel.querySelectorAll('[data-color]'))sw.onclick=()=>{updateText({color:sw.dataset.color});$('cut-direct-color').value=sw.dataset.color;};
 $('cut-direct-bg').onclick=()=>{const st=effectiveStyle();updateText(selection.kind==='caption'?{background:st.background===false}:{box:!st.box});};
 for(const b of panel.querySelectorAll('[data-align]'))b.onclick=()=>{updateText({align:b.dataset.align});refreshSheet();};
 for(const b of panel.querySelectorAll('[data-motion]'))b.onclick=()=>{updateText({motion:b.dataset.motion,textMotion:null});refreshSheet();};
 for(const control of advanced.querySelectorAll('[data-tmotion]'))control.addEventListener('input',()=>{
  const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;
  const field=control.dataset.tmotion,value=control.type==='checkbox'?control.checked:control.type==='range'?Number(control.value):control.value;
  t.textMotion={...normalizedTextMotion(t.textMotion),[field]:value};
  t.motion='none';save();draw();refreshSheet();
 });
 $('cut-keyframe-add').onclick=()=>{
  const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;
  t.titleKeyframes=upsertTitleKeyframe(t,Math.max(0,Math.min(t.duration||3,fps()-t.start)));
  $('cut-keyframe-mode').checked=true;save();draw();refreshSheet();layout();
 };
 $('cut-keyframe-clear').onclick=()=>{
  const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;
  t.titleKeyframes=[];$('cut-keyframe-mode').checked=false;save();draw();refreshSheet();layout();
 };
 $('cut-keyframe-mode').onchange=()=>refreshSheet();
 $('cut-keyframe-easing').onchange=e=>{const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;t.titleEasing=e.target.value;save();draw();};
 $('cut-motion-preview').onclick=()=>{
  const t=itemFor(selection);if(!t||selection.kind!=='text')return;
  api.seek(t.start);if(!state.playing)$('play').click();
 };
 $('cut-pbr-enable').onchange=e=>{updateText({pbrEnabled:e.target.checked});refreshSheet();};
 for(const b of presetBox.querySelectorAll('[data-pbr-preset]'))b.onclick=()=>{
  const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;
  const result=applyPbrPreset({},b.dataset.pbrPreset);
  updateText(result);refreshSheet();
 };
 for(const input of pbrPane.querySelectorAll('[data-pbr-prop]'))input.oninput=()=>{
  const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;
  const value=input.type==='color'?input.value:Number(input.value);
  updateText({[input.dataset.pbrProp]:value});
  const out=pbrPane.querySelector('[data-pbr-output="'+input.dataset.pbrProp+'"]');
  if(out)out.textContent=Number(value).toFixed(input.step&&Number(input.step)<1?2:0);
  if(input.dataset.pbrProp.includes('Light')&&input.dataset.pbrProp!=='pbrLight1Color'&&input.dataset.pbrProp!=='pbrLight2Color')renderPbrLightPad(normalizedPbrTitle(effectiveStyle()));
 };
 const lightpad=$('cut-pbr-lightpad');
 let movingLight=null;
 function renderPbrLightPad(pbr){
  for(const number of [1,2]){
   const b=lightpad.querySelector('[data-pbr-light="'+number+'"]');const light=pbr['light'+number];
   const rad=light.angle*Math.PI/180,dist=(1-light.elevation)*.41;
   b.style.left=(50+Math.cos(rad)*dist*100)+'%';
   b.style.top=(50-Math.sin(rad)*dist*100)+'%';
  }
 }
 function pbrLightPointer(e){
  if(movingLight===null)return;
  const t=itemFor(selection);if(!t||selection.kind!=='text'||state.recording)return;
  const r=lightpad.getBoundingClientRect(),dx=(e.clientX-(r.left+r.width/2))/(r.width*.5),dy=((r.top+r.height/2)-e.clientY)/(r.height*.5);
  const angle=(Math.atan2(dy,dx)*180/Math.PI+360)%360,elevation=Math.max(.05,Math.min(1,1-Math.hypot(dx,dy)));
  applyTextChanges(t,{['pbrLight'+movingLight+'Angle']:Math.round(angle),['pbrLight'+movingLight+'Elevation']:Math.round(elevation*100)/100});
  draw();renderPbrLightPad(normalizedPbrTitle(effectiveStyle()));
 }
 lightpad.addEventListener('pointerdown',e=>{
  if(selection?.kind!=='text'||state.recording)return;
  movingLight=Number(e.target.closest('[data-pbr-light]')?.dataset.pbrLight||1);
  lightpad.setPointerCapture(e.pointerId);e.preventDefault();pbrLightPointer(e);
 });
 lightpad.addEventListener('pointermove',e=>{if(movingLight===null)return;e.preventDefault();pbrLightPointer(e);});
 const endPbrPointer=()=>{if(movingLight===null)return;movingLight=null;save();refreshSheet();};
 lightpad.addEventListener('pointerup',endPbrPointer);lightpad.addEventListener('pointercancel',endPbrPointer);
 $('cut-title-center').onclick=()=>{updateText({x:.5,y:.5});refreshSheet();};
 $('cut-direct-close').onclick=()=>{panel.hidden=true;};
 bar.addEventListener('click',e=>{const action=e.target.closest('[data-do]')?.dataset.do,t=itemFor(selection);if(!action||!t)return;
  if(action==='close'){clear();return;}
  if(action==='straighten'){
   if(state.recording)return;
   // Never rely on the base rotation when an existing keyframe overrides it.
   // The current frame must become horizontal immediately, even in old projects.
   if(selection.kind==='text'&&t.titleKeyframes?.length){
    const local=Math.max(0,Math.min(t.duration||3,fps()-t.start));
    t.titleKeyframes=upsertTitleKeyframe(t,local,{rotation:0});
    dirty=false;draw();layout();
   }else applyPatch({rotation:0});
   dirty=false;save();refreshAll();layout();
   api.toast('水平（0°）に戻しました');return;
  }
  if(['edit','color','style'].includes(action)){openPanel(action==='edit'?'words':action==='color'?'appearance':'font');return;}
  if(action==='duplicate'){
   if(selection.kind==='layer'){const copy={...structuredClone(t),id:api.newID(),x:clamp((t.x??.5)+.06,0,1)};state.project.overlays.push(copy);pick({kind:'layer',id:copy.id});}
   else if(selection.kind==='caption'){const copy={...structuredClone(t),id:api.newID(),start:t.end,end:t.end+(t.end-t.start)};state.project.captions.push(copy);state.project.captions.sort((a,b)=>a.start-b.start);api.seek(copy.start);pick({kind:'caption',id:copy.id});}
   else{const copy={...structuredClone(t),id:api.newID(),x:clamp((t.x??.5)+.06,0,1)};state.project.texts.push(copy);pick({kind:'text',id:copy.id});}
   save();refreshAll();return;
  }
  if(action==='delete'){
   const key=selection.kind==='caption'?'captions':selection.kind==='layer'?'overlays':'texts';state.project[key]=state.project[key].filter(x=>x.id!==t.id);if(selection.kind==='text')state.selectedText=null;save();refreshAll();clear();
  }
 });
 window.__subehaDirectSelect=(kind,id)=>{
  const valid=['text','layer','caption'].includes(kind)?itemFor({kind,id}):null;
  if(!valid)return false;pick({kind,id});return true;
 };
 window.__subehaDirectOpen=(kind='auto',tab='words')=>{if(kind==='caption'){const cue=cueNow();if(cue)pick({kind:'caption',id:cue.id});else{api.toast('まず再生位置に字幕を表示してください');return;} }
  else if(kind==='text'){const t=(state.project.texts||[]).find(t=>t.id===state.selectedText);if(t)pick({kind:'text',id:t.id});else{api.toast('まずテキストを追加してください');return;}}
  openPanel(tab);};
 function frame(ts){if(ts-lastRender>80){lastRender=ts;
  // Track newly added text and project load without opening a numeric control panel.
  if(state.selectedText!==lastTextId){lastTextId=state.selectedText;if(lastTextId){const t=(state.project.texts||[]).find(x=>x.id===lastTextId);if(t&&visible('text',t)&&(!selection||selection.kind==='text'))selection={kind:'text',id:t.id};}}
  layout();}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
if(window.__subehaCut){if(document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',()=>requestAnimationFrame(mount),{once:true});}
