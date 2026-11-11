/* SUBEHA CUT v0.9: touch-first editing layer, independent of proprietary editor UI. */
import {spans,totalDuration} from './transitions.mjs';
import {createFilmstripCache} from './filmstrip-cache.mjs';
import {clamp,timelineScroll,timelineTime,rulerStep,clipTrim,moveClip,applyOverlayTransform} from './touch-edit.mjs';

const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
const clock=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
const number=(n)=>Number.isFinite(Number(n))?Number(n):0;
export const tickLabel=(t)=>Math.abs(t-Math.floor(t)-.5)<.001?'15f':clock(t);

export function mountTouchWorkspace({api,getZoom,setZoom,getLayer,getLayerProps,onSelectLayer,onSelectAudio,onSelectCaption,onOpenOverlay,getEditMode}){
 const {state,seek,save,draw,refreshAll}=api;
 const filmstrips=createFilmstripCache();
 const $=id=>document.getElementById(id);
 const host=document.querySelector('.timeline-shell');
 const controls=el('section','cut-touch-workspace');controls.id='cut-touch-workspace';
 controls.innerHTML=`
 <div class="cut-quick-actions"><span class="cut-selection" id="cut-selection">クリップを選択</span><div class="cut-actions" id="cut-actions"></div></div>
 <div class="cut-timeline-frame"><div class="cut-center-playhead" aria-hidden="true"><i></i></div>
   <div id="cut-timeline-scroll" class="cut-timeline-scroll" tabindex="0" aria-label="横スクロールで再生位置を動かすタイムライン">
    <div class="cut-timeline-content" id="cut-timeline-content">
     <div class="cut-time-ruler" id="cut-time-ruler"></div>
     <div class="cut-lane-title">動画・写真</div><div class="cut-lane cut-video-lane" id="cut-video-lane"></div>
     <div class="cut-lane-title">重ねた素材</div><div class="cut-lane cut-overlay-lane" id="cut-overlay-lane"></div>
     <div class="cut-lane-title">音声</div><div class="cut-lane cut-audio-lane" id="cut-audio-lane"></div>
     <div class="cut-lane-title">文字・字幕</div><div class="cut-lane cut-caption-lane" id="cut-caption-lane"></div>
    </div>
   </div>
 </div>
 <div class="cut-workspace-foot"><span>左右に動かして再生位置を移動 · 2本指で拡大 · 長押ししてゴミ箱へ</span><div class="cut-scale-actions"><button type="button" id="cut-zoom-out" aria-label="タイムライン縮小">−</button><button type="button" id="cut-zoom-in" aria-label="タイムライン拡大">＋</button></div></div>`;
 host.querySelector('.section-label').after(controls);
 host.classList.add('cut-touch-enabled');
 const scroller=$('cut-timeline-scroll'),content=$('cut-timeline-content'),actions=$('cut-actions');
 const stage=$('preview-stage'),canvas=api.canvas;
 const box=el('div','cut-transform-frame');box.id='cut-transform-frame';box.hidden=true;
 box.innerHTML='<i class="cut-handle cut-handle-tl"></i><i class="cut-handle cut-handle-br"></i>';
 stage.append(box);
 const centerGuide=el('div','cut-center-guide');centerGuide.hidden=true;stage.append(centerGuide);
 let blockScroll=false,pinching=false,dragging=false,longTimer=null,rendering=false,renderFrame=0,dragData=null,gestureOrigin=null;
 let lastSelected='',lastSummary='',pendingHoldStart=null,suppressTapUntil=0;
 const projectDuration=()=>totalDuration(state.project.clips);
 const pps=()=>getZoom();
 function setTimelineScale(value){
   const t=timelineTime(scroller.scrollLeft,pps(),projectDuration());
   setZoom(clamp(value,12,160));
   requestAnimationFrame(()=>{blockScroll=true;scroller.scrollLeft=timelineScroll(t,pps());blockScroll=false;});
 }
 $('cut-zoom-out').onclick=()=>setTimelineScale(pps()/1.45);
 $('cut-zoom-in').onclick=()=>setTimelineScale(pps()*1.45);
 const isEditable=target=>!!target?.closest('input,textarea,select,[contenteditable="true"]');
 const action=(label,handler,major=false)=>{const b=el('button',major?'cut-action-primary':'',label);b.type='button';b.onclick=handler;actions.append(b);};
 function selectClip(id,{jump=false}={}){
   if(!state.project.clips.some(c=>c.id===id))return;
   state.selectedClip=id;
   api.setPanel('clips');
   refreshAll();
   if(jump){const sp=spans(state.project.clips).find(row=>row.clip.id===id);seek(sp?.start||0);}
   renderQuick();
 }
 function renderQuick(){
   const current=state.project.clips.find(c=>c.id===state.selectedClip);
   const msg=current?`${current.name.slice(0,24)} · ${((current.end-current.start)/(current.speed||1)).toFixed(1)}秒${current.muted?' · 消音':''}`:'素材を追加して編集開始';
   if(lastSummary===msg && lastSelected===state.selectedClip)return;
   lastSummary=msg;lastSelected=state.selectedClip;
   $('cut-selection').textContent=msg;actions.replaceChildren();
   if(!current){action('＋ 素材',()=>$('file-picker').click(),true);action('♫ 音声',()=>$('pro-audio-picker')?.click());return;}
   action('✂ 分割',()=>$('split-clip')?.click(),true);
   action('▧ 複製',()=>$('dup-clip')?.click());
   action('▧ 重ねる',onOpenOverlay);
   action(current.muted?'♫ 音を戻す':'♫ ミュート',()=>api.updateClip(c=>c.muted=!c.muted));
   action('🗑 削除',()=>$('delete-clip')?.click());
 }
 const addPill=(container,{left,width,cls,text,title,onclick})=>{
   const item=el('button','cut-timeline-pill '+cls,text);item.type='button';item.style.left=left+'px';item.style.width=Math.max(4,width)+'px';item.title=title||text;item.onclick=onclick;container.append(item);return item;
 };
 function render(){
   if(dragging || rendering)return;rendering=true;
   try{
     const width=scroller.clientWidth||window.innerWidth||360,pad=width/2;
     const d=projectDuration(),scale=pps();content.style.width=Math.max(width,Math.ceil(2*pad+d*scale))+'px';
     content.style.setProperty('--cut-pad',pad+'px');
     const ruler=$('cut-time-ruler');ruler.replaceChildren();
     const step=rulerStep(scale);for(let t=0;t<=d+.001;t+=step){const tick=el('span','cut-tick',tickLabel(t));tick.style.left=(pad+t*scale)+'px';ruler.append(tick);}
     const v=$('cut-video-lane');v.replaceChildren();
     for(const row of spans(state.project.clips)){
       const c=row.clip,a=state.assets.get(c.assetId);
       const x=pad+row.start*scale,w=row.length*scale;
       const card=addPill(v,{left:x,width:w,cls:'cut-video-card'+(state.selectedClip===c.id?' selected':''),text:'',title:c.name,onclick:()=>selectClip(c.id)});
       card.dataset.clipId=c.id;
       if(a?.thumb){card.style.backgroundImage=`linear-gradient(0deg,#090a12ba,#0001 80%), url(${JSON.stringify(a.thumb)})`;card.style.backgroundSize='cover';card.style.backgroundPosition='center';}
       if(a?.type==='video' && w>=35){
         const strip=el('div','cut-filmstrip');card.prepend(strip);
         filmstrips.request(a,c,w,frames=>{
           if(!card.isConnected)return;
           strip.replaceChildren();
           for(const source of frames){const tile=el('span','cut-filmstrip-tile');tile.style.backgroundImage='url('+JSON.stringify(source)+')';strip.append(tile);}
         });
       }
       const label=el('span','cut-video-label',c.name);card.append(label);
       const length=el('span','cut-video-time',row.length.toFixed(1)+'s');card.append(length);
       if(state.selectedClip===c.id){
         for(const edge of ['left','right']){
           const h=el('span','cut-trim-handle '+edge);h.role='slider';h.setAttribute('aria-label',edge==='left'?'クリップ開始位置':'クリップ終了位置');h.dataset.trimEdge=edge;
           card.append(h);
         }
       }
       if(row.index>0 && row.transition.duration>0){const mark=el('span','cut-transition-mark','⋈');mark.style.left=(x-10)+'px';v.append(mark);}
     }
     const overlay=$('cut-overlay-lane');overlay.replaceChildren();
     for(const l of state.project.overlays||[]){const x=pad+number(l.start)*scale,w=number(l.duration)*scale;
       addPill(overlay,{left:x,width:w,cls:'cut-overlay-pill',text:'▧ '+(state.assets.get(l.assetId)?.name||'レイヤー').slice(0,18),title:'前面レイヤーを編集',onclick:()=>onSelectLayer(l.id)}).dataset.layerId=l.id;
     }
     for(const scene of state.project.cgScenes||[]){
       const x=pad+number(scene.start)*scale,w=number(scene.duration)*scale;
       addPill(overlay,{left:x,width:w,cls:'cut-cg-pill',text:'◇ '+(scene.name||'3D CG').slice(0,16),title:'3D CGシーンを編集',onclick:()=>{seek(scene.start);window.__subehaCGSelect?.(scene.id);}}).dataset.cgId=scene.id;
     }
     const audio=$('cut-audio-lane');audio.replaceChildren();
     for(const a of state.project.audioTracks||[]){const x=pad+number(a.start)*scale,w=number(a.duration)*scale;
       addPill(audio,{left:x,width:w,cls:'cut-audio-pill',text:'♫ '+(state.assets.get(a.assetId)?.name||'音声').slice(0,17),title:'音声トラックを編集・移動',onclick:()=>onSelectAudio(a.id)}).dataset.audioId=a.id;
     }
     const sub=$('cut-caption-lane');sub.replaceChildren();
     for(const t of state.project.texts||[]){addPill(sub,{left:pad+number(t.start)*scale,width:number(t.duration)*scale,cls:'cut-text-pill',text:'Ｔ '+(t.text||'文字').slice(0,22),onclick:()=>{state.selectedText=t.id;api.setPanel('text');document.querySelector('.tools-shell')?.classList.add('pro-visible');}}).dataset.textId=t.id;}
     for(const c of state.project.captions||[]){addPill(sub,{left:pad+number(c.start)*scale,width:Math.max(.08,number(c.end)-number(c.start))*scale,cls:'cut-caption-pill',text:'▤ '+(c.text||'字幕').slice(0,22),onclick:()=>onSelectCaption(c.id)}).dataset.captionId=c.id;}
     renderQuick();
   }finally{rendering=false;}
 }
 function tick(){
   if(state.playing&&!dragging&&!pinching&&document.visibilityState==='visible'){
     const target=timelineScroll(state.current,pps());
     if(Math.abs(scroller.scrollLeft-target)>.7){blockScroll=true;scroller.scrollLeft=target;blockScroll=false;}
   }
   renderTransformBox();
 }
 function updateFromScroll(){
   if(blockScroll||pinching||dragging||state.playing)return;
   if(renderFrame)cancelAnimationFrame(renderFrame);
   renderFrame=requestAnimationFrame(()=>{
     renderFrame=0;const t=timelineTime(scroller.scrollLeft,pps(),projectDuration());
     if(Math.abs(t-state.current)>.018)seek(t);
   });
 }
 scroller.addEventListener('contextmenu',e=>{if(e.target.closest('[data-clip-id],[data-text-id],[data-caption-id],[data-layer-id],[data-audio-id],[data-cg-id]'))e.preventDefault();});
 scroller.addEventListener('scroll',updateFromScroll,{passive:true});
 scroller.addEventListener('click',e=>{
   if(!e.target.closest('.cut-time-ruler')||dragging||pinching)return;
   const rect=content.getBoundingClientRect(),pad=scroller.clientWidth/2;
   const t=clamp((e.clientX-rect.left-pad)/pps(),0,projectDuration());
   seek(t);blockScroll=true;scroller.scrollLeft=timelineScroll(t,pps());blockScroll=false;
 });
 scroller.addEventListener('click',e=>{if(performance.now()<suppressTapUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
 scroller.addEventListener('pointerdown',e=>{
   const card=e.target.closest('[data-clip-id]');
   const handle=e.target.closest('[data-trim-edge]');
   if(handle&&card){
     const clip=state.project.clips.find(c=>c.id===card.dataset.clipId);if(!clip)return;
     e.preventDefault();e.stopPropagation();dragging=true;
     const snapshot={...clip},edge=handle.dataset.trimEdge,pointer=e.pointerId,startX=e.clientX,asset=state.assets.get(clip.assetId);
     scroller.setPointerCapture(pointer);dragData={mode:'trim',clip,snapshot,edge,startX,assetSeconds:asset?.type==='image'?180:asset?.duration||Infinity};
     card.classList.add('cut-dragging');
     return;
   }
   if(card){
     const id=card.dataset.clipId,startX=e.clientX,startY=e.clientY;pendingHoldStart={x:startX,y:startY};
     longTimer=setTimeout(()=>{longTimer=null;dragging=true;dragData={mode:'reorder',id,startX,startY,currentIndex:state.project.clips.findIndex(c=>c.id===id)};
       scroller.setPointerCapture(e.pointerId);card.classList.add('cut-dragging');
       window.__subehaTrash?.begin('clip',id,{clientX:startX,clientY:startY});
       navigator.vibrate?.(16);
     },420);
   }else if(e.target.closest('[data-audio-id],[data-layer-id]')){
     const pill=e.target.closest('[data-audio-id],[data-layer-id]');scroller.setPointerCapture(e.pointerId);dragData={mode:pill.dataset.audioId?'move-audio':'move-layer',id:pill.dataset.audioId||pill.dataset.layerId,startX:e.clientX,startY:e.clientY,original:null,active:false};
   }else {
     const pill=e.target.closest('[data-text-id],[data-caption-id],[data-cg-id]');
     if(pill){const kind=pill.dataset.textId?'text':pill.dataset.captionId?'caption':'cg';const id=pill.dataset.textId||pill.dataset.captionId||pill.dataset.cgId;const startX=e.clientX,startY=e.clientY;pendingHoldStart={x:startX,y:startY};
       longTimer=setTimeout(()=>{longTimer=null;dragging=true;dragData={mode:'discard',kind,id};scroller.setPointerCapture(e.pointerId);window.__subehaTrash?.begin(kind,id,{clientX:startX,clientY:startY});navigator.vibrate?.(16);},420);
     }
   }
 },true);
 scroller.addEventListener('pointermove',e=>{
   if(longTimer && dragData?.mode!=='reorder'){
     // Allow normal scroll gestures to cancel the long-press.
     // On pointer moves the queued click will still work.
   }
   if(longTimer){
     const p=e.target.closest('[data-clip-id],[data-text-id],[data-caption-id],[data-cg-id]');
     // A scroll move cancels reordering before the 420ms threshold.
     if(!p || !pendingHoldStart || Math.hypot(e.clientX-pendingHoldStart.x,e.clientY-pendingHoldStart.y)>10){clearTimeout(longTimer);longTimer=null;pendingHoldStart=null;}
   }
   if(!dragData)return;
   if(dragData.mode==='trim'){
     e.preventDefault();
     const next=clipTrim(dragData.snapshot,dragData.edge,e.clientX-dragData.startX,pps(),dragData.assetSeconds);
     dragData.clip.start=next.start;dragData.clip.end=next.end;
     const seconds=(next.end-next.start)/(next.speed||1);
     $('cut-selection').textContent=`${next.name.slice(0,20)} · ${seconds.toFixed(2)}秒`;
   }else if(dragData.mode==='reorder'){
     e.preventDefault();window.__subehaTrash?.move(e);
     const cards=[...$('cut-video-lane').querySelectorAll('[data-clip-id]')];
     const nearest=cards.reduce((best,item,index)=>{
       const rect=item.getBoundingClientRect(),distance=Math.abs(e.clientX-(rect.left+rect.width/2));
       return distance<best.distance?{distance,index}:best;
     },{distance:Infinity,index:dragData.currentIndex});
     dragData.currentIndex=nearest.index;
     for(const [i,item] of cards.entries())item.classList.toggle('cut-drop-target',i===nearest.index);
   }else if(dragData.mode==='discard'){
     e.preventDefault();window.__subehaTrash?.move(e);
   }else if(dragData.mode==='move-audio'||dragData.mode==='move-layer'){
     const arr=dragData.mode==='move-audio'?state.project.audioTracks:state.project.overlays;
     const row=(arr||[]).find(x=>x.id===dragData.id);if(!row)return;
     if(Math.hypot(e.clientX-dragData.startX,e.clientY-dragData.startY)<6&&!dragData.active)return;
     if(!dragData.active){dragData.original=row.start;dragData.active=true;window.__subehaTrash?.begin(dragData.mode==='move-audio'?'audio':'layer',dragData.id,e);}
     window.__subehaTrash?.move(e);
     e.preventDefault();dragging=true;
     row.start=clamp(dragData.original+(e.clientX-dragData.startX)/pps(),0,projectDuration());
     $('cut-selection').textContent=`開始 ${row.start.toFixed(2)}s`;
   }
 });
 function finishDrag(e){
   if(longTimer){clearTimeout(longTimer);longTimer=null;}pendingHoldStart=null;
   if(!dragData)return;
   const data=dragData;dragData=null;
   const wasDragging=dragging;dragging=false;
   const removed=e.type==='pointerup'&&data.mode!=='trim'?window.__subehaTrash?.finish(e):false;
   window.__subehaTrash?.cancel();
   if(removed){suppressTapUntil=performance.now()+420;lastSelected='';lastSummary='';render();return;}
   if(data.mode==='trim'){
     if(Math.abs(data.snapshot.start-data.clip.start)+Math.abs(data.snapshot.end-data.clip.end)>.001){save();refreshAll();const row=spans(state.project.clips).find(r=>r.clip.id===data.clip.id);seek((row?.start||0)+(data.edge==='right'?row?.length||0:0));}
   }else if(data.mode==='reorder'){
     const next=moveClip(state.project.clips,data.id,data.currentIndex);
     if(next.some((c,i)=>c.id!==state.project.clips[i]?.id)){state.project.clips=next;save();refreshAll();api.toast('クリップを並べ替えました（変更箇所の転換は解除）');}
   }else if(wasDragging && (data.mode==='move-layer'||data.mode==='move-audio')){save();refreshAll();}
   render();
 }
 scroller.addEventListener('pointerup',finishDrag);
 scroller.addEventListener('pointercancel',finishDrag);
 scroller.addEventListener('pointerleave',()=>{if(longTimer){clearTimeout(longTimer);longTimer=null;}});
 let previousTouchDistance=0,previousZoom=0;
 scroller.addEventListener('touchstart',e=>{
   if(e.touches.length===2){pinching=true;previousTouchDistance=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);previousZoom=pps();}
 },{passive:true});
 scroller.addEventListener('touchmove',e=>{
   if(dragging&&dragData?.mode!=='trim'){e.preventDefault();return;}
   if(!pinching||e.touches.length!==2)return;
   e.preventDefault();
   const gap=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
   if(previousTouchDistance>4){setTimelineScale(previousZoom*gap/previousTouchDistance);}
 },{passive:false});
 scroller.addEventListener('touchend',e=>{if(e.touches.length<2)pinching=false;},{passive:true});
 function selectedText(){return state.project.texts.find(t=>t.id===state.selectedText);}
 function activeTransform(){
   if(getEditMode?.())return null;
   if(!window.__subehaDirectTextActive && document.body.classList.contains('pro-open') && /^レイヤー/.test($('pro-title')?.textContent||'')){
     const l=getLayer();if(l)return {kind:'layer',target:l};
   }
   if(document.querySelector('.tools-shell')?.classList.contains('pro-visible')&&state.panel==='text'){
     const t=selectedText();if(t&&!window.__subehaDirectTextActive)return {kind:'text',target:t};
   }
   return null;
 }
 function transformedProps(obj){return obj.kind==='layer'?getLayerProps(obj.target,state.current-obj.target.start):{x:obj.target.x,y:obj.target.y,scale:obj.target.size/80,rotation:0};}
 function renderTransformBox(){
   const obj=activeTransform();
   if(!obj||!state.project.clips.length){box.hidden=true;centerGuide.hidden=true;return;}
   const props=transformedProps(obj),rectangle=canvas.getBoundingClientRect(),parent=stage.getBoundingClientRect();
   const asset=state.assets.get(obj.target.assetId);
   const aspect=obj.kind==='layer'?(asset?.height||1)/(asset?.width||1):.3;
   const w=obj.kind==='layer'?rectangle.width*clamp(props.scale,.08,3.5):Math.max(70,Math.min(rectangle.width,160*(obj.target.size||60)/60));
   const h=obj.kind==='layer'?w*aspect:Math.max(28,obj.target.size||60);
   box.style.left=(rectangle.left-parent.left+rectangle.width*props.x)+'px';
   box.style.top=(rectangle.top-parent.top+rectangle.height*props.y)+'px';
   box.style.width=w+'px';box.style.height=h+'px';box.style.transform=`translate(-50%,-50%) rotate(${props.rotation||0}deg)`;
   box.hidden=false;
 }
 const fingers=new Map();let transform=null;
 function pointerPos(e){const rect=canvas.getBoundingClientRect();return {x:(e.clientX-rect.left)/rect.width,y:(e.clientY-rect.top)/rect.height};}
 const pointDistance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const pointAngle=(a,b)=>Math.atan2(b.clientY-a.clientY,b.clientX-a.clientX)*180/Math.PI;
 canvas.addEventListener('pointerdown',e=>{
   const obj=activeTransform();if(!obj)return;
   const point=pointerPos(e),props=transformedProps(obj);
   const allowed=fingers.size>0 || (Math.abs(point.x-props.x)<Math.max(.09,(props.scale||.4)*.65)&&Math.abs(point.y-props.y)<Math.max(.07,(props.scale||.4)*.65));
   if(!allowed)return;
   e.preventDefault();e.stopImmediatePropagation();
   canvas.setPointerCapture(e.pointerId);fingers.set(e.pointerId,e);
   if(fingers.size===1){transform={obj,origin:props,initial:point,mode:'move',changed:false};}
   else if(fingers.size===2){const [a,b]=[...fingers.values()];transform={obj,origin:transformedProps(obj),mode:'pinch',distance:pointDistance(a,b)||1,angle:pointAngle(a,b),changed:false};}
 },true);
 canvas.addEventListener('pointermove',e=>{
   if(!fingers.has(e.pointerId)||!transform)return;
   e.preventDefault();e.stopImmediatePropagation();fingers.set(e.pointerId,e);
   const data=transform;let patch;
   if(fingers.size===2){const [a,b]=[...fingers.values()];patch={scale:clamp((data.origin.scale||.5)*pointDistance(a,b)/data.distance,.08,3.5),rotation:(data.origin.rotation||0)+pointAngle(a,b)-data.angle};}
   else if(fingers.size===1 && data.mode==='move'){
     const current=pointerPos(e);const x=clamp(data.origin.x+current.x-data.initial.x,-.6,1.6),y=clamp(data.origin.y+current.y-data.initial.y,-.6,1.6);
     patch={x:Math.abs(x-.5)<.02?.5:x,y:Math.abs(y-.5)<.02?.5:y};
     centerGuide.hidden=!(patch.x===.5||patch.y===.5);
     centerGuide.classList.toggle('vertical',patch.x===.5);centerGuide.classList.toggle('horizontal',patch.y===.5);
   }else return;
   data.changed=true;
   if(data.obj.kind==='layer'){
     const next=applyOverlayTransform(data.obj.target,state.current,patch);
     Object.assign(data.obj.target,next);
     for(const [key,value] of Object.entries(patch)){const slider=$('pro-'+key),label=$('pro-'+key+'-value');if(slider)slider.value=value;if(label)label.textContent=Number(value).toFixed(key==='rotation'?0:2);}
   }else{
     if(patch.x!==undefined)data.obj.target.x=patch.x;
     if(patch.y!==undefined)data.obj.target.y=patch.y;
     if(patch.scale!==undefined)data.obj.target.size=clamp(patch.scale*80,16,120);
   }
   draw();renderTransformBox();
 },true);
 function releasePointer(e){if(!fingers.has(e.pointerId))return;
   e.preventDefault();e.stopImmediatePropagation();fingers.delete(e.pointerId);
   if(transform?.changed){save();render();}
   if(fingers.size===1){const remaining=[...fingers.values()][0],obj=activeTransform();if(obj)transform={obj,mode:'move',origin:transformedProps(obj),initial:pointerPos(remaining),changed:false};}
   else if(!fingers.size){transform=null;centerGuide.hidden=true;}
 }
 canvas.addEventListener('pointerup',releasePointer,true);canvas.addEventListener('pointercancel',releasePointer,true);
 window.addEventListener('keydown',e=>{
   if(e.defaultPrevented||isEditable(e.target)||e.altKey||e.metaKey)return;
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)api.redo();else api.undo();return;}
   if(e.key===' '){e.preventDefault();$('play').click();}
   if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();seek(clamp(state.current+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?.5:1/30),0,projectDuration()));}
   if((e.key==='Backspace'||e.key==='Delete')&&state.selectedClip){e.preventDefault();$('delete-clip')?.click();}
 });
 // Android Chrome may restore previous scroll position; explicitly center playhead on load.
 render();requestAnimationFrame(()=>{blockScroll=true;scroller.scrollLeft=timelineScroll(state.current,pps());blockScroll=false;});
 return {render,tick,zoom:setTimelineScale,refreshSelection:()=>{lastSelected='';renderQuick();}};
}
