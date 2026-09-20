import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {AbsoluteFill,staticFile,useCurrentFrame,useDelayRender,useVideoConfig,interpolate} from 'remotion';
import {Audio} from '@remotion/media';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRM,VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {backupMeta,mouthFrames,timingParts} from './generatedTimeline';
import {Viseme,visemeForTimedText} from './viseme';

const FPS=30;
const sans='"Noto Sans CJK JP","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
const mono='"IBM Plex Mono","Noto Sans Mono CJK JP",ui-monospace,monospace';

const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));

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
  if(level<.015)return out;
  const key=v??'aa';
  out[key]=level;
  if(key!=='aa')out.aa=level*.08;
  return out;
};

const subtitleWindow=(ms:number)=>{
  if(!timingParts.length)return [];
  const active=activePartAt(ms);
  const pivot=active?timingParts.indexOf(active):timingParts.findIndex(p=>p.startMs>ms);
  const start=Math.max(0,(pivot<0?timingParts.length-1:pivot)-4);
  const out=[];let chars=0;
  for(let i=start;i<timingParts.length;i++){
    const p=timingParts[i];
    if(p.startMs>ms+1600)break;
    if(p.endMs<ms-2200)continue;
    if(chars+p.text.length>34&&out.length)break;
    out.push(p);chars+=p.text.length;
  }
  return out;
};

const blinkWeight=(f:number)=>{
  const c=f%137;
  if(c===0||c===4)return .35;
  if(c===1||c===3)return .8;
  if(c===2)return 1;
  return 0;
};

const applyNaturalPose=(vrm:VRM)=>{
  // Golden baseline idle pose.
  // Keep the shoulders down, bend the elbows slightly toward the body,
  // add a small torso bias and avoid the mannequin-perfect left/right symmetry.
  const hips=vrm.humanoid?.getNormalizedBoneNode('hips');
  const spine=vrm.humanoid?.getNormalizedBoneNode('spine');
  const chest=vrm.humanoid?.getNormalizedBoneNode('chest');
  const upperChest=vrm.humanoid?.getNormalizedBoneNode('upperChest');
  const ls=vrm.humanoid?.getNormalizedBoneNode('leftShoulder');
  const rs=vrm.humanoid?.getNormalizedBoneNode('rightShoulder');
  const la=vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
  const ra=vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
  const lla=vrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
  const rla=vrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
  const lh=vrm.humanoid?.getNormalizedBoneNode('leftHand');
  const rh=vrm.humanoid?.getNormalizedBoneNode('rightHand');

  if(hips){hips.rotation.y=-.018;hips.rotation.z=.006}
  if(spine){spine.rotation.y=.018;spine.rotation.z=-.006}
  if(chest){chest.rotation.y=.024;chest.rotation.z=-.010}
  if(upperChest){upperChest.rotation.x=-.012;upperChest.rotation.y=-.018}

  if(ls){ls.rotation.z=-.055;ls.rotation.y=-.018}
  if(rs){rs.rotation.z=.045;rs.rotation.y=.014}

  if(la){
    la.rotation.z=-Math.PI*.405;
    la.rotation.x=-.085;
    la.rotation.y=-.045;
  }
  if(ra){
    ra.rotation.z=Math.PI*.392;
    ra.rotation.x=-.055;
    ra.rotation.y=.028;
  }

  if(lla){
    lla.rotation.y=-.26;
    lla.rotation.z=.055;
  }
  if(rla){
    rla.rotation.y=.22;
    rla.rotation.z=-.075;
  }

  if(lh){lh.rotation.z=.065;lh.rotation.y=-.025}
  if(rh){rh.rotation.z=-.045;rh.rotation.y=.018}
};

export const VrmLipSyncBackup:React.FC=()=>{
  const frame=useCurrentFrame();
  const {width,height,fps}=useVideoConfig();
  const ms=frame/fps*1000;
  const canvas=useRef<HTMLCanvasElement>(null);
  const state=useRef<any>(null);
  const [ready,setReady]=useState(false);
  const {delayRender,continueRender,cancelRender}=useDelayRender();
  const [vrmLoadHandle]=useState(()=>delayRender('Loading Subeha.vrm for backup render'));

  const mouth=mouthFrames.length
    ?(mouthFrames[Math.min(frame,mouthFrames.length-1)]??{open:0,voiced:false})
    :{open:0,voiced:false};
  const active=activePartAt(ms);
  const progress=active?clamp((ms-active.startMs)/Math.max(1,active.endMs-active.startMs)):0;
  const viseme=active?visemeForTimedText(active.text,progress):null;
  const weights=visemeWeights(viseme,mouth.open);
  const subs=useMemo(()=>subtitleWindow(ms),[Math.floor(ms/80)]);
  const landscape=width>height;

  useEffect(()=>{
    if(!canvas.current||state.current)return;

    const renderer=new THREE.WebGLRenderer({canvas:canvas.current,antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setSize(width,height,false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.07;

    const scene=new THREE.Scene();
    scene.background=new THREE.Color(0x0b0e13);

    const camera=new THREE.PerspectiveCamera(27,width/height,.01,100);
    scene.add(new THREE.HemisphereLight(0xffffff,0x1c2027,2.5));
    const key=new THREE.DirectionalLight(0xfff6e9,3.8);key.position.set(2.4,3.4,3.3);scene.add(key);
    const rim=new THREE.DirectionalLight(0xa7d8ff,2.1);rim.position.set(-3.2,2.8,-1.5);scene.add(rim);

    const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
    loader.load(staticFile('Subeha.vrm'),(gltf:any)=>{
      try{
        const vrm:VRM=gltf.userData.vrm;
        if(!vrm)throw new Error('Subeha.vrm is not VRM');

        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        if(vrm.meta.metaVersion==='0')VRMUtils.rotateVRM0(vrm);
        scene.add(vrm.scene);

        const box=new THREE.Box3().setFromObject(vrm.scene),size=new THREE.Vector3();box.getSize(size);
        vrm.scene.scale.setScalar(2.35/(size.y||1));
        const b2=new THREE.Box3().setFromObject(vrm.scene),center=new THREE.Vector3();b2.getCenter(center);
        vrm.scene.position.x-=center.x;vrm.scene.position.z-=center.z;

        const framed=new THREE.Box3().setFromObject(vrm.scene),fs=new THREE.Vector3();framed.getSize(fs);
        const targetHeight=fs.y*(landscape?.47:.84);
        const targetCenterY=framed.max.y-targetHeight*(landscape?.53:.56)-fs.y*.01;
        const halfFov=THREE.MathUtils.degToRad(camera.fov/2);
        const cameraDistance=(targetHeight/2)/Math.tan(halfFov)*(landscape?1.04:1.10);

        if(landscape){
          const horizontalSpan=2*cameraDistance*Math.tan(halfFov)*(width/height);
          const leftZoneCenter=.45/2;
          vrm.scene.position.x+=(leftZoneCenter-.5)*horizontalSpan;
        }

        camera.position.set(0,targetCenterY,cameraDistance);
        camera.lookAt(0,targetCenterY,0);

        applyNaturalPose(vrm);
        vrm.update(0);
        renderer.render(scene,camera);
        state.current={renderer,scene,camera,vrm};
        setReady(true);
        continueRender(vrmLoadHandle);
      }catch(err){
        cancelRender(err instanceof Error?err:new Error(String(err)));
      }
    },undefined,(err)=>cancelRender(err instanceof Error?err:new Error(String(err))));

    return()=>{renderer.dispose();state.current=null};
  },[cancelRender,continueRender,height,landscape,vrmLoadHandle,width]);

  useLayoutEffect(()=>{
    const s=state.current;if(!s?.vrm)return;
    const vrm:VRM=s.vrm,em=vrm.expressionManager;
    em?.setValue('aa',weights.aa);em?.setValue('ih',weights.ih);em?.setValue('ou',weights.ou);
    em?.setValue('ee',weights.ee);em?.setValue('oh',weights.oh);em?.setValue('blink',blinkWeight(frame));

    const speech=mouth.voiced?mouth.open:0;
    const head=vrm.humanoid?.getNormalizedBoneNode('head');
    const neck=vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest=vrm.humanoid?.getNormalizedBoneNode('chest');

    if(head){
      head.rotation.x=Math.sin(frame*.055)*.019-speech*.045;
      head.rotation.y=Math.sin(frame*.023)*.038;
      head.rotation.z=Math.sin(frame*.031)*.013;
    }
    if(neck)neck.rotation.y=Math.sin(frame*.019)*.020;
    if(chest){
      chest.rotation.x=Math.sin(frame*.032)*.008+speech*.015;
      chest.rotation.z=Math.sin(frame*.017)*.010;
    }
    vrm.scene.position.y=Math.sin(frame*.025)*.005;

    vrm.update(1/FPS);
    s.renderer.render(s.scene,s.camera);
  },[frame,mouth.open,mouth.voiced,weights.aa,weights.ih,weights.ou,weights.ee,weights.oh,ready]);

  const titleOpacity=interpolate(frame,[0,9,92,108],[0,1,1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const activeRetimed=Boolean((active as any)?.timingMode==='segment-retimed');

  return <AbsoluteFill style={{background:'#0b0e13',overflow:'hidden'}}>
    <Audio src={staticFile('voice.m4a')} volume={1}/>
    <canvas ref={canvas} width={width} height={height} style={{width:'100%',height:'100%',display:'block'}}/>

    {landscape?<>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(90deg,rgba(7,9,13,.08) 0%,rgba(7,9,13,.02) 41%,rgba(7,9,13,.22) 49%,rgba(7,9,13,.38) 100%)'}}/>
      <div style={{position:'absolute',left:32,top:28,width:430,height:1,background:'linear-gradient(90deg,#d2aa62,rgba(210,170,98,0))'}}/>
      <div style={{position:'absolute',left:32,top:40,color:'#d2aa62',fontFamily:mono,fontSize:12,letterSpacing:'.18em'}}>GRAVITY ARCHIVE / BACKUP ENGINE</div>
      <div style={{position:'absolute',left:32,top:88,width:500,opacity:titleOpacity,color:'#f5f3ee',fontFamily:sans,fontWeight:760,fontSize:27,lineHeight:1.25}}>配信165 / TIMING VALIDATION</div>
      <div style={{position:'absolute',left:'43%',top:108,bottom:126,width:1,background:'linear-gradient(transparent,rgba(210,170,98,.28) 18%,rgba(210,170,98,.28) 82%,transparent)'}}/>
    </>:null}

    {!ready?<AbsoluteFill style={{alignItems:'center',justifyContent:'center',color:'#ddd',fontFamily:sans}}>VRM LOADING</AbsoluteFill>:null}

    <div style={{position:'absolute',left:landscape?48:28,right:landscape?48:28,bottom:landscape?34:120,display:'flex',justifyContent:'center',pointerEvents:'none'}}>
      <div style={{maxWidth:landscape?1040:width-56,padding:landscape?'12px 24px 13px':'16px 22px',border:'1px solid rgba(210,170,98,.28)',borderRadius:14,background:'linear-gradient(180deg,rgba(15,17,22,.78),rgba(9,11,15,.91))',boxShadow:'0 12px 38px rgba(0,0,0,.38), inset 0 1px rgba(255,255,255,.035)',color:'#f8f7f4',fontFamily:sans,fontWeight:750,fontSize:landscape?38:46,lineHeight:1.32,textAlign:'center',textShadow:'0 2px 9px rgba(0,0,0,.72)',whiteSpace:'pre-wrap'}}>
        {subs.length?subs.map((p,i)=><React.Fragment key={p.startMs+'-'+i}><span style={{color:active===p?'#fff':'rgba(255,255,255,.52)',fontWeight:active===p?800:600}}>{p.text}</span></React.Fragment>):<span style={{opacity:.35}}>字幕タイムライン未投入</span>}
      </div>
    </div>

    <div style={{position:'absolute',left:32,bottom:14,color:'rgba(255,255,255,.42)',fontFamily:mono,fontSize:10,letterSpacing:1.5}}>
      MOUTH {Math.round(mouth.open*100).toString().padStart(3,'0')} / {viseme??'fallback-aa'}{activeRetimed?' / RETIMED':''}
    </div>
  </AbsoluteFill>;
};
