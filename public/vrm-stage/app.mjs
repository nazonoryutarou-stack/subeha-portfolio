import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';
import {recolorVRM} from './recolor-vrm.mjs';
import {nearestPoseBone, dragPoseAngles} from './pose-gestures.mjs';
import {EXPRESSIONS, SHOT_DEFAULT, POSE_BONES, POSE_PRESETS, normalizePose, normalizeExpressionMix, presetPose, normalizeShots, newShot, splitShot, moveCut, removeShot, findShot, computeEnvelope, amplitudeAt, clamp, projectJSON} from './shots.mjs';

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
let modelMaterials=[],materialOverrides={},materialOwner='',selectedMaterial=0;
let sourceVRMBytes=null;
const compiler=()=>new GLTFLoader().register(parser=>new VRMLoaderPlugin(parser));
let poseTouchMode=false,poseDots=new Map(),visiblePosePoints=[],lastPoseMarkerFrame=0;
let poseUndoStack=[],poseRedoStack=[];
function poseSnapshot(shot){return {shotId:shot.id,pose:normalizePose(shot.pose)};}
function refreshPoseHistoryButtons(){
 $('pose-undo').disabled=!poseUndoStack.length;
 $('pose-redo').disabled=!poseRedoStack.length;
}
function clearPoseHistory(){poseUndoStack=[];poseRedoStack=[];refreshPoseHistoryButtons();}
function checkpointPose(){
 const shot=selectedShot();if(!shot)return;
 poseUndoStack.push(poseSnapshot(shot));
 if(poseUndoStack.length>80)poseUndoStack.shift();
 poseRedoStack=[];refreshPoseHistoryButtons();
}
function movePoseHistory(source,destination){
 const previous=source.pop();if(!previous)return;
 const shot=shots.find(s=>s.id===previous.shotId);
 if(shot){
  destination.push(poseSnapshot(shot));
  shot.pose=normalizePose(previous.pose);
  selectShot(shot.id,{seek:false});
  status('ポーズ編集を'+(source===poseUndoStack?'取り消しました。':'やり直しました。'));
 }
 refreshPoseHistoryButtons();
}
function refreshPoseHandles(){
 if(!poseTouchMode||!vrm||!renderer){for(const dot of poseDots.values())dot.hidden=true;visiblePosePoints=[];return;}
 const rect=renderer.domElement.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
 if(rect.width<2||rect.height<2)return;
 camera.updateMatrixWorld(true);vrm.scene.updateMatrixWorld(true);
 const points=[],world=new THREE.Vector3();
 for(const [name,label] of POSE_BONES){
  const node=getNode(name);
  let dot=poseDots.get(name);
  if(!node){if(dot)dot.hidden=true;continue;}
  if(!dot){
   dot=document.createElement('span');dot.className='pose-dot';dot.dataset.label=label;
   dot.setAttribute('aria-hidden','true');stage.append(dot);poseDots.set(name,dot);
  }
  node.getWorldPosition(world);world.project(camera);
  if(!Number.isFinite(world.x)||!Number.isFinite(world.y)||world.z< -1||world.z>1){dot.hidden=true;continue;}
  const x=rect.left+(world.x+1)*rect.width*.5,y=rect.top+(1-world.y)*rect.height*.5;
  const inside=x>=rect.left-2&&x<=rect.right+2&&y>=rect.top-2&&y<=rect.bottom+2;
  dot.hidden=!inside;if(!inside)continue;
  dot.style.left=(x-stageRect.left)+'px';dot.style.top=(y-stageRect.top)+'px';
  dot.classList.toggle('active',name===poseBone);
  points.push({name,x,y});
 }
 visiblePosePoints=points;
}
function toggleTouchPose(){
 if(!vrm){status('まずVRMモデルを読み込んでください。');return;}
 poseTouchMode=!poseTouchMode;
 $('touch-pose').setAttribute('aria-pressed',String(poseTouchMode));
 $('touch-pose').textContent=poseTouchMode?'指で編集中 ✓':'指でポーズ編集';
 refreshPoseHandles();
 status(poseTouchMode?'点で関節を選び、指をドラッグしてください。上下=X軸、左右=Z軸。':'カメラを指で回すモードです。');
}
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
 const canvas=renderer.domElement;
 canvas.style.touchAction='none';
 canvas.addEventListener('pointerdown',e=>{
  if(recording||e.button>0)return;
  if(poseTouchMode&&vrm){
   refreshPoseHandles();
   const radius=Math.max(45,Math.min(65,canvas.getBoundingClientRect().width*.1));
   const bone=nearestPoseBone(visiblePosePoints,e.clientX,e.clientY,radius);
   if(bone){
    poseBone=bone;renderPoseControls();
    const shot=selectedShot();
    drag={mode:'pose',pointerId:e.pointerId,x:e.clientX,y:e.clientY,bone,shotId:shot.id,
     initial:[...(shot.pose?.[bone]||[0,0,0])],changed:false};
    canvas.setPointerCapture(e.pointerId);e.preventDefault();
    return;
   }
  }
  drag={mode:'camera',pointerId:e.pointerId,x:e.clientX,y:e.clientY,yaw:cameraYaw,pitch:cameraPitch};
  canvas.setPointerCapture(e.pointerId);
 });
 canvas.addEventListener('pointermove',e=>{
  if(!drag||drag.pointerId!==e.pointerId||recording)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(drag.mode==='pose'){
   const shot=shots.find(s=>s.id===drag.shotId);
   if(!shot)return;
   if(!drag.changed&&Math.hypot(dx,dy)>4){checkpointPose();drag.changed=true;}
   if(drag.changed){
    shot.pose=normalizePose({...shot.pose,[drag.bone]:dragPoseAngles(drag.initial,dx,dy)});
    renderPoseControls();refreshPoseHandles();
   }
  }else{
   cameraYaw=clamp(drag.yaw+dx/260,-3.14,3.14);
   cameraPitch=clamp(drag.pitch-dy/300,-1.1,1.1);
  }
  e.preventDefault();
 });
 for(const event of ['pointerup','pointercancel','lostpointercapture']){
  canvas.addEventListener(event,e=>{if(drag?.pointerId===e.pointerId)drag=null;});
 }
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
  loadPoseBones();clearPoseHistory();modelName=name;sourceModel=origin;lastStatusModel=name;
  if(materialOwner!==name){materialOverrides={};materialOwner=name;}
  sourceVRMBytes=bytes;collectMaterials(gltf.parser);
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
 renderPoseControls();renderExpressionControls();
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
  for(const name of Object.keys(manager.expressionMap||{}))try{manager.setValue(name,0);}catch{}
  for(const name of EXPRESSIONS){try{if(manager.getExpression(name))manager.setValue(name,shot.expression===name?1:0);}catch{}}
  const blink=Math.pow(Math.max(0,Math.sin(time*1.85+1.6)),25)*.95;
  try{if(manager.getExpression('blink'))manager.setValue('blink',blink);}catch{}
  const volume=audio.paused?amplitudeAt(envelope,time):liveAmplitude();
  mouthLevel+=(volume-mouthLevel)*Math.min(1,dt*22);
  const mouth=shot.mouth==='closed'?null:shot.mouth==='auto'?'aa':shot.mouth;
  for(const viseme of ['aa','ee','ih','oh','ou']){
   try{if(manager.getExpression(viseme))manager.setValue(viseme,mouth===viseme?(shot.mouth==='auto'?mouthLevel:Math.max(.35,mouthLevel)):0);}catch{}
  }
  for(const [name,weight] of Object.entries(shot.expressionMix||{})){
   try{if(manager.getExpression(name))manager.setValue(name,weight);}catch{}
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
 if(playingSilent){previewTime+=dt;if(previewTime>=duration){previewTime=duration;stopPlayback();if(recording?.state==='recording'&&!audio.src)recording.stop();}}
 if(audio.src&&audio.readyState>=1)previewTime=audio.currentTime;
 const time=clamp(previewTime,0,duration);
 if(vrm)applyPose(time,dt);
 if(renderer)renderer.render(scene,camera);
 if(poseTouchMode&&now-lastPoseMarkerFrame>70){lastPoseMarkerFrame=now;refreshPoseHandles();}
 renderClock();
}
async function exportVideo(){
 if(recording){if(recording.state==='recording')recording.stop();return;}
 if(!renderer||!vrm){status('動画を書き出すにはVRMモデルが必要です。');return;}
 if(!renderer.domElement.captureStream||typeof MediaRecorder==='undefined'){
  status('このブラウザでは動画収録APIを利用できません。');return;
 }
 const withAudio=!!audio.src;
 const options=withAudio
  ? ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']
  : ['video/mp4;codecs="avc1.42E01E"','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
 const mime=options.find(format=>{try{return MediaRecorder.isTypeSupported(format);}catch{return false;}});
 if(!mime){status('収録できるMP4/WebM形式が見つかりません。');return;}
 try{
  if(withAudio){
   await ensureAudioGraph();
   if(!audioDestination)throw Error('音声キャプチャが利用できません');
  }
  stopPlayback();setTime(0);
  recordingStream=renderer.domElement.captureStream(30);
  if(withAudio)for(const track of audioDestination.stream.getAudioTracks())recordingStream.addTrack(track);
  recordingChunks=[];recordingExtension=mime.includes('mp4')?'mp4':'webm';
  recording=new MediaRecorder(recordingStream,{mimeType:mime,videoBitsPerSecond:3800000});
  const currentRecorder=recording;
  currentRecorder.ondataavailable=e=>{if(e.data?.size)recordingChunks.push(e.data);};
  currentRecorder.onerror=e=>status('動画収録エラー: '+(e.error?.message||'録画に失敗'));
  currentRecorder.onstop=()=>{
   stopPlayback();
   for(const track of recordingStream?.getTracks()||[])if(track.kind==='video')track.stop();
   if(recordingChunks.length){
    saveBlob(new Blob(recordingChunks,{type:currentRecorder.mimeType}),'Subeha_STAGE_'+Date.now()+'.'+recordingExtension);
    status('動画を保存しました（'+recordingExtension.toUpperCase()+'）。ブラウザがWebMを選んだ場合はVideoleap向けにMP4へ変換してください。');
   }else status('動画データを保存できませんでした。');
   recording=null;recordingStream=null;recordingChunks=[];
   $('export-video').textContent='動画を書き出す';
  };
  if(withAudio)audio.onended=()=>{
   previewTime=duration;$('play').textContent='▶';
   if(recording?.state==='recording')recording.stop();
  };
  recording.start(1000);
  $('export-video').textContent='収録を終了';
  status('実時間で動画を収録中です。再生が終わるまで画面を閉じないでください。');
  if(withAudio){
   try{await audio.play();$('play').textContent='Ⅱ';}
   catch(e){if(recording?.state==='recording')recording.stop();throw e;}
  }else{
   playingSilent=true;$('play').textContent='Ⅱ';
  }
 }catch(e){
  console.error(e);status('動画書き出しに失敗: '+(e?.message||e));
 }
}
function saveProject(){
 const doc=projectJSON(shots,duration);
 doc.modelFileName=modelName;doc.modelSource=sourceModel;doc.audioFileName=audioName;doc.ratio=$('ratio').value;
 doc.backgroundColor=backgroundColor;doc.cameraYaw=cameraYaw;doc.cameraPitch=cameraPitch;doc.cameraTurn=cameraTurn;
 doc.materialOverrides={...materialOverrides};doc.materialOwner=materialOwner;
 saveBlob(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),'VRM_STAGE_shots.json');
 status('カットの設定を保存しました。VRM・音声ファイル本体は含みません。');
}
async function loadProject(file){
 try{
  if(file.size>1024*1024)throw Error('設定ファイルが大きすぎます');
  const doc=JSON.parse(await file.text());
  if(doc.schema!=='vrm-stage/v1'||!Array.isArray(doc.shots)||doc.shots.length>500)throw Error('VRM STAGEの設定ファイルではありません');
  duration=audio.src?duration:clamp(doc.duration,1,7200);
  shots=normalizeShots(doc.shots,duration);selectedId=shots[0].id;clearPoseHistory();
  if(/^#[0-9a-f]{6}$/i.test(doc.backgroundColor||'')){backgroundColor=doc.backgroundColor;$('background-color').value=backgroundColor;if(scene)scene.background=new THREE.Color(backgroundColor);}
  cameraYaw=clamp(doc.cameraYaw??0,-3.14,3.14);
  cameraPitch=clamp(doc.cameraPitch??0,-1.1,1.1);
  cameraTurn=doc.cameraTurn===Math.PI?Math.PI:0;
  materialOwner=String(doc.materialOwner||doc.modelFileName||'');
  materialOverrides={};
  for(const [key,color] of Object.entries(doc.materialOverrides||{})){
   if(/^\d{1,3}$/.test(key)&&Number(key)<300&&/^#[0-9a-f]{6}$/i.test(color))materialOverrides[key]=color;
  }
  if(modelName===materialOwner)applyMaterialOverrides();renderMaterialUI();
  if(['9:16','16:9','1:1'].includes(doc.ratio)){$('ratio').value=doc.ratio;configureRatio();}
  $('seek').max=duration;renderShots();renderSelection();setTime(0);
  status('設定を読み込みました。音声とVRMは必要に応じて読み直してください。');
 }catch(e){status('設定読み込み失敗: '+e.message);}
}


function collectMaterials(parser){
 modelMaterials=[];const seen=new Set();
 vrm?.scene.traverse(object=>{
  for(const m of (Array.isArray(object.material)?object.material:[object.material])){
   if(!m?.color?.isColor||seen.has(m.uuid))continue;
   seen.add(m.uuid);
   if(modelMaterials.length<300){
    const association=parser?.associations?.get(m);
    const index=association?.materials??(association?.type==='materials'?association.index:-1);
    modelMaterials.push({material:m,original:m.color.clone(),name:m.name||object.name||'材質',sourceIndex:Number.isInteger(index)?index:-1});
   }
  }
 });
 selectedMaterial=0;applyMaterialOverrides();
 const select=$('material-select');select.replaceChildren();
 modelMaterials.forEach((entry,i)=>{
  const opt=document.createElement('option');opt.value=String(i);
  opt.textContent=(i+1)+'. '+String(entry.name).slice(0,42);select.append(opt);
 });
 renderMaterialUI();
}
function applyMaterialOverrides(){
 modelMaterials.forEach((entry,index)=>{
  const color=materialOverrides[String(index)];
  if(color&&/^#[0-9a-f]{6}$/i.test(color))entry.material.color.set(color);
  else entry.material.color.copy(entry.original);
  entry.material.needsUpdate=true;
 });
}
function renderMaterialUI(){
 const entry=modelMaterials[selectedMaterial];
 const color=$('material-color'),select=$('material-select');
 select.disabled=!modelMaterials.length;color.disabled=!entry;
 $('material-reset').disabled=!entry;$('material-reset-all').disabled=!modelMaterials.length;
 $('export-recolored-vrm').disabled=!sourceVRMBytes||!modelMaterials.length;
 if(entry){select.value=String(selectedMaterial);color.value='#'+entry.material.color.getHexString();}
}
function setMaterialColor(value){
 if(!/^#[0-9a-f]{6}$/i.test(value))return;
 const entry=modelMaterials[selectedMaterial];if(!entry)return;
 entry.material.color.set(value);entry.material.needsUpdate=true;
 materialOverrides[String(selectedMaterial)]=value;
}
function resetMaterial(index){
 const entry=modelMaterials[index];if(!entry)return;
 delete materialOverrides[String(index)];entry.material.color.copy(entry.original);
 entry.material.needsUpdate=true;renderMaterialUI();
}


function renderExpressionControls(){
 const root=$('expression-controls');root.replaceChildren();
 const names=Object.keys(vrm?.expressionManager?.expressionMap||{}).filter(name=>name.length>0&&name.length<=80).slice(0,64);
 if(!names.length){
  const p=document.createElement('p');p.className='pose-help';
  p.textContent='モデルを読み込むと、内蔵モーフが表示されます。';
  root.append(p);$('reset-expression').disabled=true;return;
 }
 $('reset-expression').disabled=false;
 const shot=selectedShot();if(!shot)return;
 const priorities=['aa','ih','ou','ee','oh','blink','happy','angry','sad','relaxed','surprised'];
 names.sort((a,b)=>{
  const ai=priorities.indexOf(a),bi=priorities.indexOf(b);
  return (ai===-1?999:ai)-(bi===-1?999:bi)||a.localeCompare(b);
 });
 for(const name of names){
  const label=document.createElement('label');label.className='expression-row';
  const title=document.createElement('span');title.textContent=name;
  const output=document.createElement('output');output.textContent=Math.round((shot.expressionMix?.[name]||0)*100)+'%';
  const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='1';slider.step='.05';
  slider.value=String(shot.expressionMix?.[name]||0);slider.setAttribute('aria-label',name+' モーフ強度');
  slider.addEventListener('input',()=>{
   const value=Number(slider.value),current=selectedShot();if(!current)return;
   const raw={...(current.expressionMix||{})};
   if(value>0)raw[name]=value;else delete raw[name];
   current.expressionMix=normalizeExpressionMix(raw);
   output.textContent=Math.round(value*100)+'%';
  });
  label.append(title,output,slider);root.append(label);
 }
}


function exportRecoloredVRM(){
 if(!sourceVRMBytes||!vrm){status('まずVRMを読み込んでください。');return;}
 try{
  const patches={};
  for(const [key,color] of Object.entries(materialOverrides)){
   const entry=modelMaterials[Number(key)];
   if(!entry||entry.sourceIndex<0)throw Error('この材質と元VRMとの対応が確認できないため中止しました');
   patches[String(entry.sourceIndex)]=color;
  }
  const output=recolorVRM(sourceVRMBytes,patches);
  const filename=String(modelName||'Subeha').replace(/\.vrm$/i,'').replace(/[\\/:*?"<>|]/g,'_').slice(0,70)+'_recolored.vrm';
  saveBlob(new Blob([output.bytes],{type:'model/gltf-binary'}),filename);
  status(output.changed+'種類の材質色を変更したVRMを保存しました。元のVRMは上書きしません。');
 }catch(e){console.error(e);status('VRM書き出しに失敗: '+(e?.message||e));}
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
   checkpointPose();shot.pose=presetPose(id);renderPoseControls();status(label+' をこのカットへ適用しました。');
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
 renderExpressionControls();
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
 $('material-select').onchange=e=>{selectedMaterial=Number(e.target.value)||0;renderMaterialUI();};
 $('material-color').oninput=e=>setMaterialColor(e.target.value);
 $('material-reset').onclick=()=>resetMaterial(selectedMaterial);
 $('material-reset-all').onclick=()=>{materialOverrides={};applyMaterialOverrides();renderMaterialUI();status('モデルの色を初期状態へ戻しました。');};
 $('export-recolored-vrm').onclick=exportRecoloredVRM;
 $('pose-bone').onchange=e=>{poseBone=e.target.value;renderPoseControls();refreshPoseHandles();};
 $('touch-pose').onclick=toggleTouchPose;
 $('pose-undo').onclick=()=>movePoseHistory(poseUndoStack,poseRedoStack);
 $('pose-redo').onclick=()=>movePoseHistory(poseRedoStack,poseUndoStack);
 for(const axis of ['x','y','z']){
  const slider=$('pose-'+axis);let editing=false;
  slider.addEventListener('input',e=>{
   if(!editing){checkpointPose();editing=true;}
   updatePoseAxis(axis,Number(e.target.value));
  });
  slider.addEventListener('change',()=>{editing=false;});
  slider.addEventListener('pointercancel',()=>{editing=false;});
 }
 $('pose-reset').onclick=()=>{const shot=selectedShot();if(shot){checkpointPose();shot.pose={};renderPoseControls();}};
 $('reset-expression').onclick=()=>{const shot=selectedShot();if(shot){shot.expressionMix={};renderExpressionControls();}};
 $('pose-reset-bone').onclick=()=>{const shot=selectedShot();if(shot){checkpointPose();delete shot.pose[poseBone];renderPoseControls();}};
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
if(new URLSearchParams(window.location.search).get('model')==='subeha')loadBuiltIn();
