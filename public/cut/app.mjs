import {RATIOS,clipLength,duration,locate,splitAt,clampTime,formatClock,safeName,newID} from './timeline.mjs';
import {advanceTimeline} from './export-timing.mjs';

const $ = (id) => document.getElementById(id);
const canvas=$('preview'),ctx=canvas.getContext('2d',{alpha:false});
const media=$('media-player'),bgm=$('bgm-player');
const picker=$('file-picker'),musicPicker=$('music-picker');
const filters={none:{label:'ORIGINAL',style:'none'},mono:{label:'MONO',style:'grayscale(1) contrast(1.12)'},cinema:{label:'CINEMA',style:'contrast(1.15) saturate(.88) sepia(.15)'},vintage:{label:'VINTAGE',style:'sepia(.68) saturate(.7) contrast(1.06)'},dream:{label:'DREAM',style:'blur(1.2px) saturate(1.65) contrast(1.10)'},cold:{label:'COLD',style:'hue-rotate(160deg) saturate(.7) contrast(1.12)'},punch:{label:'PUNCH',style:'contrast(1.32) saturate(1.5)'},glitch:{label:'GLITCH',style:'contrast(1.2) saturate(1.6)'}};
const state={project:{name:'UNTITLED 01',ratio:'9:16',fit:'cover',clips:[],texts:[],music:null,audioTracks:[]},assets:new Map(),selectedClip:null,selectedText:null,activeClip:null,current:0,playing:false,recording:false,panel:'clips',lastFrame:0,switching:false,pendingSave:null,recorder:null,wakeLock:null};
let db=null, audioCtx=null, mixer=null, videoNode=null, musicNode=null, toastTimer=null, drawPending=false, renderToken=0, raf=0;
const renderHooks=[];
const history={undo:[],redo:[],current:null};

function toast(message){const box=$('snackbar');box.textContent=message;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),3200);}
function fail(error){console.error(error);toast(error?.message||String(error));}
function openDB(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('IndexedDB非対応'));const req=indexedDB.open('subeha-cut-assets',1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('files'))d.createObjectStore('files');if(!d.objectStoreNames.contains('projects'))d.createObjectStore('projects');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function idbPut(store,key,value){if(!db)return Promise.resolve();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
function idbGet(store,key){if(!db)return Promise.resolve(null);return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);});}
function idbDelete(store,key){if(!db)return Promise.resolve();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
function save(){const snap=JSON.stringify(state.project);if(history.current!==null && snap!==history.current){history.undo.push(history.current);if(history.undo.length>60)history.undo.shift();history.redo=[];}history.current=snap;window.dispatchEvent(new Event('subeha-cut-change'));clearTimeout(state.pendingSave);state.pendingSave=setTimeout(async()=>{try{await idbPut('projects','current',state.project);}catch(e){toast('保存容量不足。大きい素材を減らしてください。');console.warn(e);}},300);}
const fileObjects=[];
function videoProbe(url){return new Promise((resolve,reject)=>{const v=document.createElement('video');v.preload='metadata';v.muted=true;v.onloadedmetadata=()=>{resolve({duration:Number.isFinite(v.duration)&&v.duration>0?v.duration:0,width:v.videoWidth,height:v.videoHeight});v.removeAttribute('src');v.load();};v.onerror=()=>reject(new Error('動画を開けませんでした。形式をご確認ください'));v.src=url;});}
function audioProbe(url){return new Promise((resolve,reject)=>{const a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>{resolve({duration:Number.isFinite(a.duration)?a.duration:0});a.removeAttribute('src');a.load();};a.onerror=()=>reject(new Error('音声を読み込めませんでした'));a.src=url;});}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('画像を読み込めませんでした'));img.src=url;});}
async function makeThumb(asset){
 try{
   const c=document.createElement('canvas');c.width=180;c.height=108;const q=c.getContext('2d');
   if(asset.type==='image'){const img=asset.image||await loadImage(asset.url);asset.image=img;q.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.7);}
   const v=document.createElement('video');v.muted=true;v.preload='auto';v.playsInline=true;v.src=asset.url;
   await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=rej;});
   const time=Math.min(0.4,Math.max(0,v.duration/3));
   v.currentTime=time;
   await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;res();};v.addEventListener('seeked',finish,{once:true});setTimeout(finish,1300);});
   if(v.readyState>=2)q.drawImage(v,0,0,c.width,c.height);
   v.removeAttribute('src');v.load();return c.toDataURL('image/jpeg',.68);
 }catch(e){console.warn('thumbnail',e);return null;}
}
async function buildAsset(id,blob,type,name,quiet=false){
 if(state.assets.has(id))return state.assets.get(id);
 const url=URL.createObjectURL(blob);fileObjects.push(url);
 const asset={id,blob,url,type,name,duration:5,width:0,height:0,image:null,thumb:null};
 if(type==='image'){
   const img=await loadImage(url);asset.image=img;asset.width=img.naturalWidth;asset.height=img.naturalHeight;
 }else if(type==='video'){
   const meta=await videoProbe(url);asset.duration=meta.duration;asset.width=meta.width;asset.height=meta.height;
 }else if(type==='audio'){
   const meta=await audioProbe(url);asset.duration=meta.duration;
 }
 state.assets.set(id,asset);
 if(type!=='audio')makeThumb(asset).then(v=>{asset.thumb=v;refreshTimeline();});
 return asset;
}
async function importFiles(files,music=false){
 if(state.recording){toast('書き出し中は素材を追加できません');return;}
 let imported=0;
 for(const file of files){
   const type=file.type.startsWith('video/')?'video':file.type.startsWith('image/')?'image':file.type.startsWith('audio/')?'audio':null;
   if(!type || (music && type!=='audio') ||(!music&&type==='audio'))continue;
   const id=newID();
   try{
     const asset=await buildAsset(id,file,type,file.name);
     try{await idbPut('files',id,{blob:file,type,name:file.name});}
     catch(e){console.warn('quota',e);toast('容量不足：素材はこの画面内のみ保持されます');}
     if(music){state.project.music={assetId:id,volume:.6};bgm.pause();bgm.src=asset.url;bgm.loop=true;bgm.load();}
     else {if(asset.duration<=0){toast(`${file.name}: 再生時間を取得できません`);continue;}
       const clip={id:newID(),assetId:id,name:file.name,type,start:0,end:asset.duration,speed:1,filter:'none'};
       state.project.clips.push(clip);state.selectedClip=clip.id;
     }
     imported++;
   }catch(e){fail(e);}
 }
 save();refreshAll();await positionMedia();
 if(imported)toast(`${imported}件の素材を追加しました`);
}
async function restore(){
 try{
   db=await openDB(); const project=await idbGet('projects','current');
   if(project?.clips && Array.isArray(project.clips)){
     state.project={name:project.name||'UNTITLED 01',ratio:RATIOS[project.ratio]?project.ratio:'9:16',fit:project.fit==='contain'?'contain':'cover',clips:[],texts:Array.isArray(project.texts)?project.texts:[],overlays:Array.isArray(project.overlays)?project.overlays:[],music:project.music||null,audioTracks:Array.isArray(project.audioTracks)?project.audioTracks:[],captions:Array.isArray(project.captions)?project.captions:[],captionStyle:project.captionStyle||null,captionEnabled:project.captionEnabled!==false};
     const ids=new Set([...project.clips.map(c=>c.assetId),...(project.music?[project.music.assetId]:[]),...(project.overlays||[]).map(o=>o.assetId),...(project.audioTracks||[]).map(o=>o.assetId)]);
     for(const id of ids){try{const item=await idbGet('files',id);if(item?.blob)await buildAsset(id,item.blob,item.type,item.name);}catch(e){console.warn('restore file',id,e);}}
     state.project.clips=project.clips.filter(c=>state.assets.has(c.assetId));state.project.overlays=state.project.overlays.filter(o=>state.assets.has(o.assetId));state.project.audioTracks=state.project.audioTracks.filter(o=>state.assets.has(o.assetId));
     if(project.music&&!state.assets.has(project.music.assetId))state.project.music=null;
     if(state.project.music){bgm.src=state.assets.get(state.project.music.assetId).url;bgm.load();}
     state.selectedClip=state.project.clips[0]?.id||null;
   }
 }catch(e){console.warn('Project storage unavailable',e);toast('この環境では自動保存できません');}
 history.undo=[];history.redo=[];history.current=JSON.stringify(state.project);refreshAll();await positionMedia();
}
function selectedClip(){return state.project.clips.find(c=>c.id===state.selectedClip)||null;}
function selectedText(){return state.project.texts.find(t=>t.id===state.selectedText)||null;}
function assetOf(c){return c?state.assets.get(c.assetId):null;}
function setRatio(ratio){state.project.ratio=ratio;[canvas.width,canvas.height]=RATIOS[ratio];$('ratio-button').textContent=ratio+' ▾';save();draw();}
function setPanel(panel){state.panel=panel;document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===panel));document.querySelectorAll('.tool-panel').forEach(n=>{n.hidden=n.dataset.panel!==panel;});$('tool-hint').textContent=({clips:'クリップを編集',look:'色彩・質感を編集',text:'文字を重ねる',audio:'音楽を追加',export:'作品を書き出す'})[panel];refreshPanels();}
function refreshTimeline(){
 const track=$('clip-track');track.replaceChildren();
 if(state.project.clips.length===0){const m=document.createElement('div');m.className='track-placeholder';m.textContent='＋ クリップを読み込むとここに表示';track.append(m);}
 for(const c of state.project.clips){const a=assetOf(c);const btn=document.createElement('button');btn.className='clip-card'+(state.selectedClip===c.id?' selected':'');btn.title=c.name;const image=a?.thumb?document.createElement('img'):document.createElement('span');if(a?.thumb){image.src=a.thumb;image.alt='';}else image.className='no-thumb';const caption=document.createElement('span');caption.className='clip-card-name';caption.textContent=c.name;const time=document.createElement('span');time.className='clip-card-length';time.textContent=formatClock(clipLength(c));btn.append(image,caption,time);btn.addEventListener('click',()=>{state.selectedClip=c.id;refreshAll();setPanel('clips');const loc=timelineOffset(c.id);seek(loc);});track.append(btn);}
 const m=state.project.music;$('music-track').querySelector('span').textContent=m?(state.assets.get(m.assetId)?.name||'AUDIO'):'音声トラックなし';
 $('text-track').querySelector('span').textContent=state.project.texts.length?`${state.project.texts.length} テキストレイヤー`:'字幕・テキストなし';
}
function timelineOffset(id){let t=0;for(const c of state.project.clips){if(c.id===id)break;t+=clipLength(c);}return t;}
function refreshPanels(){
 const c=selectedClip();$('clip-unselected').hidden=!!c;$('clip-editor').hidden=!c;
 if(c){const a=assetOf(c);$('selected-title').textContent=c.name;$('selected-duration').textContent=formatClock(clipLength(c));
 for(const [el,value,max] of [['trim-in',c.start,a?.duration||c.end],['trim-out',c.end,a?.duration||c.end]]){const i=$(el);i.min=0;i.max=max;i.value=value;i.step=.01;}
 $('in-label').textContent=Number(c.start).toFixed(2)+'s';$('out-label').textContent=Number(c.end).toFixed(2)+'s';
 document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===c.speed));
 }
 const f=c?.filter||'none';document.querySelectorAll('.filter-card').forEach(n=>n.classList.toggle('active',n.dataset.filter===f));
 const t=selectedText();$('text-editor').hidden=!t;
 if(t){$('text-content').value=t.text;$('text-size').value=t.size;$('text-length').value=t.duration;$('text-x').value=t.x;$('text-y').value=t.y;$('text-color').value=t.color;for(const [label,v] of [['text-size-label',t.size+'px'],['text-length-label',t.duration+'s'],['text-x-label',Math.round(t.x*100)+'%'],['text-y-label',Math.round(t.y*100)+'%']])$(label).textContent=v;}
 $('music-controls').hidden=!state.project.music;if(state.project.music){$('music-name').textContent=assetOf(state.project.music)?.name||state.assets.get(state.project.music.assetId)?.name;$('music-volume').value=state.project.music.volume;$('music-volume-label').textContent=Math.round(state.project.music.volume*100)+'%';}
 $('text-list').replaceChildren();for(const text of state.project.texts){const b=document.createElement('button');b.textContent=text.text||'(空のテキスト)';b.classList.toggle('active',text.id===state.selectedText);b.addEventListener('click',()=>{state.selectedText=text.id;refreshPanels();seek(text.start);});$('text-list').append(b);}
}
function refreshAll(){
 const d=duration(state.project.clips);window.dispatchEvent(new Event('subeha-cut-change'));$('project-label').textContent=state.project.name+' / EDIT 01';$('empty-overlay').hidden=state.project.clips.length>0;
 $('scrubber').max=String(d);$('scrubber').value=String(Math.min(state.current,d));$('ruler-right').textContent=formatClock(d);
 $('ratio-button').textContent=state.project.ratio+' ▾';$('preview-fit').textContent=state.project.fit==='cover'?'FILL':'FIT';
 refreshTimeline();refreshPanels();updateTimecode();draw();
}
function updateTimecode(){const d=duration(state.project.clips);$('timecode').innerHTML=`${formatClock(state.current)} <span>/ ${formatClock(d)}</span>`;$('scrubber').value=String(Math.min(state.current,d));$('play').textContent=state.playing?'Ⅱ':'▶';$('viewer-status').textContent=state.recording?'● REC':state.playing?'PLAYING':'READY';}
function clipVideo(url){if(media.dataset.asseturl===url)return;media.pause();media.dataset.asseturl=url;media.src=url;media.load();}
async function positionMedia(){
 const at=locate(state.project.clips,state.current);if(!at){media.pause();state.activeClip=null;draw();return;}
 const c=at.clip,a=assetOf(c);if(!a)return;
 if(state.activeClip!==c.id){
   const token=++renderToken;state.activeClip=c.id;
   if(a.type==='video'){
     clipVideo(a.url);
     if(media.readyState<1)await new Promise(res=>{const done=()=>res();media.addEventListener('loadedmetadata',done,{once:true});media.addEventListener('error',done,{once:true});setTimeout(done,1600);});
     if(token!==renderToken)return;
     media.playbackRate=c.speed;
     if(Number.isFinite(at.mediaTime))try{media.currentTime=at.mediaTime;}catch{}
     if(state.playing)media.play().catch(()=>{if(!state.recording)toast('再生を開始できませんでした。もう一度タップしてください。');});
   }else{media.pause();}
 }else if(a.type==='video'){
   media.playbackRate=c.speed;
   if(Number.isFinite(media.currentTime)&&Math.abs(media.currentTime-at.mediaTime)>.35){try{media.currentTime=at.mediaTime;}catch{}}
   if(state.playing&&media.paused)media.play().catch(()=>{if(!state.recording)toast('動画の再生を開始できませんでした');});
   else if(!state.playing)media.pause();
 }
 draw();
}
function drawFrameWithAspect(image,w,h){
 const W=canvas.width,H=canvas.height,srcW=w||W,srcH=h||H;
 if(!srcW||!srcH)return;
 const scale=state.project.fit==='contain'?Math.min(W/srcW,H/srcH):Math.max(W/srcW,H/srcH);
 const dw=srcW*scale,dh=srcH*scale;
 ctx.drawImage(image,(W-dw)/2,(H-dh)/2,dw,dh);
}
function wrapText(text,maxWidth,size){const lines=[];for(const para of String(text).split('\n')){let line='';for(const char of para){if(ctx.measureText(line+char).width>maxWidth && line){lines.push(line);line=char;}else line+=char;}lines.push(line);}return lines.slice(0,10);}
function draw(){
 const W=canvas.width,H=canvas.height;
 ctx.fillStyle='#07080b';ctx.fillRect(0,0,W,H);
 const at=locate(state.project.clips,state.current);
 if(!at){ctx.strokeStyle='#514c46';ctx.lineWidth=3;ctx.strokeRect(W*.35,H*.3,W*.3,H*.4);return;}
 const c=at.clip,a=assetOf(c);
 if(a){
   const view=a.type==='image'?a.image:media;
   const ready=(a.type==='image'&&a.image)||(a.type==='video'&&state.activeClip===c.id&&media.readyState>=2);
   if(ready){
     ctx.save();const fade=state.playing?Math.min(1,at.local/.16,(at.length-at.local)/.16):1;ctx.globalAlpha=Math.max(0,fade);
     const adj=c.adjust||{};ctx.filter=[filters[c.filter]?.style||'none','brightness('+((adj.brightness??100)/100)+')','contrast('+((adj.contrast??100)/100)+')','saturate('+((adj.saturation??100)/100)+')','hue-rotate('+(adj.hue??0)+'deg)','blur('+(adj.blur??0)+'px)'].join(' ');ctx.globalAlpha*=c.opacity??1;if(c.rotation||c.flipX||c.flipY||c.zoom){ctx.translate(W/2,H/2);ctx.rotate((c.rotation||0)*Math.PI/180);ctx.scale((c.flipX?-1:1)*(c.zoom||1),(c.flipY?-1:1)*(c.zoom||1));ctx.translate(-W/2,-H/2);}
     try{drawFrameWithAspect(view,a.type==='image'?a.width:media.videoWidth,a.type==='image'?a.height:media.videoHeight);}catch(e){console.warn('draw',e);}
     ctx.restore();
     if(c.filter==='glitch'&&at.length>0){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.18;ctx.filter='hue-rotate(150deg)';ctx.translate(Math.sin(state.current*18)*10,0);try{drawFrameWithAspect(view,a.type==='image'?a.width:media.videoWidth,a.type==='image'?a.height:media.videoHeight);}catch{}ctx.restore();}
   }
 }
 for(const hook of renderHooks){try{hook({canvas,ctx,state});}catch(e){console.warn('render hook',e);}}
 for(const t of state.project.texts){if(state.current<t.start||state.current>t.start+t.duration||!t.text)continue;
   ctx.save();const age=Math.max(0,state.current-t.start),left=Math.max(0,t.duration-age);let textAlpha=1,textScale=1;if(t.motion==='fade'){textAlpha=Math.min(1,age/.28,left/.28);}else if(t.motion==='pop'){textScale=1+Math.max(0,.28-age)*.75;}else if(t.motion==='slide'){ctx.translate(0,Math.max(0,.4-age)*H*.18);}ctx.globalAlpha=Math.max(0,Math.min(1,textAlpha));ctx.translate(W*t.x,H*t.y);ctx.scale(textScale,textScale);ctx.translate(-W*t.x,-H*t.y);ctx.textAlign='center';ctx.textBaseline='middle';const unit=W/720;const size=t.size*unit;ctx.font=`800 ${size}px system-ui,sans-serif`;ctx.fillStyle=t.color;ctx.strokeStyle='#000';ctx.lineWidth=Math.max(2,size*.12);ctx.lineJoin='round';ctx.shadowColor='#000b';ctx.shadowBlur=14*unit;
   const lines=wrapText(t.text,W*.88,size),lineHeight=size*1.23;
   for(let i=0;i<lines.length;i++){const y=H*t.y+(i-(lines.length-1)/2)*lineHeight;ctx.strokeText(lines[i],W*t.x,y);ctx.fillText(lines[i],W*t.x,y);}
   ctx.restore();}
}
function seek(value){state.current=clampTime(value,state.project.clips);state.lastFrame=performance.now();positionMedia().catch(fail);syncMusic();updateTimecode();}
function syncMusic(){const m=state.project.music,a=m&&state.assets.get(m.assetId);if(!a)return;
 bgm.volume=audioCtx?1:m.volume;
 if(musicNode)musicNode.gain.value=m.volume;
 const want=a.duration>0?state.current%a.duration:0;
 if(Number.isFinite(want)&&Math.abs((bgm.currentTime||0)-want)>.4){try{bgm.currentTime=want;}catch{}}
 if(state.playing&&bgm.paused)bgm.play().catch(()=>{});
 if(!state.playing&&!bgm.paused)bgm.pause();
}
function audioReady(){
 if(audioCtx)return;
 const AudioContext=window.AudioContext||window.webkitAudioContext;
 if(!AudioContext)return;
 audioCtx=new AudioContext();mixer=audioCtx.createMediaStreamDestination();
 try{const source=audioCtx.createMediaElementSource(media);source.connect(audioCtx.destination);source.connect(mixer);videoNode=source;}catch(e){console.warn('video audio route',e);}
 try{const source=audioCtx.createMediaElementSource(bgm),gain=audioCtx.createGain();source.connect(gain);gain.connect(audioCtx.destination);gain.connect(mixer);musicNode=gain;}catch(e){console.warn('bgm audio route',e);}
}
async function play(){
 if(state.recording && state.playing)return;
 if(!state.project.clips.length){picker.click();return;}
 if(state.playing){state.playing=false;media.pause();bgm.pause();updateTimecode();return;}
 if(state.current>=duration(state.project.clips)-.02)state.current=0;
 audioReady();if(audioCtx)await audioCtx.resume().catch(()=>{});
 state.playing=true;state.lastFrame=performance.now();await positionMedia();syncMusic();updateTimecode();
}
function animationLoop(timestamp){
 const lastFrame=state.lastFrame||timestamp;state.lastFrame=timestamp;
 if(state.playing){
   state.current=advanceTimeline({current:state.current,lastTimestamp:lastFrame,timestamp,anchor:state.exportClockStart,recording:state.recording,duration:duration(state.project.clips)});
   if(state.current>=duration(state.project.clips)){
     state.current=duration(state.project.clips);state.playing=false;media.pause();bgm.pause();
     if(state.recording&&state.recorder?.state!=='inactive')setTimeout(()=>state.recorder?.state==='recording'&&state.recorder.stop(),100);
   }else{
     const at=locate(state.project.clips,state.current);
     if(at && state.activeClip!==at.clip.id)positionMedia().catch(fail);
   }
   draw();updateTimecode();
   if(state.recording){const ratio=Math.min(1,state.current/Math.max(0.1,duration(state.project.clips)));$('progress-bar').style.width=Math.round(ratio*100)+'%';$('progress-text').textContent='書き出し中 '+Math.round(ratio*100)+'%';}
 }
 raf=requestAnimationFrame(animationLoop);
}
async function exportMovie(){
 if(state.recording)return;
 const d=duration(state.project.clips);
 if(!d){toast('先に動画または画像を取り込んでください');return;}
 if(d>180){toast('試作版は180秒以内の書き出しを推奨します');return;}
 if(typeof MediaRecorder==='undefined'||!canvas.captureStream){toast('このブラウザは動画書き出しに非対応です');return;}
 const types=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4','video/webm;codecs=vp8,opus','video/webm'];
 const type=types.find(t=>MediaRecorder.isTypeSupported(t));if(!type){toast('対応するエンコード形式がありません');return;}
 try{
   state.recording=true;$('export-progress').hidden=false;$('export-progress').scrollIntoView({block:'nearest',behavior:'smooth'});$('export-open').disabled=true;$('export-secondary').disabled=true;
   if(state.playing){state.playing=false;media.pause();bgm.pause();}
   seek(0);await positionMedia();draw();audioReady();if(audioCtx)await audioCtx.resume();
   const stream=canvas.captureStream(30);
   if(mixer){for(const track of mixer.stream.getAudioTracks())stream.addTrack(track);}
   const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:4500000,audioBitsPerSecond:128000});state.recorder=recorder;
   const chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=e=>{console.error(e);toast('書き出しでエラーが発生しました');};
   recorder.onstop=()=>{
     try{if(!chunks.length)throw Error('出力データが空です');
       const actualType=recorder.mimeType||type,ext=actualType.startsWith('video/mp4')?'mp4':'webm';
       const blob=new Blob(chunks,{type:actualType});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=safeName(state.project.name)+'-'+new Date().toISOString().slice(0,10)+'.'+ext;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
       toast(`${ext.toUpperCase()}を書き出しました（${(blob.size/1024/1024).toFixed(1)}MB）`);
     }catch(e){fail(e);}finally{state.recording=false;state.exportClockStart=null;state.recorder=null;$('export-open').disabled=false;$('export-secondary').disabled=false;$('export-progress').hidden=true;for(const track of stream.getTracks())track.stop();state.wakeLock?.release().catch(()=>{});}
   };
   recorder.start(500);state.current=0;state.playing=true;state.exportClockStart=performance.now();state.lastFrame=state.exportClockStart;await positionMedia();syncMusic();
   if(navigator.wakeLock?.request)state.wakeLock=await navigator.wakeLock.request('screen').catch(()=>null);
   toast('録画方式で書き出し中。画面を閉じないでください');setPanel('export');
 }catch(e){state.recording=false;state.exportClockStart=null;state.recorder=null;$('export-open').disabled=false;$('export-secondary').disabled=false;$('export-progress').hidden=true;fail(e);}
}
function exportProject(){const blob=new Blob([JSON.stringify({...state.project,note:'編集メタデータのみ。動画・画像・音声ファイルは含まれません。'},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=safeName(state.project.name)+'-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('編集情報JSONを書き出しました（素材は含みません）');}
function updateClip(fn){const c=selectedClip();if(!c||state.recording)return;fn(c);state.current=clampTime(state.current,state.project.clips);save();refreshAll();positionMedia().catch(fail);}
function changeText(fn){const t=selectedText();if(!t)return;fn(t);save();refreshPanels();draw();refreshTimeline();}
function bind(){
 for(const event of ['loadeddata','seeked','canplay','timeupdate'])media.addEventListener(event,()=>{if(!state.playing)draw();});
 $('import-empty').addEventListener('click',()=>picker.click());$('add-media-small').addEventListener('click',()=>picker.click());
 picker.addEventListener('change',async()=>{await importFiles([...picker.files]);picker.value='';});
 $('add-music-small').addEventListener('click',()=>musicPicker.click());$('music-add').addEventListener('click',()=>musicPicker.click());
 musicPicker.addEventListener('change',async()=>{await importFiles([...musicPicker.files],true);musicPicker.value='';});
 $('play').addEventListener('click',()=>play().catch(fail));$('back-start').addEventListener('click',()=>seek(0));$('skip-forward').addEventListener('click',()=>seek(state.current+1));
 $('scrubber').addEventListener('input',e=>seek(Number(e.target.value)));
 $('ratio-button').addEventListener('click',()=>{const all=Object.keys(RATIOS);setRatio(all[(all.indexOf(state.project.ratio)+1)%all.length]);});
 $('preview-fit').addEventListener('click',()=>{state.project.fit=state.project.fit==='cover'?'contain':'cover';save();refreshAll();});
 document.querySelectorAll('.nav-tab').forEach(b=>b.addEventListener('click',()=>setPanel(b.dataset.tab)));
 for(const [id,which] of [['trim-in','start'],['trim-out','end']])$(id).addEventListener('input',e=>updateClip(c=>{const v=Number(e.target.value);if(which==='start')c.start=Math.min(v,c.end-.1);else c.end=Math.max(v,c.start+.1);const max=assetOf(c)?.duration||c.end;c.end=Math.min(c.end,max);}));
 document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>updateClip(c=>c.speed=Number(b.dataset.speed))));
 $('split-clip').addEventListener('click',()=>{if(state.recording)return;const result=splitAt(state.project.clips,state.current);if(!result){toast('分割位置をクリップ内に移動してください');return;}state.project.clips=result.clips;state.selectedClip=result.second.id;state.activeClip=null;save();refreshAll();positionMedia().catch(fail);toast('クリップを分割しました');});
 $('dup-clip').addEventListener('click',()=>{const c=selectedClip();if(!c)return;const i=state.project.clips.indexOf(c);const copy={...c,id:newID()};state.project.clips.splice(i+1,0,copy);state.selectedClip=copy.id;save();refreshAll();});
 const move=dir=>{const c=selectedClip(),arr=state.project.clips;if(!c)return;const i=arr.indexOf(c),j=i+dir;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];save();refreshAll();};
 $('move-left').addEventListener('click',()=>move(-1));$('move-right').addEventListener('click',()=>move(1));
 $('delete-clip').addEventListener('click',()=>{const i=state.project.clips.findIndex(c=>c.id===state.selectedClip);if(i<0)return;state.project.clips.splice(i,1);state.selectedClip=state.project.clips[Math.max(0,i-1)]?.id||null;state.activeClip=null;seek(0);save();refreshAll();});
 const box=$('filters');for(const [id,f] of Object.entries(filters)){const b=document.createElement('button');b.className='filter-card';b.dataset.filter=id;b.innerHTML='<span class="filter-swatch"></span><span></span>';b.lastElementChild.textContent=f.label;b.addEventListener('click',()=>{if(!selectedClip()){toast('クリップを先に選んでください');return;}updateClip(c=>c.filter=id);});box.append(b);}
 $('filter-clear').addEventListener('click',()=>updateClip(c=>c.filter='none'));
 const addText=()=>{const t={id:newID(),text:'ここに言葉を',start:state.current,duration:3,size:62,x:.5,y:.76,color:'#ffffff'};state.project.texts.push(t);state.selectedText=t.id;save();setPanel('text');refreshAll();};
 $('add-text-small').addEventListener('click',addText);$('text-add').addEventListener('click',addText);
 for(const [id,key,transform] of [['text-content','text',String],['text-size','size',Number],['text-length','duration',Number],['text-x','x',Number],['text-y','y',Number],['text-color','color',String]])$(id).addEventListener('input',e=>changeText(t=>t[key]=transform(e.target.value)));
 $('delete-text').addEventListener('click',()=>{state.project.texts=state.project.texts.filter(t=>t.id!==state.selectedText);state.selectedText=null;save();refreshAll();});
 $('music-volume').addEventListener('input',e=>{if(!state.project.music)return;state.project.music.volume=Number(e.target.value);syncMusic();save();refreshPanels();});
 $('music-remove').addEventListener('click',()=>{bgm.pause();bgm.removeAttribute('src');bgm.load();state.project.music=null;save();refreshAll();});
 $('export-open').addEventListener('click',()=>{setPanel('export');document.querySelector('.tools-shell').scrollIntoView({behavior:'smooth'});});
 $('export-secondary').addEventListener('click',exportMovie);$('backup-project').addEventListener('click',exportProject);$('project-save').addEventListener('click',exportProject);
 $('new-project').addEventListener('click',async()=>{if(!confirm('新規プロジェクトを開始しますか？ 現在の編集内容は上書きされます。'))return;state.playing=false;media.pause();bgm.pause();state.project={name:'UNTITLED '+String(Math.floor(Math.random()*90+10)),ratio:'9:16',fit:'cover',clips:[],texts:[],overlays:[],music:null,audioTracks:[],captions:[],captionStyle:null,captionEnabled:true};state.selectedClip=null;state.selectedText=null;state.activeClip=null;state.current=0;setRatio('9:16');save();refreshAll();});
 window.addEventListener('pagehide',()=>{if(state.recording)console.warn('Export interrupted by pagehide');});
}

function loadProjectSnapshot(snapshot){
 if(state.recording)throw Error('書き出し中は復元できません');
 const p=JSON.parse(JSON.stringify(snapshot));
 if(!Array.isArray(p.clips)||p.clips.some(c=>!state.assets.has(c.assetId)))throw Error('読み込む動画素材が不足しています');
 for(const name of ['overlays','audioTracks','texts','captions'])p[name]=Array.isArray(p[name])?p[name]:[];
 for(const row of [...p.overlays,...p.audioTracks])if(!state.assets.has(row.assetId))throw Error('レイヤー素材が不足しています');
 if(p.music&&!state.assets.has(p.music.assetId))throw Error('BGM素材が不足しています');
 state.playing=false;media.pause();bgm.pause();
 state.project=p;state.selectedClip=p.clips[0]?.id||null;state.selectedText=null;state.activeClip=null;state.current=0;
 if(p.music){bgm.src=state.assets.get(p.music.assetId).url;bgm.load();}else{bgm.removeAttribute('src');bgm.load();}
 setRatio(RATIOS[p.ratio]?p.ratio:'9:16');save();refreshAll();seek(0);
}
function applyHistory(snapshot){state.playing=false;media.pause();bgm.pause();state.project=JSON.parse(snapshot);state.selectedClip=state.project.clips[0]?.id||null;state.selectedText=null;state.activeClip=null;state.current=0;state.project.overlays ||= [];state.project.audioTracks ||= [];if(state.project.music&&state.assets.has(state.project.music.assetId)){bgm.src=state.assets.get(state.project.music.assetId).url;bgm.load();}else {bgm.removeAttribute('src');bgm.load();}refreshAll();positionMedia().catch(fail);save();}
function undo(){if(!history.undo.length)return toast('戻す操作がありません');history.redo.push(history.current);history.current=history.undo.pop();applyHistory(history.current);}
function redo(){if(!history.redo.length)return toast('やり直す操作がありません');history.undo.push(history.current);history.current=history.redo.pop();applyHistory(history.current);}
window.__subehaSaveAsset=async(id,file,type,name)=>idbPut('files',id,{blob:file,type,name});
window.__subehaCut={state,canvas,ctx,buildAsset,seek,save,refreshAll,refreshTimeline,draw,selectedClip,updateClip,setPanel,renderHooks,toast,newID,assetOf,undo,redo,getAudioGraph:()=>{audioReady();return {audioCtx,mixer};},loadProjectSnapshot};
async function init(){bind();setRatio('9:16');setPanel('clips');try{if('serviceWorker'in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))await navigator.serviceWorker.register('./sw.js');}catch(e){console.warn('Service worker',e);}await restore();window.dispatchEvent(new Event('subeha-cut-ready'));requestAnimationFrame(animationLoop);}
init().catch(fail);
