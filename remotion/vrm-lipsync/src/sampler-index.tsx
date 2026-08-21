import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  AbsoluteFill,
  Composition,
  cancelRender,
  continueRender,
  delayRender,
  registerRoot,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRM, VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  vrm: VRM;
};

const applyNaturalPose = (vrm: VRM) => {
  const bone = (name: any) => vrm.humanoid?.getNormalizedBoneNode(name);
  const leftShoulder = bone('leftShoulder');
  const rightShoulder = bone('rightShoulder');
  const leftUpperArm = bone('leftUpperArm');
  const rightUpperArm = bone('rightUpperArm');
  const leftLowerArm = bone('leftLowerArm');
  const rightLowerArm = bone('rightLowerArm');
  if (leftShoulder) leftShoulder.rotation.z = 0.05;
  if (rightShoulder) rightShoulder.rotation.z = -0.05;
  if (leftUpperArm) {
    leftUpperArm.rotation.z = Math.PI * 0.39;
    leftUpperArm.rotation.x = -0.06;
  }
  if (rightUpperArm) {
    rightUpperArm.rotation.z = -Math.PI * 0.39;
    rightUpperArm.rotation.x = -0.06;
  }
  if (leftLowerArm) {
    leftLowerArm.rotation.y = -0.10;
    leftLowerArm.rotation.z = -0.05;
  }
  if (rightLowerArm) {
    rightLowerArm.rotation.y = 0.10;
    rightLowerArm.rotation.z = 0.05;
  }
};

const Sampler: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneState = useRef<SceneState | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('VRM sampler loading'));

  useEffect(() => {
    if (!canvas.current || sceneState.current) return;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas.current,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111318');

    // Portrait crop: face + upper body, with enough headroom for title overlays.
    const camera = new THREE.PerspectiveCamera(27, width / height, 0.01, 100);
    camera.position.set(0, 1.62, 3.85);
    camera.lookAt(0, 1.62, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x23252b, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3.6);
    key.position.set(2.2, 3.4, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb8d9ff, 2.4);
    rim.position.set(-3, 2.5, -1.5);
    scene.add(rim);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      staticFile('Subeha.vrm'),
      (gltf: any) => {
        try {
          const vrm: VRM = gltf.userData.vrm;
          if (!vrm) throw new Error('Subeha.vrm is not a VRM');
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
          VRMUtils.combineMorphs(vrm);
          if (vrm.meta.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
          scene.add(vrm.scene);

          const box = new THREE.Box3().setFromObject(vrm.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          vrm.scene.scale.setScalar(2.35 / (size.y || 1));
          const box2 = new THREE.Box3().setFromObject(vrm.scene);
          const center = new THREE.Vector3();
          box2.getCenter(center);
          vrm.scene.position.x -= center.x;
          vrm.scene.position.z -= center.z;

          applyNaturalPose(vrm);
          vrm.update(0);
          renderer.render(scene, camera);
          sceneState.current = {renderer, scene, camera, vrm};
          setReady(true);
          continueRender(handle);
        } catch (error) {
          cancelRender(error instanceof Error ? error : new Error(String(error)));
        }
      },
      undefined,
      (error) => cancelRender(error instanceof Error ? error : new Error(String(error))),
    );

    return () => {
      renderer.dispose();
      sceneState.current = null;
    };
  }, [handle, height, width]);

  useLayoutEffect(() => {
    const s = sceneState.current;
    if (!ready || !s) return;
    const {vrm} = s;
    const em = vrm.expressionManager;

    // First second is deliberately quiet/closed. Remaining five seconds sample
    // several vowel shapes. Real-audio assembly chooses the appropriate frames.
    const talking = frame >= fps;
    const phase = Math.floor(Math.max(0, frame - fps) / 2) % 5;
    const pulse = talking ? 0.58 + 0.34 * (0.5 + 0.5 * Math.sin(frame * 0.31)) : 0;
    const aa = talking && (phase === 0 || phase === 4) ? pulse : talking ? pulse * 0.12 : 0;
    const ih = talking && phase === 1 ? pulse * 0.78 : 0;
    const ou = talking && phase === 2 ? pulse * 0.68 : 0;
    const ee = talking && phase === 3 ? pulse * 0.74 : 0;
    const oh = talking && phase === 4 ? pulse * 0.70 : 0;
    em?.setValue('aa', aa);
    em?.setValue('ih', ih);
    em?.setValue('ou', ou);
    em?.setValue('ee', ee);
    em?.setValue('oh', oh);

    const blinkCycle = frame % 137;
    const blink = blinkCycle === 2 ? 1 : blinkCycle === 1 || blinkCycle === 3 ? 0.75 : 0;
    em?.setValue('blink', blink);

    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const neck = vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
    if (head) {
      head.rotation.x = Math.sin(frame * 0.055) * 0.018 - (talking ? 0.018 : 0);
      head.rotation.y = Math.sin(frame * 0.023) * 0.032;
      head.rotation.z = Math.sin(frame * 0.031) * 0.012;
    }
    if (neck) neck.rotation.y = Math.sin(frame * 0.019) * 0.016;
    if (chest) {
      chest.rotation.x = Math.sin(frame * 0.032) * 0.007 + (talking ? 0.006 : 0);
      chest.rotation.z = Math.sin(frame * 0.017) * 0.009;
    }
    vrm.scene.position.y = Math.sin(frame * 0.025) * 0.005;
    vrm.update(1 / fps);
    s.renderer.render(s.scene, s.camera);
  }, [fps, frame, ready]);

  return (
    <AbsoluteFill style={{backgroundColor: '#111318'}}>
      <canvas ref={canvas} width={width} height={height} style={{width: '100%', height: '100%', display: 'block'}} />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <Composition
    id="VrmAvatarSampler"
    component={Sampler}
    durationInFrames={180}
    fps={30}
    width={720}
    height={1280}
  />
);

registerRoot(Root);
