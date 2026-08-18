import React, {useEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRM, VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';
import {audioEnvelope} from './audioEnvelope';

const W=720,H=1280,FPS=30;

const mouthWeights=(frame:number, level:number)=>{
  const gate=Math.max(0,Math.min(1,(level-.18)/.55));
  if(gate<.035) return {A:0,I:0,U:0,E:0,O:0};
  const phase=Math.floor(frame/3)%5;
  const base=Math.min(.92,.12+gate*.92);
  return {
    A: phase===0||phase===4?base:base*.12,
    I: phase===1?base*.70:0,
    U: phase===2?base*.58:0,
    E: phase===3?base*.68:0,
    O: phase===4?base*.55:0,
  };
};

const blinkWeight=(f:number)=>{
  const cycle=f%137;
  if(cycle===0||cycle===4) return .35;
  if(cycle===1||cycle===3) return .8;
  if(cycle===2) return 1;
  return 0;
};

export const VrmLipSync:React.FC=()=>{
  const frame=useCurrentFrame();
  const canvas=useRef<HTMLCanvasElement>(null);
  const state=useRef<any>(null);
  const [ready,setReady]=useState(false);
  const level=audioEnvelope[Math.min(frame,audioEnvelope.length-1)] ?? 0;

  useEffect(()=>{
    if(!canvas.current || state.current) return;
    const renderer=new THREE.WebGLRenderer({canvas:canvas.current,antialias:true,alpha:true,preserveDrawingBuffer:true});
    renderer.setSize(W,H,false); renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x111318);
    const camera=new THREE.PerspectiveCamera(27,W/H,.01,100); camera.position.set(0,1.48,3.15); camera.lookAt(0,1.42,0);
    scene.add(new THREE.HemisphereLight(0xffffff,0x23252b,2.5));
    const key=new THREE.DirectionalLight(0xffffff,3.6); key.position.set(2.2,3.4,3.2); scene.add(key);
    const rim=new THREE.DirectionalLight(0xb8d9ff,2.4); rim.position.set(-3,2.5,-1.5); scene.add(rim);
    const loader=new GLTFLoader(); loader.register((parser)=>new VRMLoaderPlugin(parser));
    loader.load(staticFile('Subeha.vrm'),(gltf:any)=>{
      const vrm:VRM=gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.combineMorphs(vrm);
      VRMUtils.rotateVRM0(vrm);
      scene.add(vrm.scene);
      const box=new THREE.Box3().setFromObject(vrm.scene); const size=new THREE.Vector3(); const center=new THREE.Vector3(); box.getSize(size); box.getCenter(center);
      const targetHeight=2.35; const scale=targetHeight/(size.y||1); vrm.scene.scale.setScalar(scale);
      const box2=new THREE.Box3().setFromObject(vrm.scene); const c2=new THREE.Vector3(); box2.getCenter(c2); vrm.scene.position.x-=c2.x; vrm.scene.position.z-=c2.z;
      state.current={renderer,scene,camera,vrm}; setReady(true);
    });
    return()=>{renderer.dispose(); state.current=null;};
  },[]);

  useEffect(()=>{
    const s=state.current; if(!s?.vrm) return;
    const vrm:VRM=s.vrm; const em=vrm.expressionManager;
    const m=mouthWeights(frame,level);
    em?.setValue('aa',m.A); em?.setValue('ih',m.I); em?.setValue('ou',m.U); em?.setValue('ee',m.E); em?.setValue('oh',m.O);
    const blink=blinkWeight(frame); em?.setValue('blink',blink);
    const head=vrm.humanoid?.getNormalizedBoneNode('head'); const neck=vrm.humanoid?.getNormalizedBoneNode('neck'); const chest=vrm.humanoid?.getNormalizedBoneNode('chest');
    const speech=Math.max(0,(level-.18));
    if(head){head.rotation.x=Math.sin(frame*.055)*.018-speech*.025; head.rotation.y=Math.sin(frame*.023)*.035; head.rotation.z=Math.sin(frame*.031)*.012;}
    if(neck){neck.rotation.y=Math.sin(frame*.019)*.018;}
    if(chest){chest.rotation.x=Math.sin(frame*.032)*.007+speech*.010; chest.rotation.z=Math.sin(frame*.017)*.009;}
    vrm.scene.position.y=Math.sin(frame*.025)*.005;
    vrm.update(1/FPS); s.renderer.render(s.scene,s.camera);
  },[frame,level,ready]);

  const meter=Math.round(level*100);
  return <AbsoluteFill style={{background:'#111318'}}>
    <Audio src={staticFile('voice.m4a')} volume={1}/>
    <canvas ref={canvas} width={W} height={H} style={{width:'100%',height:'100%',display:'block'}}/>
    {!ready && <AbsoluteFill style={{alignItems:'center',justifyContent:'center',color:'#ddd',fontFamily:'sans-serif'}}>VRM LOADING</AbsoluteFill>}
    <div style={{position:'absolute',left:26,bottom:26,color:'rgba(255,255,255,.55)',fontFamily:'ui-monospace,monospace',fontSize:13,letterSpacing:2}}>AUDIO DRIVE {meter.toString().padStart(3,'0')}</div>
  </AbsoluteFill>;
};
