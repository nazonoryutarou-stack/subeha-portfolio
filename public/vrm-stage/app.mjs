import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';
import {EXPRESSIONS, SHOT_DEFAULT, POSE_BONES, POSE_PRESETS, normalizePose, presetPose, normalizeShots, newShot, splitShot, moveCut, removeShot, findShot, computeEnvelope, amplitudeAt, clamp, projectJSON} from './shots.mjs';

const $=id=>document.getElementById(id);
const audio=$('audio'),stage=$('viewport');
const status=msg=>{$('status').textContent=msg;};
const stamp=t=>{const s=Math.max(0,Number(t)||0);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')+'.'+String(Math.floor(s%1*100)).padStart(2,'0');};
const saveBlob=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000);};
let renderer=null,scene,camera,vrm=null,baseRotations={},bounds={minY:0,height:1.7};
let duration=20,shots=normalizeShots([],20),selectedId=shots[0].id,previewTime=0;
let modelName='',audioName='',audioUrl=null,playingSilent=false,lastFrame=performance.now(),lastShotId='',mouthLevel=0;
let audioContext=null,audioSource=null,audioAnalyser=null,audioDestination=null,envelope=[],levelData=null;
let recording=null,recordingStream=null,recordingChunks=[],recordingExtension='';
let cameraYaw=0,cameraPitch=0,cameraTurn=0,backgroundColor='#1c1b24',sourceModel='';
let poseBone='head',supportedExpressions=[],lastStatusModel='';
const compiler=()=>new GLTFLoader().register(parser=>new VRMLoaderPlugin(parser));
function init3D(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x1c1b24);
 camera=new THREE.PerspectiveCamera(35,1,.03,200);
 const ambient=new THREE.HemisphereLight(0xe9edff,0x494456,2.1);scene.add(ambient);
 const key=new THREE.DirectionalLight(0xffffff,2.25);key.position.set(2.2,4.4,3.4);scene.add(key);
 const rim=new THREE.DirectionalLight(0xb9a9ff,1.25);rim.position.set(-3,3,-2);scene.add(rim);
 renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0x191a20);renderer.domElement.setAttribute('aria-label','VRMキャラクターの3Dプレビュー');
 stage.append(renderer.domElement);configureRatio();
 let drag=null;
 renderer.domElement.addEventListener('pointerdown',e=>{
  if(recording)return;drag={x:e.clientX,y:e.clientY,yaw:cameraYaw,pitch:cameraPitch};
  renderer.domElement.setPointerCapture(e.pointerId);
 });
 renderer.domElement.addEventListener('pointermove',e=>{
  if(!drag||recording)return;
  cameraYaw=clamp(drag.yaw+(e.clientX-drag.x)/260,-3.14,3.14);
  cameraPitch=clamp(drag.pitch-(e.clientY-drag.y)/300,-1.1,1.1);
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,()=>drag=null);
 requestAnimationFrame(frame);
}
function configureRatio(){
 if(!renderer)return;
 const ratio=$('ratio').value;
 const [w,h]=ratio==='16:9'?[960,540]:ratio==='1:1'?[720,720]:[540,960];
 renderer.setSize(w,h,false);renderer.domElement.style.width='auto';renderer.domElement.style.height='auto';renderer.domElement.style.maxWidth='100%';renderer.domElement.style.maxHeight='100%';
 camera.aspect=w/h;camera.updateProjectionMatrix();
}
function getNode(name){return vrm?.humanoid?.getNormalizedBoneNode(name)||null;}
function loadPoseBones(){
 baseRotations={};
 for(const [name] of POSE_BONES){
  const node=getNode(name);if(node)baseRotations[name]=node.quaternion.clone();
 }
}
async function loadModel(file){
 if(!file)return;
 if(file.size>75*1024*1024){status('VRMの上限は75MBです。');return;}
 return loadModelBytes(await file.arrayBuffer(),file.name,'local');
}
async function loadModelBytes(bytes,name,origin='local'){
 if(!renderer){status('WebGLが起動していません。');return false;}
 status('VRMを解析しています…');
 try{
  const gltf=await compiler().parseAsync(bytes,'');
  const loaded=gltf.userData.vrm;
  if(!loaded)throw Error('VRM拡張情報がありません。VRM 0.x/1.0形式を選んでください。');
  if(vrm){scene.remove(vrm.scene);vrm.scene.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();});}
  vrm=loaded;
  try{VRMUtils.removeUnnecessaryVertices(gltf.scene);}catch(e){console.warn('VRM optimization skipped',e);}
  vrm.scene.traverse(obj=>{obj.frustumCulled=false;});
  scene.add(vrm.scene);
  const box=new THREE.Box3().setFromObject(vrm.scene),height=box.getSize(new THREE.Vector3()).y;
  bounds={minY:Number.isFinite(box.min.y)?box.min.y:0,height:Number.isFinite(height)&&height>.2?height:1.7};
  loadPoseBones();modelName=name;sourceModel=origin;lastStatusModel=name;
  const mgr=vrm.expressionManager;
  supportedExpressions=Object.keys(mgr?.expressionMap||{});
  $('view-hint').hidden=true;refreshAssetNames();renderPoseControls();renderModelInfo();
  status(name+' を読み込みました。関節・表情・カット演出を調整できます。');return true;
 }catch(e){console.error(e);status('VRMの読み込みに失敗: '+(e?.message||e));return false;}
}
async function loadBuiltIn(){
 const button=$('load-subeha');button.disabled=true;
 status('GitHubのSubeha.vrm（19.55MB）を読み込んでいます…');
 try{
  const url=new URL('../models/Subeha.vrm',import.meta.url);
  const response=await fetch(url,{cache:'default'});
  if(!response.ok)throw Error('公開ファイルを取得できません（HTTP '+response.status+'）。Pages反映状況を確認してください。');
  const size=Number(response.headers.get('content-length'))||0;
  if(size>75*1024*1024)throw Error('ファイルサイズが75MBを超えています');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<1000000||bytes.byteLength>75*1024*1024)throw Error('VRMファイルのサイズが異常です');
  await loadModelBytes(bytes,'Subeha.vrm','built-in');
 }catch(e){console.error(e);status('Subeha.vrmの取得に失敗: '+(e?.message||e));}
 finally{button.disabled=false;}
}
async function ensureAudioGraph(){
 if(!audio.src)return;
 if(audioContext){if(audioContext.state==='suspended')await audioContext.resume();return;}
 try{
  audioContext=new (window.AudioContext||window.webkitAudioContext)();
  audioSource=audioContext.createMediaElementSource(audio);
  audioAnalyser=audioContext.createAnalyser();audioAnalyser.fftSize=1024;
  levelData=new Uint8Array(audioAnalyser.fftSize);
  audioDestination=audioContext.createMediaStreamDestination();
  audioSource.connect(audioAnalyser);
  audioAnalyser.connect(audioContext.destination);
  audioAnalyser.connect(audioDestination);
  await audioContext.resume();
 }catch(e){
  console.warn('Audio graph unavailable',e);
  status('音声解析の初期化に失敗: '+(e?.message||e));
 }
}
function liveAmplitude(){
 if(!audioAnalyser||audio.paused)return 0;
 audioAnalyser.getByteTimeDomainData(levelData);
 let sum=0;for(let i=0;i<levelData.length;i+=2){const x=(levelData[i]-128)/128;sum+=x*x;}
 return clamp((Math.sqrt(sum/(levelData.length/2))-.012)*7,0,1);
}
async function loadAudio(file){
 if(!file)return;
 if(audioUrl)URL.revokeObjectURL(audioUrl);
 audio.pause();audioUrl=URL.createObjectURL(file);audio.src=audioUrl;audio.load();audioName=file.name;envelope=[];
 status('音声を読み込んでいます…');
 audio.onloadedmetadata=()=>{if(Number.isFinite(audio.duration)&&audio.duration>.1){
  duration=Math.min(7200,audio.duration);shots=normalizeShots(shots,duration);
  previewTime=0;audio.currentTime=0;$('seek').max=duration;renderShots();renderSelection();renderClock();
  status('音声 '+stamp(duration)+' を読み込みました。再生時に口が音量に連動します。');
 }};
 refreshAssetNames();
 if(file.size<35*1024*1024){
  try{
   const context=new (window.AudioContext||window.webkitAudioContext)();
   const buffer=await context.decodeAudioData(await file.arrayBuffer());
   if(buffer.duration<=1200)envelope=computeEnvelope(buffer.getChannelData(0),buffer.sampleRate);
   await context.close();
  }catch(e){console.warn('Precomputed waveform unavailable',e);}
 }
}
function refreshAssetNames(){$('asset-names').textContent=(modelName||'VRMなし')+' / '+(audioName||'音声なし');}
function setTime(t){
 previewTime=clamp(t,0,duration);
 if(audio.src&&audio.readyState>=1)try{audio.currentTime=previewTime;}catch{}
 $('seek').value=String(previewTime);renderClock();
}
function stopPlayback(){
 playingSilent=false;audio.pause();$('play').textContent='▶';
}
async function togglePlay(){
 if(recording)return;
 if(!audio.paused||playingSilent){stopPlayback();return;}
 if(previewTime>=duration-.04)setTime(0);
 if(audio.src){
  await ensureAudioGraph();
  try{await audio.play();$('play').textContent='Ⅱ';}
  catch(e){status('再生できません: '+e.message);}
 }else{playingSilent=true;$('play').textContent='Ⅱ';}
}
function currentTime(){return audio.src&&audio.readyState>0?audio.currentTime:previewTime;}
function renderClock(){
 const t=currentTime();$('clock').textContent=stamp(t)+' / '+stamp(duration);
 $('seek').value=String(t);
 for(const btn of $('shot-timeline').children){
  const shot=shots.find(s=>s.id===btn.dataset.id);
  if(!shot)continue;
  btn.classList.toggle('is-playing',t>=shot.start&&t<shot.end);
  const progress=btn.querySelector('i');if(progress)progress.style.width=(clamp((t-shot.start)/(shot.end-shot.start),0,1)*100).toFixed(1)+'%';
 }
}
function selectShot(id,{seek=true}={}){
 const shot=shots.find(s=>s.id===id);if(!shot)return;
 selectedId=id;if(seek)setTime(shot.start);
 renderShots();renderSelection();
}
function selectedShot(){return shots.find(s=>s.id===selectedId)||shots[0];}
function renderShots(){
 const root=$('shot-timeline');root.replaceChildren();
 shots.forEach((shot,i)=>{
  const b=document.createElement('button');b.type='button';b.className='shot'+(selectedId===shot.id?' is-selected':'');
  b.dataset.id=shot.id;b.style.width=Math.min(240,Math.max(76,(shot.end-shot.start)/duration*480))+'px';
  const title=document.createElement('b');title.textContent='CUT '+String(i+1).padStart(2,'0');
  const caption=document.createElement('small');caption.textContent=shot.expression+' / '+shot.movement;
  const time=document.createElement('small');time.textContent=stamp(shot.start)+'–'+stamp(shot.end);
  b.append(title,caption,time,document.createElement('i'));b.onclick=()=>selectShot(shot.id);
  root.append(b);
 });
 renderClock();
}
function renderSelection(){
 const shot=selectedShot();if(!shot)return;
 const i=shots.indexOf(shot);
 $('shot-heading').textContent='カット '+(i+1);
 $('shot-range').textContent=stamp(shot.start)+' – '+stamp(shot.end);
 for(const key of ['expression','movement','camera','mouth','intensity','framing'])$(key).value=String(shot[key]);
 $('zoom').value=String(shot.zoom??1);$('zoom-value').textContent=Math.round((shot.zoom??1)*100)+'%';
 renderPoseControls();
 $('intensity-value').textContent=Math.round(shot.intensity*100)+'%';
 $('framing-value').textContent=shot.framing===0?'中央':shot.framing<0?'左 '+Math.round(-shot.framing*100)+'%':'右 '+Math.round(shot.framing*100)+'%';
 $('delete-shot').disabled=shots.length<=1;
 $('boundary-wrap').hidden=i===0;
 if(i>0){
  const boundary=$('boundary');boundary.min=(shots[i-1].start+.1).toFixed(2);
  boundary.max=(shot.end-.1).toFixed(2);
  boundary.value=String(shot.start);$('boundary-value').textContent=stamp(shot.start);
 }
}
function mutateShot(key,value){
 const shot=selectedShot();if(!shot)return;shot[key]=value;
 if(key==='intensity')$('intensity-value').textContent=Math.round(value*100)+'%';
 if(key==='framing')$('framing-value').textContent=value===0?'中央':value<0?'左 '+Math.round(-value*100)+'%':'右 '+Math.round(value*100)+'%';
 renderShots();
}
function split(){
 const t=currentTime();
 const after=splitShot(shots,t,duration);
 if(after.length===shots.length){status('カットの端から少し離れた位置で分割してください。');return;}
 shots=after;selectShot(findShot(shots,Math.min(duration-.01,t+.01)).id,{seek:false});
 status(stamp(t)+' にカットを追加しました。');
}
function applyPose(time,dt){
 if(!vrm)return;
 const shot=findShot(shots,time)||SHOT_DEFAULT,local=time-shot.start,amount=shot.intensity||0;
 for(const [name,base] of Object.entries(baseRotations)){const node=getNode(name);if(node)node.quaternion.copy(base);}
 const angles={};
 const move=shot.movement;
 const breathe=Math.sin(time*2.2)*.012*amount;
 angles.spine=[breathe,0,Math.sin(time*.8)*.014*amount];
 angles.chest=[breathe,0,0];
 if(move==='nod')angles.head=[Math.sin(local*7)*.27*amount,0,0];
 if(move==='shake')angles.head=[0,Math.sin(local*7)*.38*amount,0];
 if(move==='bow')angles.spine=[Math.min(1,local*2)*.48*amount+breathe,0,0];
 if(move==='listen')angles.head=[-.1*amount,-.13*amount,.11*amount];
 if(move==='talk'){
  angles.head=[Math.sin(local*2.4)*.1*amount,Math.sin(local*1.5)*.12*amount,0];
  angles.leftUpperArm=[-.28*amount,0,.15*amount+Math.sin(local*4)*.12*amount];
  angles.rightUpperArm=[-.35*amount,0,-.18*amount-Math.sin(local*3)*.12*amount];
 }
 if(move==='wave'){
  angles.rightUpperArm=[-.25*amount,0,-1.25*amount];
  angles.rightLowerArm=[0,0,(-.4+Math.sin(local*9)*.3)*amount];
 }
 if(move==='idle')angles.head=[Math.sin(time*1.1)*.025*amount,Math.sin(time*.45)*.028*amount,0];
 const deltaQuat=new THREE.Quaternion();
 for(const [name,angle] of Object.entries(angles)){
  const node=getNode(name);if(!node||!baseRotations[name])continue;
  deltaQuat.setFromEuler(new THREE.Euler(...angle));
  node.quaternion.multiply(deltaQuat);
 }
 // Author-controlled cut pose takes precedence as an additive local rotation.
 for(const [name,degrees] of Object.entries(shot.pose||{})){
  const node=getNode(name);if(!node||!baseRotations[name])continue;
  deltaQuat.setFromEuler(new THREE.Euler(...degrees.map(v=>THREE.MathUtils.degToRad(v)),'XYZ'));
  node.quaternion.multiply(deltaQuat);
 }
 const manager=vrm.expressionManager;
 if(manager){
  for(const name of EXPRESSIONS){try{if(manager.getExpression(name))manager.setValue(name,shot.expression===name?1:0);}catch{}}
  const blink=Math.pow(Math.max(0,Math.sin(time*1.85+1.6)),25)*.95;
  try{if(manager.getExpression('blink'))manager.setValue('blink',blink);}catch{}
  const volume=audio.paused?amplitudeAt(envelope,time):liveAmplitude();
  mouthLevel+=(volume-mouthLevel)*Math.min(1,dt*22);
  const mouth=shot.mouth==='closed'?null:shot.mouth==='auto'?'aa':shot.mouth;
  for(const viseme of ['aa','ee','ih','oh','ou']){
   try{if(manager.getExpression(viseme))manager.setValue(viseme,mouth===viseme?(shot.mouth==='auto'?mouthLevel:Math.max(.35,mouthLevel)):0);}catch{}
  }
 }
 vrm.update(dt);
 const [targetY,baseDistance]=shot.camera==='close'?[.83,.84]:shot.camera==='full'?[.5,2.9]:[.67,1.65];
 const dist=baseDistance/clamp(shot.zoom??1,.45,2.3);
 const y=bounds.minY+bounds.height*targetY,offset=shot.framing*bounds.height*.16;
 const rotation=cameraYaw+cameraTurn,cp=Math.cos(cameraPitch),sp=Math.sin(cameraPitch);
 camera.position.set(offset+Math.sin(rotation)*dist*bounds.height*cp,
  y+(.07+dist*sp)*bounds.height,Math.cos(rotation)*dist*bounds.height*cp);
 camera.lookAt(offset,y,0);
}
function frame(now){
 requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(playingSilent){previewTime+=dt;if(previewTime>=duration){previewTime=duration;stopPlayback();}}
 if(audio.src&&audio.readyState>=1)previewTime=audio.currentTime;
 const time=clamp(previewTime,0,duration);
 if(vrm)applyPose(time,dt);
 if(renderer)renderer.render(scene,camera);
 renderClock();
}
async function exportVideo(){
 if(recording){recording.stop();return;}
 if(!renderer||!vrm||!audio.src){status('動画を書き出すにはVRMモデルと音声ファイルが必要です。');return;}
 if(!renderer.domElement.captureStream||typeof MediaRecorder==='undefined'){status('このブラウザには動画収録APIがありません。');return;}
 const mime=['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
 if(!mime){status('動画と音声を一緒に収録できる形式がありません。');return;}
 try{
  await ensureAudioGraph();if(!audioDestination)throw Error('音声キャプチャが利用できません');
  stopPlayback();setTime(0);
  recordingStream=renderer.domElement.captureStream(30);
  for(const track of audioDestination.stream.getAudioTracks())recordingStream.addTrack(track);
  recordingChunks=[];recordingExtension=mime.includes('mp4')?'mp4':'webm';
  recording=new MediaRecorder(recordingStream,{mimeType:mime,videoBitsPerSecond:3800000});
  const currentRecorder=recording;
  currentRecorder.ondataavailable=e=>{if(e.data?.size)recordingChunks.push(e.data);};
  currentRecorder.onerror=e=>status('書き出しで問題が発生: '+(e.error?.message||'収録に失敗'));
  currentRecorder.onstop=()=>{
   audio.pause();$('play').textContent='▶';
   for(const track of recordingStream?.getVideoTracks()||[])track.stop();
   if(recordingChunks.length){const blob=new Blob(recordingChunks,{type:currentRecorder.mimeType});saveBlob(blob,'VRM_STAGE_'+Date.now()+'.'+recordingExtension);status('動画を保存しました。'+recordingExtension.toUpperCase()+'形式です。');}
   else status('動画データを保存できませんでした。');
   recording=null;recordingStream=null;recordingChunks=[];$('export-video').textContent='動画を書き出す';
  };
  audio.onended=()=>{previewTime=duration;$('play').textContent='▶';if(recording&&recording.state!=='inactive')recording.stop();};
  recording.start(1000);$('export-video').textContent='収録を終了';status('実時間で映像を収録中です。再生が終わるまで画面を閉じないでください。');
  try{await audio.play();$('play').textContent='Ⅱ';}
  catch(e){currentRecorder.stop();throw e;}
 }catch(e){console.error(e);status('書き出しに失敗: '+e.message);}
}
function saveProject(){
 const doc=projectJSON(shots,duration);
 doc.modelFileName=modelName;doc.modelSource=sourceModel;doc.audioFileName=audioName;doc.ratio=$('ratio').value;
 doc.backgroundColor=backgroundColor;doc.cameraYaw=cameraYaw;doc.cameraPitch=cameraPitch;doc.cameraTurn=cameraTurn;
 saveBlob(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'VRM_STAGE_shots.json');
 status('カットの設定を保存しました。VRM・音声ファイル本体は含みません。');
}
async function loadProject(file){
 try{
  if(file.size>1024*1024)throw Error('設定ファイルが大きすぎます');
  const doc=JSON.parse(await file.text());
  if(doc.schema!=='vrm-stage/v1'||!Array.isArray(doc.shots)||doc.shots.length>500)throw Error('VRM STAGEの設定ファイルではありません');
  duration=audio.src?duration:clamp(doc.duration,1,7200);
  shots=normalizeShots(doc.shots,duration);selectedId=shots[0].id;
  if(/^#[0-9a-f]{6}$/i.test(doc.backgroundColor||'')){backgroundColor=doc.backgroundColor;$('background-color').value=backgroundColor;if(scene)scene.background=new THREE.Color(backgroundColor);}
  cameraYaw=clamp(doc.cameraYaw??0,-3.14,3.14);
  cameraPitch=clamp(doc.cameraPitch??0,-1.1,1.1);
  cameraTurn=doc.cameraTurn===Math.PI?Math.PI:0;
  if(['9:16','16:9','1:1'].includes(doc.ratio)){$('ratio').value=doc.ratio;configureRatio();}
  $('seek').max=duration;renderShots();renderSelection();setTime(0);
  status('設定を読み込みました。音声とVRMは必要に応じて読み直してください。');
 }catch(e){status('設定読み込み失敗: '+e.message);}
}

function setupPoseControls(){
 const select=$('pose-bone');select.replaceChildren();
 for(const [key,title] of POSE_BONES){
  const option=document.createElement('option');option.value=key;option.textContent=title;select.append(option);
 }
 select.value=poseBone;
 const presets=$('pose-presets');presets.replaceChildren();
 for(const [id,label] of POSE_PRESETS){
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.onclick=()=>{
   const shot=selectedShot();if(!shot)return;
   shot.pose=presetPose(id);renderPoseControls();status(label+' をこのカットへ適用しました。');
  };
  presets.append(button);
 }
 renderPoseControls();
}
function renderPoseControls(){
 const shot=selectedShot();if(!shot)return;
 const selector=$('pose-bone');
 for(const opt of selector.options)opt.disabled=!!vrm&&!getNode(opt.value);
 if(vrm&&!getNode(poseBone)){
  const first=POSE_BONES.find(([key])=>!!getNode(key));
  if(first)poseBone=first[0];
 }
 selector.value=poseBone;
 const angles=shot.pose?.[poseBone]||[0,0,0];
 ['x','y','z'].forEach((axis,i)=>{
  const slider=$('pose-'+axis),value=$('pose-'+axis+'-value');
  slider.value=String(angles[i]||0);value.textContent=(angles[i]||0)+'°';
  slider.disabled=!!vrm&&!getNode(poseBone);
 });
}
function updatePoseAxis(axis,value){
 const shot=selectedShot();if(!shot)return;
 const index={x:0,y:1,z:2}[axis];if(index===undefined)return;
 if(vrm&&!getNode(poseBone))return;
 const copy={...(shot.pose||{})};
 const degrees=[...(copy[poseBone]||[0,0,0])];degrees[index]=clamp(value,-130,130);
 copy[poseBone]=degrees;shot.pose=normalizePose(copy);
 $('pose-'+axis+'-value').textContent=degrees[index]+'°';
}
function renderModelInfo(){
 const box=$('model-info');box.replaceChildren();
 const add=text=>{const p=document.createElement('p');p.textContent=text;box.append(p);};
 if(!vrm){add('まだモデルが読み込まれていません。Subeha.vrmを読み込むとボーンと表情を確認できます。');return;}
 const bones=POSE_BONES.filter(([key])=>!!getNode(key));
 const mgr=vrm.expressionManager;
 const expressions=Object.keys(mgr?.expressionMap||{});
 supportedExpressions=expressions;
 add('モデル: '+modelName+' / '+(sourceModel==='built-in'?'GitHub版':'端末から選択'));
 add('操作できる関節: '+bones.length+'/'+POSE_BONES.length+'（'+bones.map(([,label])=>label).join('、')+'）');
 add('モデルに含まれる表情: '+(expressions.join(' / ')||'なし'));
 add('動画・静止画を書き出す際も、モデル原本は変更しません。ポーズは設定JSONに保存されます。');
 const expressionSelect=$('expression');
 for(const opt of expressionSelect.options){
  if(opt.value==='neutral'){opt.disabled=false;continue;}
  opt.disabled=!mgr?.getExpression?.(opt.value);
 }
}

function bind(){
 $('vrm-input').onchange=e=>{loadModel(e.target.files?.[0]);e.target.value='';};
 $('load-subeha').onclick=loadBuiltIn;
 $('audio-input').onchange=e=>{loadAudio(e.target.files?.[0]);e.target.value='';};
 $('play').onclick=togglePlay;$('split').onclick=split;$('seek').oninput=e=>setTime(Number(e.target.value));
 $('ratio').onchange=configureRatio;$('export-video').onclick=exportVideo;
 $('front-camera').onclick=()=>{cameraYaw=0;cameraPitch=0;cameraTurn=0;};
 $('turn-camera').onclick=()=>{cameraTurn=cameraTurn===0?Math.PI:0;};
 $('background-color').oninput=e=>{if(!/^#[0-9a-f]{6}$/i.test(e.target.value))return;backgroundColor=e.target.value;if(scene)scene.background=new THREE.Color(backgroundColor);};
 $('zoom').oninput=e=>{const shot=selectedShot();if(!shot)return;shot.zoom=clamp(e.target.value,.45,2.3);$('zoom-value').textContent=Math.round(shot.zoom*100)+'%';};
 $('model-info-toggle').onclick=()=>{$('model-info').hidden=!$('model-info').hidden;renderModelInfo();};
 $('pose-bone').onchange=e=>{poseBone=e.target.value;renderPoseControls();};
 for(const axis of ['x','y','z'])$('pose-'+axis).oninput=e=>updatePoseAxis(axis,Number(e.target.value));
 $('pose-reset').onclick=()=>{const shot=selectedShot();if(shot){shot.pose={};renderPoseControls();}};
 $('pose-reset-bone').onclick=()=>{const shot=selectedShot();if(shot){delete shot.pose[poseBone];renderPoseControls();}};
 $('snapshot').onclick=()=>{if(!renderer||!vrm)return status('先にVRMを読み込んでください');renderer.domElement.toBlob(blob=>{if(blob)saveBlob(blob,'VRM_STAGE_'+Math.floor(currentTime()*1000)+'.png');},'image/png');};
 for(const key of ['expression','movement','camera','mouth','intensity','framing']){
  $(key).addEventListener('input',e=>mutateShot(key,['intensity','framing'].includes(key)?Number(e.target.value):e.target.value));
 }
 $('delete-shot').onclick=()=>{const i=shots.findIndex(s=>s.id===selectedId);shots=removeShot(shots,i,duration);selectShot(shots[Math.min(i,shots.length-1)].id,{seek:false});};
 $('boundary').oninput=e=>{
  const idx=shots.findIndex(s=>s.id===selectedId);
  shots=moveCut(shots,idx,Number(e.target.value),duration);
  $('boundary-value').textContent=stamp(shots[idx]?.start);renderShots();renderSelection();
 };
 $('save-project').onclick=saveProject;
 $('load-project').onclick=()=>$('project-input').click();
 $('project-input').onchange=e=>{loadProject(e.target.files?.[0]);e.target.value='';};
 audio.addEventListener('pause',()=>{if(!recording){$('play').textContent='▶';}});
 audio.addEventListener('play',()=>{$('play').textContent='Ⅱ';});
 audio.addEventListener('ended',()=>{previewTime=duration;playingSilent=false;$('play').textContent='▶';});
 window.addEventListener('pagehide',()=>{if(recording?.state==='recording')recording.stop();if(audioUrl)URL.revokeObjectURL(audioUrl);});
}
bind();setupPoseControls();renderShots();renderSelection();renderClock();
try{init3D();}catch(e){console.error(e);status('WebGLの初期化に失敗: '+e.message);}
