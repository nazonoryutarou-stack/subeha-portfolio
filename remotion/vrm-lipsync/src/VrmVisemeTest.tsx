import React, {useEffect, useRef, useState} from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRM, VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';

const W = 720;
const H = 1280;
const FPS = 30;

const mouthForFrame = (frame:number) => {
  // 0-29: closed. Then hold each native VRM viseme long enough for QC frames.
  if (frame < 30) return {name:'neutral', value:0};
  const names = ['aa','ih','ou','ee','oh'] as const;
  const i = Math.min(names.length - 1, Math.floor((frame - 30) / 30));
  return {name:names[i], value:0.92};
};

export const VrmVisemeTest:React.FC = () => {
  const frame = useCurrentFrame();
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvas.current || state.current) return;
    const renderer = new THREE.WebGLRenderer({canvas:canvas.current, antialias:true, alpha:true, preserveDrawingBuffer:true});
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111318);
    const camera = new THREE.PerspectiveCamera(24, W/H, 0.01, 100);
    camera.position.set(0, 1.48, 3.0);
    camera.lookAt(0, 1.43, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x23252b, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(2.2, 3.4, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8d9ff, 2.0);
    rim.position.set(-3, 2.5, -1.5);
    scene.add(rim);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(staticFile('Subeha.vrm'), (gltf:any) => {
      const vrm:VRM = gltf.userData.vrm;
      VRMUtils.removeUnnecessaryVertices?.(gltf.scene);
      VRMUtils.combineSkeletons?.(gltf.scene);
      VRMUtils.rotateVRM0?.(vrm);
      scene.add(vrm.scene);

      const box = new THREE.Box3().setFromObject(vrm.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      const targetHeight = 2.35;
      vrm.scene.scale.setScalar(targetHeight / (size.y || 1));
      const box2 = new THREE.Box3().setFromObject(vrm.scene);
      const c2 = new THREE.Vector3();
      box2.getCenter(c2);
      vrm.scene.position.x -= c2.x;
      vrm.scene.position.z -= c2.z;

      const bone = (name:any) => vrm.humanoid?.getNormalizedBoneNode(name);
      const setRot = (name:any, x:number, y:number, z:number) => {
        const b = bone(name);
        if (b) b.rotation.set(x,y,z);
      };
      // Natural presenter pose copied from the working website viewer, not T-pose.
      setRot('hips', 0.02, -0.06, 0.035);
      setRot('spine', 0.015, 0.035, -0.025);
      setRot('chest', -0.03, -0.025, 0.025);
      setRot('upperChest', -0.015, 0.02, 0.012);
      setRot('neck', 0.02, 0, -0.012);
      setRot('head', -0.035, 0.035, 0.02);
      setRot('leftShoulder', 0.03, 0, -0.2);
      setRot('rightShoulder', 0.03, 0, 0.17);
      setRot('leftUpperArm', 0.10, 0.06, -1.05);
      setRot('rightUpperArm', -0.06, -0.05, 0.95);
      setRot('leftLowerArm', -0.28, 0.04, -0.12);
      setRot('rightLowerArm', -0.34, -0.04, 0.10);

      state.current = {renderer, scene, camera, vrm};
      setReady(true);
    });

    return () => {
      renderer.dispose();
      state.current = null;
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!s?.vrm) return;
    const vrm:VRM = s.vrm;
    const em = vrm.expressionManager;
    for (const name of ['aa','ih','ou','ee','oh']) em?.setValue(name, 0);
    const m = mouthForFrame(frame);
    if (m.name !== 'neutral') em?.setValue(m.name, m.value);
    em?.setValue('blink', frame % 137 === 2 ? 1 : 0);

    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    if (head) {
      head.rotation.y += Math.sin(frame * 0.035) * 0.002;
      head.rotation.x += Math.sin(frame * 0.055) * 0.001;
    }
    vrm.update(1/FPS);
    s.renderer.render(s.scene, s.camera);
  }, [frame, ready]);

  const m = mouthForFrame(frame);
  return <AbsoluteFill style={{background:'#111318'}}>
    <canvas ref={canvas} width={W} height={H} style={{width:'100%',height:'100%',display:'block'}} />
    {!ready && <AbsoluteFill style={{alignItems:'center',justifyContent:'center',color:'#ddd',fontFamily:'sans-serif'}}>VRM LOADING</AbsoluteFill>}
    <div style={{position:'absolute',left:24,bottom:24,color:'white',fontFamily:'sans-serif',fontSize:28,fontWeight:800,background:'rgba(0,0,0,.55)',padding:'10px 16px',borderRadius:12}}>
      VISEME: {m.name}
    </div>
  </AbsoluteFill>;
};
