import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AbsoluteFill,staticFile,useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRM,VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {backupMeta,mouthFrames,timingParts} from './generatedTimeline';
import {Viseme,visemeForTimedText} from './viseme';

const W=720,H=1280,FPS=30;

const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));

const mouthAt=(ms:number)=>{
  if(!mouthFrames.length) return {open:0,voiced:false};
  const hop=mouthFrames.length>1?Math.max(1,mouthFrames[1].tMs-mouthFrames[0].tMs):10;
  const i=clamp(Math.round(ms/hop),0,mouthFrames.length-1);
  return mouthFrames[Math.floor(i)]??{open:0,voiced:false};
};

const activePartAt=(ms:number)=>{
  let lo=0,hi=timingParts.length-1,best=-1;
  while(lo<=hi){
    const mid=(lo+hi)>>1;
    if(timingParts[mid].startMs<=ms){best=mid;lo=mid+1}else hi=mid-1;
  }
  if(best<0) return null;
  const p=timingParts[best];
  return ms<p.endMs?p:null;
};

const visemeWeights=(v:Viseme|null,open:number)=>{
  const level=clamp((open-.045)/.88);
  const out={aa:0,ih:0,ou:0,ee:0,oh:0};
  if(level<.015) return out;
  const key=v??'aa';
  out[key]=level;
  if(key!=='aa') out.aa=level*.08;
  return out;
};

const subtitleWindow=(ms:number)=>{
  if(!timingParts.length) return [];
  const active=activePartAt(ms);
  const pivot=active?timingParts.indexOf(active):timingParts.findIndex(p=>p.startMs>ms);
  const start=Math.max(0,(pivot<0?timingParts.length-1:pivot)-4);
  const out=[];
  let chars=0;
  for(let i=start;i<timingParts.length;i++){
    const p=timingParts[i];
    if(p.startMs>ms+1600) break;
    if(p.endMs<ms-2200) continue;
    if(chars+p.text.length>34&&out.length) break;
    out.push(p); chars+=p.text.length;
  }
  return out;
};

const blinkWeight=(f:number)=>{
  const c=f%143;
  if(c===0||c===4)return .32;
  if(c===1||c===3)return .78;
  if(c===2)return 1;
  return 0;
};

export const VrmLipSyncBackup:React.FC=()=>{
  const frame=useCurrentFrame();
  const ms=frame/FPS*1000;
  const canvas=useRef<HTMLCanvasElement>(null);
  const state=useRef<any>(null);
  const [ready,setReady]=useState(false);

  const mouth=mouthAt(ms);
  const active=activePartAt(ms);
  const progress=active?clamp((ms-active.startMs)/Math.max(1,active.endMs-active.startMs)):0;
  const viseme=active?visemeForTimedText(active.text,progress):null;
  const weights=visemeWeights(viseme,mouth.open);
  const subs=useMemo(()=>subtitleWindow(ms),[Math.floor(ms/80)]);

  useEffect(()=>{
    if(!canvas.current||state.current)return;
    const renderer=new THREE.WebGLRenderer({canvas:canvas.current,antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setSize(W,H,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x111318);
    const camera=new THREE.PerspectiveCamera(27,W/H,.01,100);camera.position.set(0,1.48,3.15);camera.lookAt(0,1.42,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x23252b,2.5));
    const key=new THREE.DirectionalLight(0xffffff,3.6);key.position.set(2.2,3.4,3.2);scene.add(key);
    const rim=new THREE.DirectionalLight(0xb8d9ff,2.4);rim.position.set(-3,2.5,-1.5);scene.add(rim);
    const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
    loader.load(staticFile('Subeha.vrm'),(gltf:any)=>{
      const vrm:VRM=gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.combineSkeletons(gltf.scene);VRMUtils.combineMorphs(vrm);
      VRMUtils.rotateVRM0(vrm);scene.add(vrm.scene);
      const box=new THREE.Box3().setFromObject(vrm.scene),size=new THREE.Vector3();box.getSize(size);
      vrm.scene.scale.setScalar(2.35/(size.y||1));
      const box2=new THREE.Box3().setFromObject(vrm.scene),c2=new THREE.Vector3();box2.getCenter(c2);
      vrm.scene.position.x-=c2.x;vrm.scene.position.z-=c2.z;
      state.current={renderer,scene,camera,vrm};setReady(true);
    });
    return()=>{renderer.dispose();state.current=null};
  },[]);

  useEffect(()=>{
    const s=state.current;if(!s?.vrm)return;
    const vrm:VRM=s.vrm,em=vrm.expressionManager;
    em?.setValue('aa',weights.aa);em?.setValue('ih',weights.ih);em?.setValue('ou',weights.ou);em?.setValue('ee',weights.ee);em?.setValue('oh',weights.oh);
    em?.setValue('blink',blinkWeight(frame));
    const speech=mouth.voiced?mouth.open:0;
    const head=vrm.humanoid?.getNormalizedBoneNode('head');
    const neck=vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest=vrm.humanoid?.getNormalizedBoneNode('chest');
    if(head){head.rotation.x=Math.sin(frame*.055)*.014-speech*.020;head.rotation.y=Math.sin(frame*.023)*.03;head.rotation.z=Math.sin(frame*.031)*.010}
    if(neck)neck.rotation.y=Math.sin(frame*.019)*.014;
    if(chest){chest.rotation.x=Math.sin(frame*.032)*.006+speech*.008;chest.rotation.z=Math.sin(frame*.017)*.007}
    vrm.scene.position.y=Math.sin(frame*.025)*.004;
    vrm.update(1/FPS);s.renderer.render(s.scene,s.camera);
  },[frame,mouth.open,mouth.voiced,weights.aa,weights.ih,weights.ou,weights.ee,weights.oh,ready]);

  return <AbsoluteFill style={{background:'#111318'}}>
    <Audio src={staticFile('voice.m4a')} volume={1}/>
    <canvas ref={canvas} width={W} height={H} style={{width:'100%',height:'100%',display:'block'}}/>
    {!ready&&<AbsoluteFill style={{alignItems:'center',justifyContent:'center',color:'#ddd',fontFamily:'sans-serif'}}>VRM LOADING</AbsoluteFill>}
    <div style={{position:'absolute',left:28,right:28,bottom:64,padding:'16px 18px',background:'rgba(0,0,0,.60)',borderRadius:14,color:'white',fontFamily:'sans-serif',fontSize:32,lineHeight:1.45,textAlign:'center',textShadow:'0 2px 5px #000'}}>
      {subs.length?subs.map((p,i)=><React.Fragment key={p.startMs+'-'+i}><span style={{color:active===p?'#fff':'rgba(255,255,255,.58)',fontWeight:active===p?800:500}}>{p.text}</span></React.Fragment>):<span style={{opacity:.35}}>字幕タイムライン未投入</span>}
    </div>
    <div style={{position:'absolute',left:22,top:22,color:'rgba(255,255,255,.55)',fontFamily:'ui-monospace,monospace',fontSize:12,letterSpacing:1.5}}>BACKUP ENGINE · {backupMeta.source}</div>
    <div style={{position:'absolute',left:22,bottom:20,color:'rgba(255,255,255,.48)',fontFamily:'ui-monospace,monospace',fontSize:12}}>MOUTH {Math.round(mouth.open*100).toString().padStart(3,'0')} · {viseme??'fallback-aa'}</div>
  </AbsoluteFill>;
};
