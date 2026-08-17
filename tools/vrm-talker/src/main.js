import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';

const canvas=document.getElementById('c');
const stage=document.getElementById('stage');
const vrmFile=document.getElementById('vrmFile');
const audioFile=document.getElementById('audioFile');
const playBtn=document.getElementById('play');
const stopBtn=document.getElementById('stop');
const resetBtn=document.getElementById('reset');
const seek=document.getElementById('seek');
const status=document.getElementById('status');
const meterBar=document.getElementById('meterBar');
const dropHint=document.getElementById('dropHint');

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(25,1,.1,100);
camera.position.set(0,1.45,4.2);
scene.add(new THREE.HemisphereLight(0xffffff,0x22222a,2.5));
const key=new THREE.DirectionalLight(0xffffff,3.4);key.position.set(2.5,4,4);scene.add(key);
const rim=new THREE.DirectionalLight(0xaab7ff,1.8);rim.position.set(-3,2,-3);scene.add(rim);

let vrm=null;
let audio=null;
let audioUrl=null;
let ctx=null, source=null, analyser=null, freq=null, timeData=null;
let smooth=0;
let yaw=0,pitch=0,drag=false,lastX=0,lastY=0;

const resize=()=>{
 const r=stage.getBoundingClientRect(); const dpr=Math.min(devicePixelRatio||1,2);
 renderer.setPixelRatio(dpr); renderer.setSize(r.width,r.height,false);
 camera.aspect=r.width/r.height; camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(stage);resize();

const frameModel=()=>{
 if(!vrm)return;
 const box=new THREE.Box3().setFromObject(vrm.scene);const size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);
 vrm.scene.position.x-=center.x;vrm.scene.position.z-=center.z;vrm.scene.position.y-=box.min.y;
 const h=Math.max(size.y,0.1);camera.position.set(0,h*.58,h*1.72);camera.lookAt(0,h*.58,0);
};

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
  vrm.scene.rotation.y=Math.PI;scene.add(vrm.scene);frameModel();
  dropHint.style.display='none'; status.textContent=`${file.name} 読み込み完了`;
  updateReady();
 }catch(e){console.error(e);status.textContent='VRMの読み込みに失敗しました。';}
});

audioFile.addEventListener('change',async()=>{
 const file=audioFile.files?.[0];if(!file)return;
 if(audio){audio.pause();audio.src='';}
 if(audioUrl)URL.revokeObjectURL(audioUrl);
 audioUrl=URL.createObjectURL(file);audio=new Audio(audioUrl);audio.preload='auto';audio.crossOrigin='anonymous';
 audio.addEventListener('loadedmetadata',()=>{seek.disabled=false;status.textContent=`音声 ${Math.round(audio.duration)}秒 読み込み完了`;updateReady();});
 audio.addEventListener('timeupdate',()=>{if(!audio.seeking&&audio.duration)seek.value=String(Math.round(audio.currentTime/audio.duration*1000));});
 audio.addEventListener('ended',()=>{playBtn.textContent='再生';});
});

function updateReady(){playBtn.disabled=!(vrm&&audio);stopBtn.disabled=!audio;}

async function connectAudio(){
 if(!audio||source)return;
 ctx=new (window.AudioContext||window.webkitAudioContext)();
 source=ctx.createMediaElementSource(audio);analyser=ctx.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.55;
 freq=new Uint8Array(analyser.frequencyBinCount);timeData=new Uint8Array(analyser.fftSize);
 source.connect(analyser);analyser.connect(ctx.destination);
}

playBtn.addEventListener('click',async()=>{
 if(!audio||!vrm)return;await connectAudio();if(ctx.state==='suspended')await ctx.resume();
 if(audio.paused){await audio.play();playBtn.textContent='一時停止';}else{audio.pause();playBtn.textContent='再生';}
});
stopBtn.addEventListener('click',()=>{if(!audio)return;audio.pause();audio.currentTime=0;playBtn.textContent='再生';});
seek.addEventListener('input',()=>{if(audio?.duration)audio.currentTime=Number(seek.value)/1000*audio.duration;});
resetBtn.addEventListener('click',()=>{yaw=0;pitch=0;});

canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lastX)*.006;pitch+=(e.clientY-lastY)*.003;pitch=Math.max(-.25,Math.min(.25,pitch));lastX=e.clientX;lastY=e.clientY});
canvas.addEventListener('pointerup',()=>drag=false);

function audioEnvelope(){
 if(!analyser||!audio||audio.paused)return 0;
 analyser.getByteTimeDomainData(timeData);let sum=0;for(const v of timeData){const x=(v-128)/128;sum+=x*x;}const rms=Math.sqrt(sum/timeData.length);
 analyser.getByteFrequencyData(freq);let speech=0,n=0;const nyquist=(ctx?.sampleRate||48000)/2;for(let i=0;i<freq.length;i++){const hz=i/freq.length*nyquist;if(hz>120&&hz<4200){speech+=freq[i]/255;n++;}}
 const v=Math.min(1,Math.max(0,(rms-.012)*7.5+(n?speech/n*.15:0)));smooth=smooth*.68+v*.32;return smooth;
}

function animate(t){
 requestAnimationFrame(animate);const env=audioEnvelope();meterBar.style.width=`${Math.round(env*100)}%`;
 if(vrm){
  const em=vrm.expressionManager;
  const phase=audio?.currentTime||t/1000;
  em?.setValue('aa',Math.min(1,env*.95));
  em?.setValue('ih',Math.max(0,Math.sin(phase*14))*env*.24);
  em?.setValue('ou',Math.max(0,Math.sin(phase*10+1.1))*env*.18);
  em?.setValue('ee',Math.max(0,Math.sin(phase*8+2.2))*env*.10);
  const blinkPhase=(t/1000)%4.3;const blink=blinkPhase>4.14?Math.sin((blinkPhase-4.14)/.16*Math.PI):0;em?.setValue('blink',Math.max(0,blink));em?.update();
  const head=vrm.humanoid?.getNormalizedBoneNode('head'),neck=vrm.humanoid?.getNormalizedBoneNode('neck'),chest=vrm.humanoid?.getNormalizedBoneNode('chest');
  if(head){head.rotation.y=yaw+Math.sin(phase*.75)*.045;head.rotation.x=pitch+Math.sin(phase*.53)*.018-env*.025;}
  if(neck)neck.rotation.z=Math.sin(phase*.42)*.018;
  if(chest){chest.rotation.y=Math.sin(phase*.31)*.018;chest.rotation.x=env*.018;}
  vrm.update(1/60);
 }
 renderer.render(scene,camera);
}
requestAnimationFrame(animate);
