import React,{useEffect,useLayoutEffect,useRef} from 'react';
import {AbsoluteFill,Audio,staticFile,useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';

const pseudoEnvelope=(f:number)=>{
  const t=f/30;
  const syll=Math.abs(Math.sin(t*8.7))*0.55+Math.abs(Math.sin(t*13.1))*0.25;
  const phrase=(Math.sin(t*1.45)+1)/2;
  return Math.min(1,Math.max(0.03,syll*(0.35+phrase*0.65)));
};

export const VrmTalker:React.FC=()=>{
  const frame=useCurrentFrame();
  const canvas=useRef<HTMLCanvasElement>(null);
  const state=useRef<any>(null);

  useLayoutEffect(()=>{
    if(!canvas.current||state.current)return;
    const renderer=new THREE.WebGLRenderer({canvas:canvas.current,antialias:true,preserveDrawingBuffer:true,alpha:true});
    renderer.setSize(720,1280,false); renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x171719);
    const camera=new THREE.PerspectiveCamera(28,720/1280,0.1,100); camera.position.set(0,1.38,4.25);
    scene.add(new THREE.HemisphereLight(0xffffff,0x202025,2.2));
    const key=new THREE.DirectionalLight(0xffffff,3.8); key.position.set(2.5,4,4); scene.add(key);
    const rim=new THREE.DirectionalLight(0xaab8ff,2.0); rim.position.set(-3,2,-2); scene.add(rim);
    const loader=new GLTFLoader(); loader.register(parser=>new VRMLoaderPlugin(parser));
    loader.load(staticFile('Subeha.vrm'),gltf=>{
      const vrm=(gltf.userData as any).vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrm.scene.rotation.y=Math.PI;
      scene.add(vrm.scene);
      state.current={renderer,scene,camera,vrm};
    });
    state.current={renderer,scene,camera,vrm:null};
    return()=>renderer.dispose();
  },[]);

  useEffect(()=>{
    const s=state.current; if(!s?.renderer)return;
    const env=pseudoEnvelope(frame);
    if(s.vrm){
      const e=s.vrm.expressionManager;
      e?.setValue('aa',env*0.82);
      e?.setValue('ih',Math.max(0,Math.sin(frame*0.19))*env*0.22);
      e?.setValue('ou',Math.max(0,Math.sin(frame*0.13+1.2))*env*0.18);
      const blink=(frame%126>118)?Math.sin(((frame%126)-118)/8*Math.PI):0;
      e?.setValue('blink',Math.max(0,blink));
      e?.update();
      const head=s.vrm.humanoid?.getNormalizedBoneNode('head');
      const neck=s.vrm.humanoid?.getNormalizedBoneNode('neck');
      const chest=s.vrm.humanoid?.getNormalizedBoneNode('chest');
      if(head){head.rotation.y=Math.sin(frame/52)*0.07;head.rotation.x=Math.sin(frame/37)*0.025-env*0.018;}
      if(neck){neck.rotation.z=Math.sin(frame/71)*0.025;}
      if(chest){chest.rotation.y=Math.sin(frame/85)*0.025;chest.rotation.x=env*0.015;}
      s.vrm.update(1/30);
    }
    s.renderer.render(s.scene,s.camera);
  },[frame]);

  return <AbsoluteFill style={{background:'#171719'}}>
    <Audio src={staticFile('sample60.mp3')} />
    <canvas ref={canvas} width={720} height={1280} style={{width:'100%',height:'100%'}}/>
    <div style={{position:'absolute',left:28,bottom:28,color:'rgba(255,255,255,.52)',fontFamily:'monospace',fontSize:13,letterSpacing:2}}>VRM TALKER / AUDIO REACTIVE PROTOTYPE</div>
  </AbsoluteFill>;
};
