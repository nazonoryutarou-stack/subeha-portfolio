/* SUBEHA CUT Pro workspace: original mobile timeline/editor UI, no proprietary assets. */
const $ = id => document.getElementById(id);
const api = window.__subehaCut;
const {state,canvas,ctx,buildAsset,seek,save,refreshAll,draw,selectedClip,updateClip,setPanel,renderHooks,toast,newID,undo,redo} = api;
const root = $('app');
const shell = document.querySelector('.timeline-shell');
let selectedOverlay = null;
let zoom = 15;
let syncing = false;
const playbackVideos = new Map();
const mix = {normal:'source-over',screen:'screen',multiply:'multiply',lighten:'lighten',darken:'darken',overlay:'overlay',difference:'difference'};
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const totalTime=()=>state.project.clips.reduce((s,c)=>s+Math.max(0,(c.end-c.start)/(c.speed||1)),0);
const time=(n)=>{let x=Math.max(0,Math.floor(n||0));return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');};
const safe=(v)=>String(v||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function createControl(label,id,min,max,step,value){return '<label class="pro-slider">'+label+' <output id="'+id+'-value">'+value+'</output><input type="range" id="'+id+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"></label>';}
function panel(title,body){$('pro-title').textContent=title;$('pro-content').innerHTML=body;openDrawer();}
function openDrawer(){document.body.classList.add('pro-open');document.querySelector('.tools-shell').classList.remove('pro-visible');}
function closeDrawer(){document.body.classList.remove('pro-open');}
function installChrome(){
  document.title='SUBEHA CUT — Editor';
  document.querySelector('.brand').innerHTML='<span class="pro-brand-symbol">◈</span><span>SUBEHA <b>CUT</b></span>';
  $('new-project').textContent='⌂';$('new-project').title='新規プロジェクト';
  $('project-save').textContent='↶';$('project-save').title='編集情報を保存';
  $('export-open').textContent='↥ 保存';
  const header=document.querySelector('.topbar');
  header.insertAdjacentHTML('beforeend','<span class="pro-head-version">PRO EDITOR</span>');
  document.querySelector('.viewer-head').hidden=true;
  const stage=$('preview-stage');stage.classList.add('pro-stage');
  document.querySelector('.transport').insertAdjacentHTML('afterbegin','<button id="pro-undo" aria-label="元に戻す" class="pro-history">↶</button>');
  document.querySelector('.transport').insertAdjacentHTML('beforeend','<button id="pro-redo" aria-label="やり直す" class="pro-history">↷</button>');
  $('pro-undo').onclick=()=>{undo();renderTimeline();};$('pro-redo').onclick=()=>{redo();renderTimeline();};
  $('play').textContent='▶';
  const nav=document.querySelector('.bottomnav');
  nav.innerHTML='<button class="nav-tab" data-tab="clips"><span>▥</span>編集</button>'+
  '<button class="nav-tab pro-nav" data-pro="overlay"><span>▧</span>オーバーレイ</button>'+
  '<button class="nav-tab" data-tab="text"><span>Ｔ</span>テキスト</button>'+
  '<button class="nav-tab" data-tab="audio"><span>♫</span>音声</button>'+
  '<button class="nav-tab" data-tab="look"><span>◉</span>フィルター</button>'+
  '<button class="nav-tab pro-nav" data-pro="adjust"><span>☷</span>調整</button>'+
  '<button class="nav-tab pro-nav" data-pro="transform"><span>◇</span>変形</button>'+
  '<button class="nav-tab pro-nav" data-pro="effects"><span>✦</span>効果</button>'+
  '<button class="nav-tab" data-tab="export"><span>↗</span>出力</button>';
  nav.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{closeDrawer();setPanel(b.dataset.tab);document.querySelector('.tools-shell').classList.add('pro-visible');nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));});
  nav.querySelectorAll('[data-pro]').forEach(b=>b.onclick=()=>{document.querySelector('.tools-shell').classList.remove('pro-visible');nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));showPanel(b.dataset.pro);});
  document.querySelector('.tools-shell').insertAdjacentHTML('afterbegin','<button id="pro-close-native" class="pro-close-native" aria-label="編集パネルを閉じる">×</button>');
  $('pro-close-native').onclick=()=>document.querySelector('.tools-shell').classList.remove('pro-visible');
  root.insertAdjacentHTML('beforeend','<div id="pro-drawer" role="region" aria-label="追加編集機能"><header><strong id="pro-title">編集</strong><button id="pro-close">×</button></header><div id="pro-content"></div></div><input id="pro-overlay-picker" type="file" accept="image/*,video/*" hidden>');
  $('pro-close').onclick=closeDrawer;
  document.querySelector('.viewer-bottom').insertAdjacentHTML('beforeend','<button id="pro-fullscreen" class="chip">⛶</button>');
  $('pro-fullscreen').onclick=()=>{if(!document.fullscreenElement)stage.requestFullscreen?.().catch(()=>toast('全画面表示は非対応です'));else document.exitFullscreen?.();};
  document.querySelector('.timeline-shell .section-label').innerHTML='<span id="pro-timeline-caption">タイムライン</span><div class="pro-zoom"><button id="pro-zoom-out">−</button><span id="pro-zoom-label">15px/s</span><button id="pro-zoom-in">＋</button></div>';
  $('pro-zoom-out').onclick=()=>{zoom=clamp(zoom/1.45,7,60);renderTimeline();};
  $('pro-zoom-in').onclick=()=>{zoom=clamp(zoom*1.45,7,60);renderTimeline();};
  const ruler=document.createElement('div');ruler.id='pro-scrub-ruler';ruler.innerHTML='<div id="pro-ruler-ticks"></div><div id="pro-playhead"></div>';
  $('clip-track').before(ruler);
  ruler.addEventListener('pointerdown',e=>{ruler.setPointerCapture(e.pointerId);scrubAt(e);});
  ruler.addEventListener('pointermove',e=>{if(e.buttons) scrubAt(e);});
  const extra=document.createElement('div');extra.id='pro-layer-track';extra.className='pro-layer-track';
  $('clip-track').after(extra);
  $('pro-overlay-picker').addEventListener('change',async e=>{await importOverlay([...e.target.files]);e.target.value='';});
  document.querySelector('.privacy-note').textContent='ローカル編集 · 原本は端末内に保持 · 書き出し形式はブラウザ依存';
}
function scrubAt(e){const rect=$('pro-scrub-ruler').getBoundingClientRect();seek(clamp((e.clientX-rect.left)/rect.width*totalTime(),0,totalTime()));renderPlayhead();}
function renderPlayhead(){let d=totalTime(),pos=d>0?state.current/d*100:0;const ph=$('pro-playhead');if(ph)ph.style.left=pos+'%';}
function renderTimeline(){
  if(syncing)return;syncing=true;
  try{
    const clips=state.project.clips;
    const buttons=$('clip-track').querySelectorAll('.clip-card');
    buttons.forEach((b,i)=>{const c=clips[i];if(c){const width=Math.max(55,Math.min(800,(c.end-c.start)/(c.speed||1)*zoom));b.style.width=width+'px';b.style.minWidth=width+'px';b.style.scrollSnapAlign='none';}});
    let d=totalTime();
    const ticks=$('pro-ruler-ticks');ticks.replaceChildren();
    const every=d>180?60:d>45?15:d>12?5:1;
    for(let n=0;n<=d;n+=every){const span=document.createElement('span');span.textContent=time(n);span.style.left=(d?100*n/d:0)+'%';ticks.append(span);}
    const track=$('pro-layer-track');track.replaceChildren();
    const over=state.project.overlays||[];
    if(over.length){
      const row=document.createElement('div');row.className='pro-layer-row';
      row.style.width=Math.max(100,d*zoom)+'px';
      for(const layer of over){const b=document.createElement('button');b.className='pro-layer-pill';b.style.left=(layer.start*zoom)+'px';b.style.width=(Math.max(30,layer.duration*zoom))+'px';b.textContent='▧ '+(state.assets.get(layer.assetId)?.name||'レイヤー').slice(0,12);b.classList.toggle('selected',selectedOverlay===layer.id);b.onclick=()=>{selectedOverlay=layer.id;showPanel('overlay');renderTimeline();seek(layer.start);};row.append(b);}
      track.append(row);
    }
    $('pro-zoom-label').textContent=Math.round(zoom)+'px/s';renderPlayhead();
  }finally{syncing=false;}
}
function selectedLayer(){return (state.project.overlays||[]).find(x=>x.id===selectedOverlay)||null;}
async function importOverlay(files){
  if(!state.project.clips.length){toast('先にベースの動画・画像を追加してください');return;}
  for(const file of files){let type=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':null;if(!type)continue;
    const id=newID();try{let asset=await buildAsset(id,file,type,file.name);const layer={id:newID(),assetId:id,start:state.current,duration:type==='video'?Math.min(asset.duration,5):3,x:.5,y:.5,scale:.48,rotation:0,opacity:1,blend:'normal',mask:'rect',keyframes:[]};
      state.project.overlays ||= [];state.project.overlays.push(layer);selectedOverlay=layer.id;
      if(type==='video')makeOverlayVideo(asset);
      if(window.__subehaSaveAsset) await window.__subehaSaveAsset(id,file,type,file.name);
    }catch(e){console.error(e);toast('レイヤー追加に失敗しました');}
  }
  save();renderTimeline();showPanel('overlay');draw();
}
function makeOverlayVideo(asset){let v=playbackVideos.get(asset.id);if(v)return v;v=document.createElement('video');v.src=asset.url;v.muted=true;v.playsInline=true;v.preload='auto';playbackVideos.set(asset.id,v);return v;}
function keyframeValue(layer,t){
  const points=(layer.keyframes||[]).slice().sort((a,b)=>a.time-b.time);const base={x:layer.x,y:layer.y,scale:layer.scale,opacity:layer.opacity,rotation:layer.rotation};
  if(!points.length)return base;if(t<=points[0].time)return {...base,...points[0]};
  if(t>=points[points.length-1].time)return {...base,...points[points.length-1]};
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(t<=b.time){const m=clamp((t-a.time)/(b.time-a.time),0,1);const r={...base};for(const k of Object.keys(base))r[k]=Number(a[k]??base[k])+(Number(b[k]??base[k])-Number(a[k]??base[k]))*m;return r;}}
  return base;
}
function renderLayers(){
  const W=canvas.width,H=canvas.height;
  for(const layer of state.project.overlays||[]){const local=state.current-layer.start;if(local<0||local>layer.duration)continue;const asset=state.assets.get(layer.assetId);if(!asset)continue;
    let view=asset.image;
    if(asset.type==='video'){
      const v=makeOverlayVideo(asset);view=v;
      const target=clamp(local,0,asset.duration||local);
      if(v.readyState>=1 && Math.abs(v.currentTime-target)>.22)try{v.currentTime=target;}catch{}
      if(state.playing&&v.paused)v.play().catch(()=>{});
      if(!state.playing&&!v.paused)v.pause();
    }
    if(!view || (asset.type==='video'&&view.readyState<2))continue;
    const props=keyframeValue(layer,local),w=W*props.scale,h=w*(asset.height||view.videoHeight||1)/(asset.width||view.videoWidth||1);
    if(!(w>0&&h>0))continue;
    ctx.save();ctx.globalAlpha=clamp(props.opacity,0,1);ctx.globalCompositeOperation=mix[layer.blend]||'source-over';
    ctx.translate(props.x*W,props.y*H);ctx.rotate(props.rotation*Math.PI/180);
    if(layer.mask==='circle'){ctx.beginPath();ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);ctx.clip();}
    if(layer.mask==='soft'){const gr=ctx.createRadialGradient(0,0,Math.min(w,h)*.12,0,0,Math.max(w,h)*.7);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1,'rgba(255,255,255,0)');ctx.filter='blur(1px)';ctx.globalAlpha*=.8;}
    try{ctx.drawImage(view,-w/2,-h/2,w,h);}catch{}
    ctx.restore();
  }
}
function bindSliders(kind,params,onChange){
  for(const [key,min,max,step] of params){const el=$('pro-'+key);if(!el)continue;el.oninput=e=>{const n=Number(e.target.value);$('pro-'+key+'-value').textContent=(step===1?Math.round(n):n);onChange(key,n);};}
}
function showPanel(which){
  if(which==='overlay'){
    const layer=selectedLayer();
    if(!layer){panel('オーバーレイ','<p>画像・動画を重ね、キーフレームや合成方法を設定できます。</p><button id="pro-import-layer" class="pro-primary">＋ 画像・動画レイヤー</button>');}
    else{
      const fields=[['x',0,1,.01],['y',0,1,.01],['scale',.1,1.9,.01],['opacity',0,1,.01],['rotation',-180,180,1],['duration',.2,180,.1],['start',0,180,.1]];
      panel('レイヤーを編集','<button id="pro-import-layer" class="pro-primary">＋ レイヤーを追加</button><div class="pro-controls">'+fields.map(([k,a,b,c])=>createControl(k,'pro-'+k,a,b,c,layer[k])).join('')+'</div><label class="pro-select">合成 <select id="pro-blend">'+Object.keys(mix).map(k=>'<option value="'+k+'" '+(layer.blend===k?'selected':'')+'>'+k+'</option>').join('')+'</select></label><label class="pro-select">マスク <select id="pro-mask"><option value="rect">通常</option><option value="circle">円形</option></select></label><div class="pro-inline"><button id="pro-keyframe">◆ この位置をキーフレーム登録</button><button id="pro-remove-layer" class="pro-danger">レイヤー削除</button></div><p class="pro-tip">キーフレーム数: '+(layer.keyframes?.length||0)+' / レイヤーを選ぶと時間軸に表示</p>');
      $('pro-mask').value=layer.mask||'rect';$('pro-blend').onchange=e=>changeLayer(l=>l.blend=e.target.value);$('pro-mask').onchange=e=>changeLayer(l=>l.mask=e.target.value);
      bindSliders('overlay',fields,(k,n)=>changeLayer(l=>l[k]=n));
      $('pro-keyframe').onclick=()=>changeLayer(l=>{let t=clamp(state.current-l.start,0,l.duration);l.keyframes ||= [];l.keyframes=l.keyframes.filter(f=>Math.abs(f.time-t)>.04);l.keyframes.push({time:t,x:l.x,y:l.y,scale:l.scale,opacity:l.opacity,rotation:l.rotation});toast('◆ キーフレームを登録しました');});
      $('pro-remove-layer').onclick=()=>{state.project.overlays=state.project.overlays.filter(l=>l.id!==layer.id);selectedOverlay=null;save();renderTimeline();showPanel('overlay');draw();};
    }
    $('pro-import-layer').onclick=()=>$('pro-overlay-picker').click();
  }else if(which==='adjust'){
    const c=selectedClip();if(!c){panel('色調整','<p>先にタイムラインから編集対象クリップを選んでください。</p>');return;}
    const fields=[['brightness',20,200,1],['contrast',20,200,1],['saturation',0,300,1],['hue',-180,180,1],['blur',0,10,.5]];
    panel('色調整 · '+c.name,'<div class="pro-controls">'+fields.map(([k,a,b,s])=>createControl(k,'pro-'+k,a,b,s,(c.adjust||{})[k]??(k==='hue'||k==='blur'?0:100))).join('')+'</div><button id="pro-reset-adjust">調整をリセット</button>');
    bindSliders('adjust',fields,(k,n)=>updateClip(x=>{x.adjust ||= {};x.adjust[k]=n;}));
    $('pro-reset-adjust').onclick=()=>{updateClip(c=>c.adjust={});showPanel('adjust');};
  }else if(which==='transform'){
    const c=selectedClip();if(!c){panel('変形','<p>先にクリップを選択してください。</p>');return;}
    panel('変形 · '+c.name,'<div class="pro-inline"><button id="pro-flip-h">⇆ 左右反転</button><button id="pro-flip-v">⇅ 上下反転</button><button id="pro-rotate90">⟳ 90°回転</button></div><div class="pro-controls">'+createControl('拡大率','pro-zoomscale',.5,3,.01,c.zoom||1)+createControl('透明度','pro-clipopacity',0,1,.01,c.opacity??1)+'</div>');
    $('pro-flip-h').onclick=()=>updateClip(c=>c.flipX=!c.flipX);$('pro-flip-v').onclick=()=>updateClip(c=>c.flipY=!c.flipY);$('pro-rotate90').onclick=()=>updateClip(c=>c.rotation=((c.rotation||0)+90)%360);
    bindSliders('transform',[['zoomscale',.5,3,.01],['clipopacity',0,1,.01]],(k,n)=>updateClip(c=>c[k==='zoomscale'?'zoom':'opacity']=n));
  }else if(which==='effects'){
    panel('映像効果','<p>Videoleap系の編集操作を参考にした独立実装。フィルター・色調整・反転・合成を組み合わせられます。</p><div class="pro-effect-list"><button data-fx="glitch">GLITCH</button><button data-fx="dream">DREAM</button><button data-fx="mono">MONO</button><button data-fx="cinema">CINEMA</button><button data-fx="vintage">VINTAGE</button><button data-fx="none">ORIGINAL</button></div><p class="pro-tip">背景除去、AI生成、物体追跡は未実装。</p>');
    $('pro-content').querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{if(!selectedClip())return toast('クリップを選択してください');updateClip(c=>c.filter=b.dataset.fx);});
  }
}
function changeLayer(fn){const layer=selectedLayer();if(!layer||state.recording)return;fn(layer);save();renderTimeline();draw();}
function mount(){
  state.project.overlays ||= [];
  installChrome();
  for(const layer of state.project.overlays){const a=state.assets.get(layer.assetId);if(a?.type==='video')makeOverlayVideo(a);}
  renderHooks.push(renderLayers);
  window.addEventListener('subeha-cut-change',()=>{requestAnimationFrame(renderTimeline);});
  const track=$('clip-track');
  const observer=new MutationObserver(()=>{requestAnimationFrame(renderTimeline);});
  observer.observe(track,{childList:true});
  document.querySelector('.topbar #export-open').addEventListener('click',()=>{closeDrawer();document.querySelector('.tools-shell').classList.add('pro-visible');});
  document.querySelectorAll('#panel-text input').forEach(el=>el.addEventListener('input',()=>{requestAnimationFrame(renderTimeline);}));
  const motionBox=document.createElement('label');motionBox.className='pro-select';motionBox.innerHTML='文字の登場効果 <select id="pro-text-motion"><option value="none">なし</option><option value="fade">フェード</option><option value="pop">ポップ</option><option value="slide">スライド</option></select>';
  $('text-editor').append(motionBox);
  $('pro-text-motion').onchange=e=>{const t=state.project.texts.find(x=>x.id===state.selectedText);if(t){t.motion=e.target.value;save();draw();}};
  const nativeTabs=document.querySelectorAll('.nav-tab[data-tab]');nativeTabs[0]?.classList.add('active');
  renderTimeline();
  function frame(){renderPlayhead();requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
if(window.__subehaCut && state.project) { if(document.readyState==='loading')window.addEventListener('subeha-cut-ready',mount,{once:true});else if(state.assets.size||document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',mount,{once:true});}
