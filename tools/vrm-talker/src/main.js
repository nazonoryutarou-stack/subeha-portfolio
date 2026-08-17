import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';

const canvas=document.getElementById('c');
const stage=document.getElementById('stage');
const vrmFile=document.getElementById('vrmFile');
const audioFile=document.getElementById('audioFile');
const bgFile=document.getElementById('bgFile');
const clearBg=document.getElementById('clearBg');
const playBtn=document.getElementById('play');
const stopBtn=document.getElementById('stop');
const resetBtn=document.getElementById('reset');
const portraitBtn=document.getElementById('portrait');
const fullbodyBtn=document.getElementById('fullbody');
const zoomSlider=document.getElementById('zoom');
const seek=document.getElementById('seek');
const status=document.getElementById('status');
const meterBar=document.getElementById('meterBar');
const dropHint=document.getElementById('dropHint');

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(24,1,.1,100);
scene.add(new THREE.HemisphereLight(0xffffff,0x202027,2.35));
const key=new THREE.DirectionalLight(0xffffff,3.6);key.position.set(2.4,4,4);scene.add(key);
const fill=new THREE.DirectionalLight(0xcbd5ff,1.3);fill.position.set(-2.5,1.7,3);scene.add(fill);
const rim=new THREE.DirectionalLight(0xaab7ff,1.6);rim.position.set(-3,2,-3);scene.add(rim);

let vrm=null,audio=null,audioUrl=null,bgUrl=null;
let ctx=null,source=null,analyser=null,freq=null,timeData=null;
let smooth=0,yaw=0,pitch=0,drag=false,lastX=0,lastY=0;
let modelHeight=1.7,modelCenterY=.9,frameMode='portrait';
let bones={};

const bone=(name)=>vrm?.humanoid?.getNormalizedBoneNode(name)||null;

const resize=()=>{
 const r=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 renderer.setPixelRatio(dpr);renderer.setSize(r.width,r.height,false);
 camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(stage);resize();

function measureModel(){
 if(!vrm)return;
 const box=new THREE.Box3().setFromObject(vrm.scene),size=new THREE.Vector3(),center=new THREE.Vector3();
 box.getSize(size);box.getCenter(center);
 modelHeight=Math.max(size.y,.1);modelCenterY=center.y;
}

function setCamera(mode=frameMode){
 if(!vrm)return;frameMode=mode;
 const zoom=Number(zoomSlider.value)/100;
 if(mode==='full'){
  camera.position.set(0,modelHeight*.54,modelHeight*1.88*zoom);
  camera.lookAt(0,modelHeight*.53,0);
 }else{
  camera.position.set(0,modelHeight*.66,modelHeight*1.26*zoom);
  camera.lookAt(0,modelHeight*.69,0);
 }
 camera.updateProjectionMatrix();
}

function cacheBones(){
 bones={
  head:bone('head'),neck:bone('neck'),chest:bone('chest'),spine:bone('spine'),hips:bone('hips'),
  leftUpperArm:bone('leftUpperArm'),rightUpperArm:bone('rightUpperArm'),
  leftLowerArm:bone('leftLowerArm'),rightLowerArm:bone('rightLowerArm'),
  leftHand:bone('leftHand'),rightHand:bone('rightHand')
 };
}

function applyBasePose(t=0,env=0){
 if(!vrm)return;
 const breathe=Math.sin(t*.9)*.012;
 // VRM normalized humanoid bones start from a T-like reference pose.
 // Fold the upper arms down and slightly forward so the avatar reads as a presenter, not a rig test.
 if(bones.leftUpperArm){bones.leftUpperArm.rotation.set(.08,0,-1.18+breathe);}
 if(bones.rightUpperArm){bones.rightUpperArm.rotation.set(.08,0,1.18-breathe);}
 if(bones.leftLowerArm){bones.leftLowerArm.rotation.set(.12,0,-.08);}
 if(bones.rightLowerArm){bones.rightLowerArm.rotation.set(.12,0,.08);}
 if(bones.leftHand){bones.leftHand.rotation.set(0,0,-.03);}
 if(bones.rightHand){bones.rightHand.rotation.set(0,0,.03);}
 if(bones.spine){bones.spine.rotation.x=.018+breathe*.35;}
 if(bones.chest){bones.chest.rotation.y=Math.sin(t*.34)*.018;bones.chest.rotation.x=.012+env*.015+breathe;}
 if(bones.neck){bones.neck.rotation.z=Math.sin(t*.43)*.014;}
 if(bones.head){bones.head.rotation.y=yaw+Math.sin(t*.73)*.038;bones.head.rotation.x=pitch+Math.sin(t*.51)*.014-env*.02;}
}

vrmFile.addEventListener('change',async()=>{
 const file=vrmFile.files?.[0];if(!file)return;
 status.textContent='VRMを読み込み中…';
 try{
  const buf=await file.arrayBuffer();
  const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
  const gltf=await new Promise((res,rej)=>loader.parse(buf,'',res,rej));
  if(vrm)scene.remove(vrm.scene);
  vrm=gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.combineSkeletons(gltf.scene);
  vrm.scene.rotation.y=Math.PI;
  scene.add(vrm.scene);
  const box=new THREE.Box3().setFromObject(vrm.scene),center=new THREE.Vector3();box.getCenter(center);
  vrm.scene.position.x-=center.x;vrm.scene.position.z-=center.z;
  const grounded=new THREE.Box3().setFromObject(vrm.scene);vrm.scene.position.y-=grounded.min.y;
  cacheBones();measureModel();applyBasePose(0,0);setCamera('portrait');
  dropHint.style.display='none';status.textContent=`${file.name}：配信用ポーズで読み込み完了`;updateReady();
 }catch(e){console.error(e);status.textContent='VRMの読み込みに失敗しました。';}
});

audioFile.addEventListener('change',()=>{
 const file=audioFile.files?.[0];if(!file)return;
 if(audio){audio.pause();audio.src='';}
 if(audioUrl)URL.revokeObjectURL(audioUrl);
 audioUrl=URL.createObjectURL(file);audio=new Audio(audioUrl);audio.preload='auto';audio.crossOrigin='anonymous';
 source=null;analyser=null;ctx=null;
 audio.addEventListener('loadedmetadata',()=>{seek.disabled=false;status.textContent=`音声 ${Math.round(audio.duration)}秒 読み込み完了`;updateReady();});
 audio.addEventListener('timeupdate',()=>{if(!audio.seeking&&audio.duration)seek.value=String(Math.round(audio.currentTime/audio.duration*1000));});
 audio.addEventListener('ended',()=>{playBtn.textContent='再生';});
});

bgFile.addEventListener('change',()=>{
 const file=bgFile.files?.[0];if(!file)return;
 if(bgUrl)URL.revokeObjectURL(bgUrl);bgUrl=URL.createObjectURL(file);
 stage.style.backgroundImage=`linear-gradient(rgba(0,0,0,.04),rgba(0,0,0,.10)),url("${bgUrl}")`;
 status.textContent=`背景 ${file.name} を読み込みました`;
});
clearBg.addEventListener('click',()=>{if(bgUrl)URL.revokeObjectURL(bgUrl);bgUrl=null;stage.style.backgroundImage='radial-gradient(circle at 50% 34%,#32323b 0,#17171c 52%,#0b0b0e 100%)';});

function updateReady(){playBtn.disabled=!(vrm&&audio);stopBtn.disabled=!audio;}
async function connectAudio(){
 if(!audio||source)return;
 ctx=new (window.AudioContext||window.webkitAudioContext)();source=ctx.createMediaElementSource(audio);analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.5;
 freq=new Uint8Array(analyser.frequencyBinCount);timeData=new Uint8Array(analyser.fftSize);source.connect(analyser);analyser.connect(ctx.destination);
}
playBtn.addEventListener('click',async()=>{if(!audio||!vrm)return;await connectAudio();if(ctx.state==='suspended')await ctx.resume();if(audio.paused){await audio.play();playBtn.textContent='一時停止';}else{audio.pause();playBtn.textContent='再生';}});
stopBtn.addEventListener('click',()=>{if(!audio)return;audio.pause();audio.currentTime=0;playBtn.textContent='再生';});
seek.addEventListener('input',()=>{if(audio?.duration)audio.currentTime=Number(seek.value)/1000*audio.duration;});
portraitBtn.addEventListener('click',()=>setCamera('portrait'));
fullbodyBtn.addEventListener('click',()=>setCamera('full'));
zoomSlider.addEventListener('input',()=>setCamera(frameMode));
resetBtn.addEventListener('click',()=>{yaw=0;pitch=0;setCamera('portrait');});

canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.005;pitch+=(e.clientY-lastY)*.0025;pitch=Math.max(-.20,Math.min(.20,pitch));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',()=>drag=false);

function audioEnvelope(){
 if(!analyser||!audio||audio.paused)return 0;
 analyser.getByteTimeDomainData(timeData);let sum=0;for(const v of timeData){const x=(v-128)/128;sum+=x*x;}const rms=Math.sqrt(sum/timeData.length);
 analyser.getByteFrequencyData(freq);let speech=0,n=0;const nyquist=(ctx?.sampleRate||48000)/2;for(let i=0;i<freq.length;i++){const hz=i/freq.length*nyquist;if(hz>120&&hz<4200){speech+=freq[i]/255;n++;}}
 const v=Math.min(1,Math.max(0,(rms-.010)*8.3+(n?speech/n*.13:0)));smooth=smooth*.64+v*.36;return smooth;
}

function animate(ms){
 requestAnimationFrame(animate);const t=(audio?.currentTime??ms/1000),env=audioEnvelope();meterBar.style.width=`${Math.round(env*100)}%`;
 if(vrm){
  applyBasePose(t,env);
  const em=vrm.expressionManager;
  const speaking=env>0.025;
  em?.setValue('aa',speaking?Math.min(1,env*.92):0);
  em?.setValue('ih',speaking?Math.max(0,Math.sin(t*14))*env*.22:0);
  em?.setValue('ou',speaking?Math.max(0,Math.sin(t*10+1.1))*env*.17:0);
  em?.setValue('ee',speaking?Math.max(0,Math.sin(t*8+2.2))*env*.09:0);
  const blinkCycle=(ms/1000)%4.5,blink=blinkCycle>4.30?Math.sin((blinkCycle-4.30)/.20*Math.PI):0;em?.setValue('blink',Math.max(0,blink));em?.update();
  vrm.update(1/60);
 }
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
