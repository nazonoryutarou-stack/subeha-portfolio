/* v0.8 mobile editor controls and shared per-frame Canvas2D processing. */
import {normalizedRetouch,retouchFrame,retouchPosition,sampleFrameColor} from './video-retouch.mjs';
const $=id=>document.getElementById(id);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,Number(x)||0));
const blank=()=>({mode:'matte',enabled:true,color:'#00ff00',tolerance:42,feather:2,x:.5,y:.5,source:{x:.7,y:.5},radius:.06,quality:512,start:0,end:7200,keyframes:[]});

export function mountVideoRetouchStudio(api,{panel,closeDrawer}={}){
 const {state,canvas,selectedClip,save,draw,toast}=api;
 const nav=document.querySelector('.bottomnav');
 const button=document.createElement('button');button.className='nav-tab pro-nav';button.type='button';
 button.innerHTML='<span>◭</span>動画修復';button.setAttribute('aria-label','動画背景切り抜き・動画修復');
 nav.append(button);
 const outputs=new Map();
 // This renders source frames before the base canvas transform, and is shared by
 // preview and the MediaRecorder export because both call app.renderBaseClip().
 api.sourceFrameHooks.push(({clip,view,asset,local})=>{
  const cfg=normalizedRetouch(clip.videoRetouch);
  if(!cfg||!cfg.enabled||local<cfg.start||local>cfg.end)return null;
  const sw=asset.width||view.videoWidth||view.naturalWidth||view.width;
  const sh=asset.height||view.videoHeight||view.naturalHeight||view.height;
  if(!sw||!sh)return null;
  const size=cfg.quality,scale=Math.min(1,size/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));
  let frame=outputs.get(clip.id);
  if(!frame||frame.raw.width!==w||frame.raw.height!==h){
   const raw=document.createElement('canvas'),rendered=document.createElement('canvas');
   raw.width=rendered.width=w;raw.height=rendered.height=h;
   frame={raw,rendered,rawCtx:raw.getContext('2d',{willReadFrequently:true}),outputCtx:rendered.getContext('2d')};outputs.set(clip.id,frame);
  }
  try{
   frame.rawCtx.clearRect(0,0,w,h);frame.rawCtx.drawImage(view,0,0,w,h);
   const original=frame.rawCtx.getImageData(0,0,w,h),result=retouchFrame(original,cfg,local);
   if(result.changed){frame.outputCtx.putImageData(new ImageData(result.image.data,w,h),0,0);return {source:frame.rendered,width:w,height:h};}
  }catch(err){console.warn('Video retouch frame',err);}
  return null;
 });
 let editor=null;
 function targetRows(){
  const bases=state.project.clips.map(c=>({kind:'base',entity:c,asset:state.assets.get(c.assetId)}));
  const overlays=(state.project.overlays||[]).map(layer=>({kind:'overlay',entity:layer,asset:state.assets.get(layer.assetId)}));
  return [...bases,...overlays].filter(row=>row.asset&&['video','image'].includes(row.asset.type));
 }
 function active(targetId){
  const rows=targetRows();const selected=rows.find(r=>r.entity.id===targetId)||rows.find(r=>r.kind==='base'&&r.entity.id===selectedClip()?.id)||rows[0];
  if(!selected)throw Error('先に動画または写真を追加してください');
  return {...selected,id:selected.entity.id};
 }
 function commit(cfg){
  if(state.recording){toast('書き出し中は変更できません');return false;}
  if(!editor)return false;
  const row=targetRows().find(r=>r.entity.id===editor.id&&r.kind===editor.kind);
  if(!row){toast('選択した素材がありません');return false;}
  row.entity.videoRetouch=normalizedRetouch(cfg);outputs.delete(row.entity.id);save();draw();
  return true;
 }
 function sourceTime(row){
  if(row.kind==='overlay'){
   const local=clamp(state.current-row.entity.start,0,row.entity.duration||0);
   return {local,time:Math.max(0,local)};
  }
  const clip=row.entity,sp=api.spans(state.project.clips).find(s=>s.clip.id===clip.id),local=clamp(state.current-(sp?.start||0),0,sp?.length||0);
  const t=clip.reverse?clip.end-local*(clip.speed||1):clip.start+local*(clip.speed||1);
  return {time:Math.max(0,t),local};
 }
 async function captureFrame(e){
  const {asset}=e,frameCanvas=e.raw;
  const width=asset.width||asset.image?.naturalWidth||1,height=asset.height||asset.image?.naturalHeight||1;
  const factor=Math.min(1,512/Math.max(width,height));
  frameCanvas.width=Math.max(2,Math.round(width*factor));frameCanvas.height=Math.max(2,Math.round(height*factor));
  const g=frameCanvas.getContext('2d',{willReadFrequently:true});
  if(asset.type==='image'){g.drawImage(asset.image,0,0,frameCanvas.width,frameCanvas.height);return true;}
  const video=e.video || document.createElement('video');e.video=video;
  video.muted=true;video.playsInline=true;video.preload='auto';
  if(video.dataset.mediaId!==asset.id){video.dataset.mediaId=asset.id;video.src=asset.url;video.load();}
  if(video.readyState<1)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('動画の読み込みがタイムアウトしました')),10000);video.addEventListener('loadedmetadata',()=>{clearTimeout(timer);resolve();},{once:true});video.addEventListener('error',()=>{clearTimeout(timer);reject(Error('動画フレームを開けません'))},{once:true});});
  const at=clamp(sourceTime(e).time,0,Math.max(.01,(video.duration||0)-.04));
  if(Math.abs(video.currentTime-at)>.05){await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('動画のシークに失敗しました'))},9000);
   const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};
   const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('動画の再生形式が非対応です'));};
   video.addEventListener('seeked',done,{once:true});video.addEventListener('error',fail,{once:true});
   try{video.currentTime=at;}catch(x){cleanup();reject(x);}
  });}
  if(video.readyState<2)await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{cleanup();reject(Error('動画フレームが取得できません'))},9000);
   const cleanup=()=>{clearTimeout(timer);video.removeEventListener('loadeddata',done);video.removeEventListener('error',fail);};
   const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('動画の再生形式が非対応です'));};
   video.addEventListener('loadeddata',done,{once:true});video.addEventListener('error',fail,{once:true});
  });
  if(video.readyState<2)throw Error('映像フレームを読み取れません');
  g.drawImage(video,0,0,frameCanvas.width,frameCanvas.height);return true;
 }
 function openStudio(targetId){
  let source;try{source=active(targetId);}catch(e){panel('動画修復','<p>'+e.message+'</p>');return;}
  const cfg=normalizedRetouch(source.entity.videoRetouch)||normalizedRetouch(blank());
  const targets=targetRows().map(row=>'<option value="'+row.entity.id+'" '+(row.entity.id===source.id?'selected':'')+'>'+ (row.kind==='base'?'V1':'レイヤー')+' / '+String(row.asset.name||'素材').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))+'</option>').join('');
  const content=`<label class="pro-select">加工対象 <select id="vr-target">${targets}</select></label><p class="pro-tip">
画面の縁に続く単色背景を抜く、または周辺画素のコピーで不要物を覆います。<b>人物認識AIではありません</b>。プレビューと書き出しに同じ加工を適用します。</p>
   <div class="pro-inline"><button id="vr-matte" class="pro-primary">背景を抜く</button><button id="vr-clone">部分修復</button><button id="vr-refresh">↻ 現在時刻を取得</button></div>
   <div id="vr-preview-box"><canvas id="vr-preview" aria-label="動画修復プレビュー。位置をタップして指定"></canvas></div>
   <p id="vr-status" class="pro-tip" aria-live="polite">背景の色をタップしてください。</p>
   <label class="pro-select"><input type="checkbox" id="vr-enabled" ${cfg.enabled?'checked':''}> 有効</label>
   <label class="pro-select">背景色 <input type="color" id="vr-color" value="${cfg.color}"></label>
   <div class="pro-controls">
    <label class="pro-slider">色の許容差 <output id="vr-tolerance-value">${cfg.tolerance}</output><input type="range" id="vr-tolerance" min="2" max="120" value="${cfg.tolerance}"></label>
    <label class="pro-slider">境界ぼかし <output id="vr-feather-value">${cfg.feather}</output><input type="range" id="vr-feather" min="0" max="6" value="${cfg.feather}"></label>
    <label class="pro-slider">修復ブラシ幅 <output id="vr-radius-value">${Math.round(cfg.radius*100)}%</output><input type="range" id="vr-radius" min="1" max="35" value="${Math.round(cfg.radius*100)}"></label>
    <label class="pro-slider">計算解像度 <select id="vr-quality"><option value="360">軽量360</option><option value="512">標準512</option><option value="720">高品質720</option></select></label>
    <label class="pro-slider">開始（クリップ秒） <input id="vr-start" type="number" min="0" max="7200" step="0.1" value="${cfg.start}"></label>
    <label class="pro-slider">終了（クリップ秒） <input id="vr-end" type="number" min="0" max="7200" step="0.1" value="${cfg.end}"></label>
   </div>
   <div class="pro-inline"><button id="vr-keyframe">◆ この位置を修復の追従キーに保存</button><button id="vr-reset" class="pro-danger">このクリップの修復を解除</button></div>
   <p class="pro-tip">修復キー: <span id="vr-keycount">${cfg.keyframes.length}</span>点。動画が動く場合は別の時刻へ移動して、対象位置を指定してからキーを登録。逆再生でもクリップ内の再生時刻を使います。元動画は変更しません。</p>`;
  panel('動画修復 / 背景切り抜き',content);
  nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));
  $('vr-quality').value=cfg.quality;
  const raw=document.createElement('canvas'),preview=$('vr-preview');
  editor={...source,config:cfg,raw,preview,video:null,stage:0};
  $("vr-target").onchange=e=>openStudio(e.target.value);
  const status=(s)=>{$('vr-status').textContent=s;};
  async function refreshSource(){try{await captureFrame(editor);render();status('位置を指定。背景消去は背景色をタップ。修復は対象→コピー元の順にタップ。');}catch(err){status('フレーム取得失敗: '+err.message);}}
  function render(){if(!editor||!raw.width)return;
   const {width:w,height:h}=raw;preview.width=w;preview.height=h;
   const original=raw.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),local=sourceTime(source).local;
   const result=retouchFrame(original,editor.config,local);
   const out=preview.getContext('2d');out.clearRect(0,0,w,h);
   // Checkerboard for transparent matte pixels.
   for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){out.fillStyle=(Math.floor(x/16)+Math.floor(y/16))%2?'#43444b':'#242630';out.fillRect(x,y,16,16);}
   const temp=document.createElement('canvas');temp.width=w;temp.height=h;temp.getContext('2d').putImageData(new ImageData(result.image.data,w,h),0,0);out.drawImage(temp,0,0);
   if(editor.config.mode==='clone'){
    const p=retouchPosition(editor.config,local)||editor.config;
    for(const [q,color] of [[p,'#ff3658'],[editor.config.source,'#42fbb7']]){
     out.strokeStyle=color;out.lineWidth=2;out.beginPath();out.arc(q.x*w,q.y*h,Math.max(4,editor.config.radius*w*(q===p?1:.35)),0,Math.PI*2);out.stroke();
    }
   }
  }
  function setConfig(delta){editor.config=normalizedRetouch({...editor.config,...delta});commit(editor.config);render();}
  function switchMode(mode,commitChange=true){editor.stage=0;if(commitChange)setConfig({mode});$('vr-matte').classList.toggle('pro-primary',mode==='matte');$('vr-clone').classList.toggle('pro-primary',mode==='clone');status(mode==='matte'?'抜きたい背景の色をタップ':'消したい位置をタップ→次にコピー元の位置をタップ');}
  preview.addEventListener('pointerdown',evt=>{
   const r=preview.getBoundingClientRect(),x=clamp((evt.clientX-r.left)/r.width,0,1),y=clamp((evt.clientY-r.top)/r.height,0,1);
   if(editor.config.mode==='matte'){const rawData=raw.getContext('2d').getImageData(0,0,raw.width,raw.height);const color=sampleFrameColor(rawData,x,y);$('vr-color').value=color;setConfig({color});status('背景色 '+color+' を指定しました。');}
   else if(editor.stage!==1){setConfig({x,y});editor.stage=1;status('次にコピー元（残したい背景）をタップしてください');}
   else{setConfig({source:{x,y}});editor.stage=0;status('対象とコピー元を指定しました。キーフレームで位置を動かせます');}
  });
  $('vr-matte').onclick=()=>switchMode('matte');$('vr-clone').onclick=()=>switchMode('clone');$('vr-refresh').onclick=refreshSource;
  $('vr-enabled').onchange=e=>setConfig({enabled:e.target.checked});$('vr-color').oninput=e=>setConfig({color:e.target.value});
  for(const key of ['tolerance','feather','radius'])$("vr-"+key).oninput=e=>{const value=Number(e.target.value);setConfig({[key]:key==='radius'?value/100:value});$('vr-'+key+'-value').textContent=key==='radius'?value+'%':value;};
  $('vr-quality').onchange=e=>setConfig({quality:Number(e.target.value)});
  for(const key of ['start','end'])$("vr-"+key).onchange=e=>setConfig({[key]:Number(e.target.value)});
  $('vr-keyframe').onclick=()=>{const local=sourceTime(source).local,p={time:local,x:editor.config.x,y:editor.config.y};const keys=editor.config.keyframes.filter(k=>Math.abs(k.time-local)>.04);keys.push(p);setConfig({keyframes:keys});$('vr-keycount').textContent=String(keys.length);status('◆ '+local.toFixed(2)+'秒に対象位置を保存');};
  $('vr-reset').onclick=()=>{const c=targetRows().find(r=>r.entity.id===editor.id&&r.kind===editor.kind)?.entity;if(!c)return;delete c.videoRetouch;save();draw();outputs.delete(c.id);status('修復を解除しました');closeDrawer?.();};
  switchMode(cfg.mode,false);refreshSource();
 }
 button.onclick=()=>openStudio();
 return {openStudio};
}
