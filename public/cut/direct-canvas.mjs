/* Touch-first overlay manipulation. DOM handles are editor-only; never appear in export frames. */
import {activeCue,captionLayout,captionAppearance} from './subtitles.mjs';
import {clamp,containsRotated,textBounds,moveBy,scaleBy,rotateBy,positionFromClient,pointerGap,pointerAngle} from './direct-geometry.mjs';
import {applyOverlayTransform} from './touch-edit.mjs';
import {widthFromDrag,nearbyGuides} from './title-gestures.mjs';
import {TEXT_FONTS,TEXT_PRESETS,applyTextPreset} from './text-styles.mjs';
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
 bar.innerHTML='<button data-do="edit">✎ 文字</button><button data-do="style">▧ デザイン</button><button data-do="color">● 色</button><button data-do="duplicate">▣ 複製</button><button data-do="delete">× 削除</button><button data-do="close">完了</button>';
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
  if(kind==='text')return textBounds(ctx,canvas,item);
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
 function renderedLayers(){return [...(state.project.overlays||[])].filter(l=>fps()>=l.start&&fps()<=l.start+l.duration).reverse().map(l=>({kind:'layer',item:l}));}
 function chooseAt(p){const candidates=[...(state.project.texts||[]).filter(t=>visible('text',t)).reverse().map(item=>({kind:'text',item})),
   ...(cueNow()?[{kind:'caption',item:cueNow()}]:[]),...renderedLayers()];
  const allowance=Math.min(canvas.width,canvas.height)*.012;
  for(const c of candidates)if(containsRotated(region(c.kind,c.item),p,allowance))return {kind:c.kind,id:c.item.id};
  return null;
 }
 function point(e){const r=canvas.getBoundingClientRect(),p=positionFromClient(e,r);return {x:p.x*canvas.width,y:p.y*canvas.height};}
 const contacts=new Map();
 function currentProps(){const cur=current();if(!cur)return null;const t=cur.item;return selection.kind==='layer'?{x:cur.box.x/canvas.width,y:cur.box.y/canvas.height,size:(cur.box.w/canvas.width)*100,rotation:cur.box.rotation}:selection.kind==='caption'?{x:cur.box.x/canvas.width,y:cur.box.y/canvas.height,size:cur.box.size*720/canvas.width,rotation:cur.box.rotation}:{x:t.x??.5,y:t.y??.76,size:t.size??62,rotation:t.rotation||0};}
 function applyPatch(patch){const t=itemFor(selection);if(!t||state.recording)return;
  if(selection.kind==='caption'){t.style={...captionAppearance(state.project,t),...t.style,...patch};}
  else if(selection.kind==='layer'){const transfer={...patch};if(transfer.size!==undefined){transfer.scale=transfer.size/100;delete transfer.size;}Object.assign(t,applyOverlayTransform(t,fps(),transfer));}
  else Object.assign(t,patch);
  dirty=true;draw();layout();
 }
 function begin(e,mode='move'){
  const p=point(e);contacts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});
  const props=currentProps();if(!props)return;
  const item=itemFor(selection);if(item&&selection.kind!=='layer')props.width=(selection.kind==='caption'?captionAppearance(state.project,item):item).width??.88;
  if(contacts.size===1)gest={mode,from:p,fromScreen:{x:e.clientX,y:e.clientY},props,changed:false};
  else if(contacts.size===2){const [a,b]=[...contacts.values()];gest={mode:'pinch',props,distance:pointerGap(a,b)||1,angle:pointerAngle(a,b),changed:false};}
 }
 function motion(e){if(!contacts.has(e.pointerId)||!gest)return;
  contacts.set(e.pointerId,{clientX:e.clientX,clientY:e.clientY});const g=gest;
  if(contacts.size===2){const [a,b]=[...contacts.values()];const size=scaleBy(g.props.size,g.distance,pointerGap(a,b),selection.kind==='layer'?8:12,selection.kind==='layer'?350:240);
   const rotation=rotateBy(g.props.rotation,g.angle,pointerAngle(a,b));applyPatch({size,rotation});
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
   const start=Math.atan2(g.fromScreen.y-c.clientY,g.fromScreen.x-c.clientX),end=Math.atan2(e.clientY-c.clientY,e.clientX-c.clientX);
   applyPatch({rotation:rotateBy(g.props.rotation,start,end)});
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
 }
 function effectiveStyle(){const t=itemFor(selection);return !t?{}:selection.kind==='caption'?captionAppearance(state.project,t):t;}
 function updateText(change){const t=itemFor(selection);if(!t||state.recording)return;
  if(selection.kind==='caption'){if('text' in change)t.text=change.text;const copy={...change};delete copy.text;t.style={...t.style,...copy};}
  else Object.assign(t,change);save();draw();layout();
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
   buildSlider('lineHeight','行の間隔',.75,2.2,.05,selection.kind==='caption'?1.34:1.23));
  $('cut-title-font-weight')?.replaceChildren(buildSlider('weight','文字の太さ',400,900,100,800));
  for(const b of panel.querySelectorAll('[data-align]'))b.classList.toggle('active',b.dataset.align===(st.align||'center'));
  for(const b of panel.querySelectorAll('[data-motion]'))b.classList.toggle('active',b.dataset.motion===(st.motion||'none'));
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
 for(const b of panel.querySelectorAll('[data-motion]'))b.onclick=()=>{updateText({motion:b.dataset.motion});refreshSheet();};
 $('cut-title-center').onclick=()=>{updateText({x:.5,y:.5});refreshSheet();};
 $('cut-direct-close').onclick=()=>{panel.hidden=true;};
 bar.addEventListener('click',e=>{const action=e.target.closest('[data-do]')?.dataset.do,t=itemFor(selection);if(!action||!t)return;
  if(action==='close'){clear();return;}
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
 window.__subehaDirectOpen=(kind='auto')=>{if(kind==='caption'){const cue=cueNow();if(cue)pick({kind:'caption',id:cue.id});else{api.toast('まず再生位置に字幕を表示してください');return;} }
  else if(kind==='text'){const t=(state.project.texts||[]).find(t=>t.id===state.selectedText);if(t)pick({kind:'text',id:t.id});else{api.toast('まずテキストを追加してください');return;}}
  openPanel('words');};
 function frame(ts){if(ts-lastRender>80){lastRender=ts;
  // Track newly added text and project load without opening a numeric control panel.
  if(state.selectedText!==lastTextId){lastTextId=state.selectedText;if(lastTextId){const t=(state.project.texts||[]).find(x=>x.id===lastTextId);if(t&&visible('text',t)&&(!selection||selection.kind!=='caption'))selection={kind:'text',id:t.id};}}
  layout();}
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
if(window.__subehaCut){if(document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',()=>requestAnimationFrame(mount),{once:true});}
