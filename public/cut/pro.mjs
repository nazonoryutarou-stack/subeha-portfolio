/* SUBEHA CUT Pro 0.3 - original offline compositing and tracking studio. */
import {chromaPixels,trackingPosition,bound} from './compositor.mjs';
import {createMultiAudioEngine} from './multi-audio.mjs';
import {startPointTrack,trackPoint} from './point-tracker.mjs';
import {locate} from './timeline.mjs';
import {parseSubtitleFile,exportSRT,drawCaptions,defaultCaptionStyle} from './subtitles.mjs';
import {createProjectArchive,readProjectArchive} from './project-archive.mjs';
import {decodeWaveform,drawPeaks} from './waveform.mjs';
const $ = id => document.getElementById(id);
const api = window.__subehaCut;
const {state,canvas,ctx,buildAsset,seek,save,refreshAll,draw,selectedClip,updateClip,setPanel,renderHooks,toast,newID,undo,redo} = api;
const root = $('app');
const shell = document.querySelector('.timeline-shell');
let selectedOverlay = null;
let selectedAudio=null, selectedCue=null, captionOffset=0, editMode=null, trackingSession=null, lastTrackingAt=-1;
const layerBuffers=new Map();
const waveformCache=new Map(),waveformPending=new Set();
const audioEngine=createMultiAudioEngine({state,getGraph:api.getAudioGraph});
const trackCanvas=document.createElement('canvas');trackCanvas.width=180;trackCanvas.height=320;
const trackCtx=trackCanvas.getContext('2d',{willReadFrequently:true});
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
  '<button class="nav-tab pro-nav" data-pro="captions"><span>▤</span>字幕</button>'+
  '<button class="nav-tab" data-tab="audio"><span>♫</span>音声</button>'+
  '<button class="nav-tab pro-nav" data-pro="chroma"><span>◩</span>キー合成</button>'+
  '<button class="nav-tab pro-nav" data-pro="tracking"><span>⊙</span>追跡</button>'+ 
  '<button class="nav-tab" data-tab="look"><span>◉</span>フィルター</button>'+
  '<button class="nav-tab pro-nav" data-pro="adjust"><span>☷</span>調整</button>'+
  '<button class="nav-tab pro-nav" data-pro="transform"><span>◇</span>変形</button>'+
  '<button class="nav-tab pro-nav" data-pro="effects"><span>✦</span>効果</button>'+
  '<button class="nav-tab pro-nav" data-pro="project"><span>▦</span>保存/復元</button>'+
  '<button class="nav-tab" data-tab="export"><span>↗</span>出力</button>';
  nav.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{closeDrawer();setPanel(b.dataset.tab);document.querySelector('.tools-shell').classList.add('pro-visible');nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));});
  nav.querySelectorAll('[data-pro]').forEach(b=>b.onclick=()=>{document.querySelector('.tools-shell').classList.remove('pro-visible');nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));showPanel(b.dataset.pro);});
  document.querySelector('.tools-shell').insertAdjacentHTML('afterbegin','<button id="pro-close-native" class="pro-close-native" aria-label="編集パネルを閉じる">×</button>');
  $('pro-close-native').onclick=()=>document.querySelector('.tools-shell').classList.remove('pro-visible');
  root.insertAdjacentHTML('beforeend','<div id="pro-drawer" role="region" aria-label="追加編集機能"><header><strong id="pro-title">編集</strong><button id="pro-close">×</button></header><div id="pro-content"></div></div><input id="pro-overlay-picker" type="file" accept="image/*,video/*" hidden><input id="pro-audio-picker" type="file" accept="audio/*" multiple hidden><input id="pro-caption-picker" type="file" accept=".srt,.vtt,.json,text/plain,application/json" hidden><input id="pro-project-picker" type="file" accept=".subecut,.zip,application/zip" hidden>');
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
  $('pro-audio-picker').addEventListener('change',async e=>{await importAudioTracks([...e.target.files]);e.target.value='';});
  $('pro-caption-picker').addEventListener('change',async e=>{if(e.target.files[0])await importCaptions(e.target.files[0]);e.target.value='';});
  $('pro-project-picker').addEventListener('change',async e=>{if(e.target.files[0])await restoreArchive(e.target.files[0]);e.target.value='';});
  document.querySelector('.bottomnav [data-tab=audio]').onclick=()=>{document.querySelector('.tools-shell').classList.remove('pro-visible');document.querySelectorAll('.bottomnav button').forEach(x=>x.classList.toggle('active',x.dataset.tab==='audio'));showPanel('multiaudio');};
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
    $('pro-zoom-label').textContent=Math.round(zoom)+'px/s';renderPlayhead();renderAudioTimeline(d);renderCaptionTimeline(d);
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
function overlayImage(layer,view,asset){
  const sw=asset.width||view.videoWidth||1,sh=asset.height||view.videoHeight||1;
  const scale=Math.min(1,640/Math.max(sw,sh));
  const w=Math.max(2,Math.round(sw*scale)),h=Math.max(2,Math.round(sh*scale));
  const signature=JSON.stringify([asset.id,layer.key,layer.mask,layer.points,layer.feather,layer.chroma]);
  const cache=layerBuffers.get(layer.id);
  if(asset.type==='image'&&cache?.signature===signature)return cache.canvas;
  let buffer=cache?.canvas;
  if(!buffer||buffer.width!==w||buffer.height!==h){buffer=document.createElement('canvas');buffer.width=w;buffer.height=h;}
  const b=buffer.getContext('2d',{willReadFrequently:true});b.clearRect(0,0,w,h);
  try{b.drawImage(view,0,0,w,h);}catch{return null;}
  if(layer.chroma?.enabled){
    try{const pixels=b.getImageData(0,0,w,h);chromaPixels(pixels,layer.chroma);b.putImageData(pixels,0,0);}catch(e){console.warn('Chroma',e);}
  }
  if(layer.mask&&layer.mask!=='rect'){
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;
    const m=mask.getContext('2d');
    m.fillStyle='#fff';m.beginPath();
    if(layer.mask==='circle'||layer.mask==='soft')m.ellipse(w/2,h/2,w*.49,h*.49,0,0,Math.PI*2);
    else if(layer.mask==='polygon'&&(layer.points?.length||0)>=3){
      for(let i=0;i<layer.points.length;i++){const p=layer.points[i];i===0?m.moveTo(p.x*w,p.y*h):m.lineTo(p.x*w,p.y*h);}m.closePath();
    }else m.rect(0,0,w,h);
    // A soft mask is an actual alpha mask, not a decorative gradient.
    const feather=Math.min(40,Math.max(0,Number(layer.feather)||((layer.mask==='soft')?0.12:0))*Math.min(w,h));
    if(feather>0)m.filter=`blur(${feather}px)`;
    m.fill();m.filter='none';
    b.save();b.globalCompositeOperation='destination-in';b.drawImage(mask,0,0);b.restore();
  }
  if(asset.type==='image')layerBuffers.set(layer.id,{signature,canvas:buffer});
  else layerBuffers.delete(layer.id);
  return buffer;
}
function effectivePosition(layer,props){
  const followed=trackingPosition(layer.tracking,state.current);
  if(!followed||!layer.tracking?.anchor)return props;
  return {...props,x:props.x+(followed.x-layer.tracking.anchor.x),y:props.y+(followed.y-layer.tracking.anchor.y)};
}
function renderLayers(){
  const W=canvas.width,H=canvas.height;
  for(const layer of state.project.overlays||[]){
    const local=state.current-layer.start;if(local<0||local>layer.duration)continue;
    const asset=state.assets.get(layer.assetId);if(!asset)continue;
    let view=asset.image;
    if(asset.type==='video'){
      const v=makeOverlayVideo(asset);view=v;
      const target=clamp(local,0,asset.duration||local);
      if(v.readyState>=1&&Math.abs(v.currentTime-target)>.15)try{v.currentTime=target;}catch{}
      if(state.playing&&v.paused)v.play().catch(()=>{});
      if(!state.playing&&!v.paused)v.pause();
    }
    if(!view||(asset.type==='video'&&view.readyState<2))continue;
    const rendered=overlayImage(layer,view,asset);if(!rendered)continue;
    const props=effectivePosition(layer,keyframeValue(layer,local));
    const w=W*props.scale,h=w*rendered.height/rendered.width;
    if(!(w>0&&h>0))continue;
    ctx.save();ctx.globalAlpha=clamp(props.opacity,0,1);ctx.globalCompositeOperation=mix[layer.blend]||'source-over';
    ctx.translate(props.x*W,props.y*H);ctx.rotate(props.rotation*Math.PI/180);
    ctx.drawImage(rendered,-w/2,-h/2,w,h);ctx.restore();
  }
}
function renderAudioTimeline(d){
  let host=$('pro-audio-tracks');
  if(!host){host=document.createElement('div');host.id='pro-audio-tracks';host.className='pro-audio-tracks';$('music-track').after(host);}
  host.replaceChildren();
  for(const track of state.project.audioTracks||[]){
    const row=document.createElement('div');row.className='pro-audio-row';
    const b=document.createElement('button');b.className='pro-audio-pill';
    b.style.left=(track.start*zoom)+'px';b.style.width=Math.max(42,track.duration*zoom)+'px';
    b.textContent='♫ '+(state.assets.get(track.assetId)?.name||'audio').slice(0,16);
    b.classList.toggle('selected',track.id===selectedAudio);
    b.onclick=()=>{selectedAudio=track.id;showPanel('multiaudio');seek(track.start);};
    row.style.width=Math.max(100,d*zoom)+'px';
    const wave=document.createElement('canvas');wave.className='pro-waveform';wave.width=Math.max(40,Math.round(Math.min(650,track.duration*zoom)));wave.height=30;
    const peaks=waveformCache.get(track.assetId);if(peaks)drawPeaks(wave.getContext('2d'),peaks,wave.width,wave.height);
    b.append(wave);row.append(b);host.append(row);ensureWaveform(track.assetId);
  }
}
async function importAudioTracks(files){
  if(!state.project.clips.length)return toast('先に映像を追加してください');
  if(state.recording)return;
  for(const file of files){if(!file.type.startsWith('audio/'))continue;
    const id=newID();try{
      const asset=await buildAsset(id,file,'audio',file.name);
      if(window.__subehaSaveAsset)await window.__subehaSaveAsset(id,file,'audio',file.name);
      const start=state.current,duration=Math.min(asset.duration,Math.max(.1,totalTime()-start));
      const clip={id:newID(),assetId:id,start,duration,offset:0,volume:.75,muted:false,fadeIn:0,fadeOut:0};
      state.project.audioTracks ||= [];state.project.audioTracks.push(clip);selectedAudio=clip.id;
    }catch(e){console.error(e);toast('音声ファイルを読み込めませんでした');}
  }
  save();renderTimeline();showPanel('multiaudio');
}
function ensureWaveform(id){
  if(waveformCache.has(id)||waveformPending.has(id))return;
  const asset=state.assets.get(id);if(!asset?.blob||asset.type!=='audio')return;
  waveformPending.add(id);
  decodeWaveform(asset.blob).then(peaks=>{waveformCache.set(id,peaks);requestAnimationFrame(renderTimeline);})
    .catch(err=>{console.warn('Waveform unavailable',err.message);waveformCache.set(id,[]);})
    .finally(()=>waveformPending.delete(id));
}
function renderCaptionTimeline(d){
  let host=$('pro-caption-timeline');
  if(!host){host=document.createElement('div');host.id='pro-caption-timeline';host.className='pro-caption-timeline';$('text-track').after(host);}
  host.replaceChildren();const captions=state.project.captions||[];
  if(!captions.length){host.hidden=true;return;}host.hidden=false;
  const label=document.createElement('div');label.className='pro-caption-label';label.textContent='字幕 / '+captions.length+' cues';host.append(label);
  const row=document.createElement('div');row.className='pro-caption-row';row.style.width=Math.max(100,d*zoom)+'px';
  let visibleCount=0;for(const cue of captions){if(cue.start>d||cue.end<0)continue;if(++visibleCount>400)break;
    const b=document.createElement('button');b.className='pro-caption-pill';b.textContent=cue.text.replace(/\n/g,' / ').slice(0,25);b.title=cue.text;
    b.style.left=Math.max(0,cue.start*zoom)+'px';b.style.width=Math.max(28,(cue.end-cue.start)*zoom)+'px';
    b.classList.toggle('selected',selectedCue===cue.id);
    b.onclick=()=>{selectedCue=cue.id;seek(cue.start);showPanel('captions');renderCaptionTimeline(d);};row.append(b);
  }host.append(row);
}
async function importCaptions(file){
  if(state.recording)return toast('書き出し中は字幕を変更できません');
  if(file.size>4*1024*1024)return toast('字幕ファイルは4MBまでです');
  try{const text=await file.text(),cues=parseSubtitleFile(text,file.name,{offset:captionOffset});
    if(!cues.length)return toast('有効なタイムコードの字幕がありません');
    state.project.captions=[...(state.project.captions||[]),...cues].sort((a,b)=>a.start-b.start);
    state.project.captionEnabled=true;selectedCue=cues[0].id;save();renderTimeline();draw();showPanel('captions');
    toast(`${cues.length}件の字幕を読み込みました（時刻を保持）`);
  }catch(err){console.error(err);toast('字幕の読込失敗: '+err.message);}
}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function saveArchive(){
  if(state.recording)return toast('書き出し中は保存できません');
  const btn=$('pro-package-save');if(btn)btn.disabled=true;
  try{const archive=await createProjectArchive(state.project,state.assets);
    downloadBlob(archive,(state.project.name||'untitled').replace(/[\\/:*?"<>|]/g,'_')+'.subecut');
    toast('素材を含めた編集プロジェクトを保存しました');
  }catch(err){console.error(err);toast('保存失敗: '+err.message);}finally{if(btn)btn.disabled=false;}
}
async function restoreArchive(file){
  if(state.recording)return toast('書き出し中は復元できません');
  if(!confirm('読み込んだプロジェクトに切り替えますか？現在の編集内容は上書きされます。'))return;
  try{const {project,assets}=await readProjectArchive(file);
    // Validate the ZIP and its CRC before modifying the running project.
    const idMap=new Map(assets.map(a=>[a.id,newID()]));
    const loaded=JSON.parse(JSON.stringify(project));
    for(const clip of loaded.clips)clip.assetId=idMap.get(clip.assetId);
    for(const layer of loaded.overlays||[])layer.assetId=idMap.get(layer.assetId);
    for(const track of loaded.audioTracks||[])track.assetId=idMap.get(track.assetId);
    if(loaded.music)loaded.music.assetId=idMap.get(loaded.music.assetId);
    for(const a of assets){const id=idMap.get(a.id);await buildAsset(id,a.blob,a.type,a.name);await window.__subehaSaveAsset(id,a.blob,a.type,a.name);}
    api.loadProjectSnapshot(loaded);selectedOverlay=null;selectedAudio=null;selectedCue=null;
    for(const a of assets)if(a.type==='video')makeOverlayVideo(state.assets.get(idMap.get(a.id)));
    renderTimeline();audioEngine.sync();showPanel('project');toast('素材と編集情報を復元しました');
  }catch(err){console.error(err);toast('復元失敗: '+err.message);}
}
function renderTrackFrame(){
  const v=$('media-player');if(v.readyState<2||!v.videoWidth||!v.videoHeight)return null;
  const cw=trackCanvas.width,ch=trackCanvas.height;
  trackCtx.fillStyle='#000';trackCtx.fillRect(0,0,cw,ch);
  const ratio=state.project.fit==='contain'?Math.min(cw/v.videoWidth,ch/v.videoHeight):Math.max(cw/v.videoWidth,ch/v.videoHeight);
  const w=v.videoWidth*ratio,h=v.videoHeight*ratio;
  try{trackCtx.drawImage(v,(cw-w)/2,(ch-h)/2,w,h);}catch{return null;}
  return trackCtx.getImageData(0,0,cw,ch);
}
function updateTracking(){
  if(!trackingSession||!state.playing||state.recording)return;
  if(state.current-lastTrackingAt<.19)return;
  const layer=(state.project.overlays||[]).find(o=>o.id===trackingSession.layerId);
  const base=locate(state.project.clips,state.current);
  if(!layer||!base||base.clip.id!==trackingSession.baseClipId){finishTracking();return;}
  const frame=renderTrackFrame();if(!frame)return;
  const next=trackPoint(frame,trackingSession.point,{search:17,maxError:32});
  if(!next){finishTracking('追跡点を見失いました。特徴のある点を選び直してください');return;}
  trackingSession.point=next;lastTrackingAt=state.current;
  layer.tracking.points.push({time:state.current,x:next.x/trackCanvas.width,y:next.y/trackCanvas.height});
  if(layer.tracking.points.length>900){finishTracking('追跡点上限に達しました');return;}
  if(layer.tracking.points.length%15===0)save();
}
function finishTracking(message){if(trackingSession){trackingSession=null;save();if(message)toast(message);}}
function beginTracking(){
  if(!selectedLayer())return toast('先にレイヤーを選択してください');
  const base=locate(state.project.clips,state.current);
  if(!base||base.clip.type!=='video')return toast('追跡はベースの動画上で行います');
  editMode='tracking';closeDrawer();toast('プレビュー上の特徴のある点をタップしてください');
}
function beginPolygon(){
  const layer=selectedLayer();if(!layer)return;
  changeLayer(l=>{l.mask='polygon';l.points=[];});
  editMode='polygon';closeDrawer();toast('プレビューの輪郭を順番にタップ。3点以上で多角形になります');
}
function onCanvasPoint(event){
  if(!editMode)return;
  const layer=selectedLayer();if(!layer){editMode=null;return;}
  const r=canvas.getBoundingClientRect(),x=bound((event.clientX-r.left)/r.width,0,1),y=bound((event.clientY-r.top)/r.height,0,1);
  if(editMode==='tracking'){
    const base=locate(state.project.clips,state.current);
    const frame=renderTrackFrame();
    if(!frame||!base||base.clip.type!=='video'){toast('動画フレームの読み込み後に試してください');return;}
    const point=startPointTrack(frame,Math.round(x*trackCanvas.width),Math.round(y*trackCanvas.height),4);
    if(!point){toast('輪郭や模様のある点を指定してください');return;}
    finishTracking();
    layer.tracking={baseClipId:base.clip.id,anchor:{x,y},points:[{time:state.current,x,y}]};
    trackingSession={layerId:layer.id,baseClipId:base.clip.id,point};lastTrackingAt=state.current;
    editMode=null;save();toast('追跡開始。動画を再生すると追跡点が記録されます');
  }else if(editMode==='polygon'){
    const asset=state.assets.get(layer.assetId);if(!asset)return;
    const props=effectivePosition(layer,keyframeValue(layer,state.current-layer.start));
    const width=canvas.width*props.scale,height=width*(asset.height||1)/(asset.width||1);
    const dx=(x-props.x)*canvas.width,dy=(y-props.y)*canvas.height,rot=-props.rotation*Math.PI/180;
    const lx=dx*Math.cos(rot)-dy*Math.sin(rot),ly=dx*Math.sin(rot)+dy*Math.cos(rot);
    const u=bound(lx/width+.5,0,1),v=bound(ly/height+.5,0,1);
    layer.points.push({x:u,y:v});save();draw();
    if(layer.points.length>=3)toast('輪郭 '+layer.points.length+'点。終了は「オーバーレイ」→「輪郭確定」');
  }
}

function bindSliders(kind,params,onChange){
  for(const [key,min,max,step] of params){const el=$('pro-'+key);if(!el)continue;el.oninput=e=>{const n=Number(e.target.value);$('pro-'+key+'-value').textContent=(step===1?Math.round(n):n);onChange(key,n);};}
}
function captionList(cues){return '<div class="pro-cue-list">'+cues.slice(0,250).map(c=>'<button data-cue="'+safe(c.id)+'">'+c.start.toFixed(2)+'–'+c.end.toFixed(2)+'s　'+safe(c.text).slice(0,80)+'</button>').join('')+'</div>'+(cues.length>250?'<p class="pro-tip">一覧は先頭250件を表示。タイムラインでは全件利用できます。</p>':'');}
function showPanel(which){
  if(which==='captions'){
    const captions=state.project.captions||[],cue=captions.find(x=>x.id===selectedCue);
    if(!cue){
      panel('字幕 / Whisper・SRT・VTT','<p>文字起こし済みの字幕データを読み込み、時刻を維持してプレビューと書き出し映像へ合成します。端末内だけで処理します。</p><label class="pro-select">読み込み時の時刻オフセット（秒）<input type="number" id="pro-caption-offset" step="0.1" value="'+captionOffset+'"></label><div class="pro-inline"><button id="pro-caption-import" class="pro-primary">＋ 字幕ファイル</button><button id="pro-caption-export">SRTを書き出す</button><button id="pro-caption-clear" class="pro-danger">字幕を全削除</button></div><p class="pro-tip">合計 '+captions.length+'件。音声から自動認識する機能ではありません。WhisperのJSON、SRT、VTTを利用できます。</p>'+captionList(captions));
    }else{
      const style={...defaultCaptionStyle,...state.project.captionStyle};
      panel('字幕の編集','<div class="pro-inline"><button id="pro-caption-import">＋ 追加</button><button id="pro-caption-export">SRTを書き出す</button><button id="pro-caption-all">一覧</button></div><label class="pro-select">字幕テキスト<textarea id="pro-cue-text" maxlength="500" rows="3"></textarea></label><div class="pro-controls"><label>開始（秒）<input id="pro-cue-start" type="number" min="0" step=".01"></label><label>終了（秒）<input id="pro-cue-end" type="number" min="0" step=".01"></label>'+createControl('文字サイズ','pro-caption-size',16,90,1,style.size)+createControl('縦位置','pro-caption-y',.3,.95,.01,style.y)+'</div><label class="pro-select">文字色 <input type="color" id="pro-caption-color" value="'+style.color+'"></label><label class="pro-select"><input type="checkbox" id="pro-caption-background" '+(style.background?'checked':'')+'> 背景ボックス</label><label class="pro-select"><input type="checkbox" id="pro-caption-enabled" '+(state.project.captionEnabled!==false?'checked':'')+'> 字幕を映像に焼き込む</label><div class="pro-inline"><button id="pro-cue-delete" class="pro-danger">この字幕を削除</button><button id="pro-caption-clear" class="pro-danger">字幕を全削除</button></div>'+captionList(captions));
      $('pro-cue-text').value=cue.text;$('pro-cue-start').value=cue.start;$('pro-cue-end').value=cue.end;
      for(const [id,key,format] of [['pro-cue-text','text',v=>v],['pro-cue-start','start',Number],['pro-cue-end','end',Number]]){
        $(id).addEventListener('change',e=>{const val=format(e.target.value);if(key==='text')cue.text=val.slice(0,500);else if(Number.isFinite(val))cue[key]=Math.max(0,val);if(cue.end<=cue.start)cue.end=cue.start+.05;state.project.captions.sort((a,b)=>a.start-b.start);save();renderTimeline();draw();});
      }
      for(const [id,key] of [['pro-caption-size','size'],['pro-caption-y','y']])$(id).oninput=e=>{state.project.captionStyle={...style,...state.project.captionStyle,[key]:Number(e.target.value)};$(id+'-value').textContent=e.target.value;save();draw();};
      $('pro-caption-color').oninput=e=>{state.project.captionStyle={...state.project.captionStyle,color:e.target.value};save();draw();};
      $('pro-caption-background').onchange=e=>{state.project.captionStyle={...state.project.captionStyle,background:e.target.checked};save();draw();};
      $('pro-caption-enabled').onchange=e=>{state.project.captionEnabled=e.target.checked;save();draw();};
      $('pro-cue-delete').onclick=()=>{state.project.captions=captions.filter(c=>c.id!==cue.id);selectedCue=null;save();renderTimeline();draw();showPanel('captions');};
      $('pro-caption-all').onclick=()=>{selectedCue=null;showPanel('captions');};
    }
    const offsetField=$('pro-caption-offset');if(offsetField)offsetField.onchange=e=>{captionOffset=Number(e.target.value)||0;};
    $('pro-caption-import').onclick=()=>$('pro-caption-picker').click();
    $('pro-caption-export').onclick=()=>{if(!state.project.captions?.length)return toast('字幕がありません');downloadBlob(new Blob([exportSRT(state.project.captions)],{type:'text/plain;charset=utf-8'}),'subeha-captions.srt');};
    $('pro-caption-clear').onclick=()=>{if(!confirm('すべての字幕を削除しますか？'))return;state.project.captions=[];selectedCue=null;save();renderTimeline();draw();showPanel('captions');};
    $('pro-content').querySelectorAll('[data-cue]').forEach(b=>b.onclick=()=>{selectedCue=b.dataset.cue;const c=state.project.captions.find(x=>x.id===selectedCue);if(c)seek(c.start);showPanel('captions');});
  }else if(which==='project'){
    panel('素材ごと保存 / 復元','<p>動画・画像・音声と字幕・レイヤー・エフェクトをまとめた独立した編集プロジェクトを保存できます。</p><div class="pro-inline"><button class="pro-primary" id="pro-package-save">⇩ 素材を含めて保存（.subecut）</button><button id="pro-package-load">⇧ 保存したプロジェクトを開く</button></div><p class="pro-tip">保存形式は非圧縮ZIP。現在の端末の容量とメモリを守るため、合計200MB以内。インポート時はデータ破損を検査します。素材はサーバーに送信しません。従来の「編集情報JSON」とは異なり、別端末でも再編集できます。</p>');
    $('pro-package-save').onclick=saveArchive;$('pro-package-load').onclick=()=>$('pro-project-picker').click();
  }else if(which==='overlay'){

    const layer=selectedLayer();
    if(!layer){panel('オーバーレイ','<p>画像・動画を重ね、キーフレームや合成方法を設定できます。</p><button id="pro-import-layer" class="pro-primary">＋ 画像・動画レイヤー</button>');}
    else{
      const fields=[['x',0,1,.01],['y',0,1,.01],['scale',.1,1.9,.01],['opacity',0,1,.01],['rotation',-180,180,1],['duration',.2,180,.1],['start',0,180,.1]];
      panel('レイヤーを編集','<button id="pro-import-layer" class="pro-primary">＋ レイヤーを追加</button><div class="pro-controls">'+fields.map(([k,a,b,c])=>createControl(k,'pro-'+k,a,b,c,layer[k])).join('')+'</div><label class="pro-select">合成 <select id="pro-blend">'+Object.keys(mix).map(k=>'<option value="'+k+'" '+(layer.blend===k?'selected':'')+'>'+k+'</option>').join('')+'</select></label><label class="pro-select">マスク <select id="pro-mask"><option value="rect">通常</option><option value="circle">円形</option><option value="soft">柔らかい円</option><option value="polygon">多角形</option></select></label><div class="pro-controls">'+createControl('境界ぼかし','pro-feather',0,.25,.005,layer.feather??0)+'</div><div class="pro-inline"><button id="pro-polygon">✎ 輪郭を描く</button><button id="pro-finish-polygon">輪郭確定</button><button id="pro-keyframe">◆ この位置をキーフレーム登録</button><button id="pro-remove-layer" class="pro-danger">レイヤー削除</button></div><p class="pro-tip">キーフレーム数: '+(layer.keyframes?.length||0)+' / レイヤーを選ぶと時間軸に表示</p>');
      $('pro-mask').value=layer.mask||'rect';$('pro-feather').oninput=e=>{const n=Number(e.target.value);$('pro-feather-value').textContent=n;changeLayer(l=>l.feather=n);};$('pro-polygon').onclick=beginPolygon;$('pro-finish-polygon').onclick=()=>{editMode=null;toast('多角形を確定しました');showPanel('overlay');};$('pro-blend').onchange=e=>changeLayer(l=>l.blend=e.target.value);$('pro-mask').onchange=e=>changeLayer(l=>l.mask=e.target.value);
      bindSliders('overlay',fields,(k,n)=>changeLayer(l=>l[k]=n));
      $('pro-keyframe').onclick=()=>changeLayer(l=>{let t=clamp(state.current-l.start,0,l.duration);l.keyframes ||= [];l.keyframes=l.keyframes.filter(f=>Math.abs(f.time-t)>.04);l.keyframes.push({time:t,x:l.x,y:l.y,scale:l.scale,opacity:l.opacity,rotation:l.rotation});toast('◆ キーフレームを登録しました');});
      $('pro-remove-layer').onclick=()=>{state.project.overlays=state.project.overlays.filter(l=>l.id!==layer.id);selectedOverlay=null;save();renderTimeline();showPanel('overlay');draw();};
    }
    $('pro-import-layer').onclick=()=>$('pro-overlay-picker').click();
  }else if(which==='chroma'){
    const l=selectedLayer();if(!l){panel('クロマキー','<p>先にオーバーレイから動画・画像レイヤーを選択してください。</p>');return;}
    const cfg=l.chroma||{enabled:false,color:'#00ff00',similarity:.23,softness:.12,spill:.4};
    panel('クロマキー / 背景色の除去','<label class="pro-select"><input type="checkbox" id="pro-key-enable" '+(cfg.enabled?'checked':'')+'> クロマキーを有効にする</label><label class="pro-select">消す色 <input id="pro-key-color" type="color" value="'+(cfg.color||'#00ff00')+'"></label><div class="pro-controls">'+[
      ['similarity',0,.8,.01],['softness',.005,.5,.005],['spill',0,1,.05]
    ].map(([k,a,b,step])=>createControl(k,'pro-key-'+k,a,b,step,cfg[k]??0)).join('')+'</div><p class="pro-tip">グリーンバック・ブルーバック等の単色背景向け。被写体と背景が似た色の場合、輪郭が欠けます。</p>');
    const update=(k,val)=>changeLayer(layer=>{layer.chroma={enabled:false,color:'#00ff00',similarity:.23,softness:.12,spill:.4,...layer.chroma,[k]:val};layerBuffers.delete(layer.id);});
    $('pro-key-enable').onchange=e=>update('enabled',e.target.checked);
    $('pro-key-color').oninput=e=>update('color',e.target.value);
    for(const k of ['similarity','softness','spill'])$('pro-key-'+k).oninput=e=>{const val=Number(e.target.value);$('pro-key-'+k+'-value').textContent=val;update(k,val);};
  }else if(which==='tracking'){
    const l=selectedLayer();if(!l){panel('簡易ポイント追跡','<p>追従させるレイヤーを先に選択してください。</p>');return;}
    panel('簡易ポイント追跡','<p>ベース動画の模様・角などをタップして再生すると、その点の動きをレイヤーへ適用します。</p><div class="pro-inline"><button id="pro-begin-track" class="pro-primary">⊙ 追跡点を選択</button><button id="pro-end-track">追跡終了</button><button id="pro-clear-track" class="pro-danger">軌跡を削除</button></div><p class="pro-tip">記録点: '+(l.tracking?.points?.length||0)+'。パン・平行移動向けの軽量ブロック照合。遮蔽、回転、激しい動きには弱く、AI人物認識ではありません。</p>');
    $('pro-begin-track').onclick=beginTracking;
    $('pro-end-track').onclick=()=>{finishTracking('追跡を終了しました');showPanel('tracking');};
    $('pro-clear-track').onclick=()=>{finishTracking();changeLayer(x=>delete x.tracking);showPanel('tracking');};
  }else if(which==='multiaudio'){
    const tracks=state.project.audioTracks||[],selected=tracks.find(t=>t.id===selectedAudio);
    if(!selected){panel('マルチトラック音声','<p>音声・効果音をいくつでも追加し、位置・音量・フェードを個別に設定します。</p><button class="pro-primary" id="pro-add-audio">＋ 音声を追加</button><div class="pro-audio-list">'+tracks.map(t=>'<button data-audio="'+t.id+'">♫ '+safe(state.assets.get(t.assetId)?.name||'音声')+'</button>').join('')+'</div>');}
    else{
      const asset=state.assets.get(selected.assetId),length=asset?.duration||selected.duration;
      const fields=[['start',0,Math.max(1,totalTime()),.1],['offset',0,Math.max(0,length-.1),.1],['duration',.1,Math.max(.1,length),.1],['volume',0,1,.01],['fadeIn',0,10,.1],['fadeOut',0,10,.1]];
      panel('音声 · '+safe(asset?.name||'AUDIO'),'<button class="pro-primary" id="pro-add-audio">＋ トラック追加</button><div class="pro-controls">'+fields.map(([k,a,b,step])=>createControl(k,'pro-audio-'+k,a,b,step,selected[k]||0)).join('')+'</div><label class="pro-select"><input id="pro-audio-muted" type="checkbox" '+(selected.muted?'checked':'')+'> ミュート</label><div class="pro-inline"><button id="pro-audio-remove" class="pro-danger">この音声を削除</button><button id="pro-audio-unselect">トラック一覧</button></div><div class="pro-audio-list">'+tracks.map(t=>'<button data-audio="'+t.id+'">♫ '+safe(state.assets.get(t.assetId)?.name||'音声')+'</button>').join('')+'</div>');
      for(const [k] of fields){$('pro-audio-'+k).oninput=e=>{const n=Number(e.target.value);selected[k]=n;
        selected.offset=Math.min(selected.offset,Math.max(0,length-.1));selected.duration=Math.min(selected.duration,Math.max(.1,length-selected.offset));
        $('pro-audio-'+k+'-value').textContent=n;save();renderTimeline();audioEngine.sync();};}
      $('pro-audio-muted').onchange=e=>{selected.muted=e.target.checked;save();audioEngine.sync();};
      $('pro-audio-remove').onclick=()=>{state.project.audioTracks=tracks.filter(t=>t.id!==selected.id);selectedAudio=null;save();renderTimeline();showPanel('multiaudio');audioEngine.sync();};
      $('pro-audio-unselect').onclick=()=>{selectedAudio=null;showPanel('multiaudio');};
    }
    $('pro-add-audio').onclick=()=>$('pro-audio-picker').click();
    document.querySelectorAll('[data-audio]').forEach(b=>b.onclick=()=>{selectedAudio=b.dataset.audio;showPanel('multiaudio');});
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
    panel('映像効果','<p>Videoleap系の編集操作を参考にした独立実装。フィルター・色調整・反転・合成を組み合わせられます。</p><div class="pro-effect-list"><button data-fx="glitch">GLITCH</button><button data-fx="dream">DREAM</button><button data-fx="mono">MONO</button><button data-fx="cinema">CINEMA</button><button data-fx="vintage">VINTAGE</button><button data-fx="none">ORIGINAL</button></div><p class="pro-tip">背景色除去・簡易ポイント追跡は下部の専用ツールへ。生成AI・人物セグメンテーションは未搭載。</p>');
    $('pro-content').querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>{if(!selectedClip())return toast('クリップを選択してください');updateClip(c=>c.filter=b.dataset.fx);});
  }
}
function changeLayer(fn){const layer=selectedLayer();if(!layer||state.recording)return;fn(layer);layerBuffers.delete(layer.id);save();renderTimeline();draw();}
function mount(){
  state.project.overlays ||= [];state.project.audioTracks ||= [];state.project.captions ||= [];
  installChrome();
  canvas.addEventListener('pointerdown',onCanvasPoint);
  for(const layer of state.project.overlays){const a=state.assets.get(layer.assetId);if(a?.type==='video')makeOverlayVideo(a);}
  renderHooks.push(renderLayers);
  renderHooks.push(({ctx,canvas,state})=>drawCaptions(ctx,canvas,state.project,state.current));
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
  function frame(){renderPlayhead();audioEngine.sync();updateTracking();requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
if(window.__subehaCut && state.project) { if(document.readyState==='loading')window.addEventListener('subeha-cut-ready',mount,{once:true});else if(state.assets.size||document.readyState==='complete')mount();else window.addEventListener('subeha-cut-ready',mount,{once:true});}
