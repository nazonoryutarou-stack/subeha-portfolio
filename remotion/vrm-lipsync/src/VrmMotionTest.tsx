import React, {useEffect, useRef, useState} from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
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

const smoothstep = (x: number) => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * (3 - 2 * v);
};

const blinkWeight = (frame: number) => {
  const starts = [38, 111, 154];
  for (const start of starts) {
    const d = frame - start;
    if (d >= 0 && d <= 5) {
      const x = d / 5;
      return Math.sin(x * Math.PI);
    }
  }
  return 0;
};

export const VrmMotionTest: React.FC = () => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneState = useRef<SceneState | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('VRM motion test: loading model', {timeoutInMilliseconds: 120000}));

  useEffect(() => {
    if (!canvas.current || sceneState.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas.current,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111318);

    const camera = new THREE.PerspectiveCamera(27, width / height, 0.01, 100);
    camera.position.set(0, 1.49, 3.2);
    camera.lookAt(0, 1.43, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x22252b, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3.7);
    key.position.set(2.3, 3.5, 3.3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xaecbff, 2.3);
    rim.position.set(-3, 2.6, -1.5);
    scene.add(rim);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      staticFile('Subeha.vrm'),
      (gltf: any) => {
        try {
          const vrm: VRM = gltf.userData.vrm;
          if (!vrm) throw new Error('Subeha.vrm could not be parsed as VRM');

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

  useEffect(() => {
    const s = sceneState.current;
    if (!s?.vrm) return;

    const vrm = s.vrm;
    const t = frame / fps;
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const neck = vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
    const spine = vrm.humanoid?.getNormalizedBoneNode('spine');
    const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');

    const lookLeft = smoothstep((frame - 15) / 30) * (1 - smoothstep((frame - 65) / 28));
    const lookRight = smoothstep((frame - 65) / 28) * (1 - smoothstep((frame - 123) / 30));
    const nod = Math.sin(Math.max(0, frame - 122) * 0.12) * (frame > 122 ? Math.min(1, (frame - 122) / 18) : 0);
    const breathe = Math.sin(t * Math.PI * 1.05);

    if (head) {
      head.rotation.y = -lookLeft * 0.16 + lookRight * 0.17 + Math.sin(t * 0.8) * 0.012;
      head.rotation.x = -0.015 + nod * 0.045 + Math.sin(t * 1.15) * 0.01;
      head.rotation.z = Math.sin(t * 0.62) * 0.018;
    }
    if (neck) {
      neck.rotation.y = -lookLeft * 0.045 + lookRight * 0.05;
      neck.rotation.z = Math.sin(t * 0.55) * 0.009;
    }
    if (chest) {
      chest.rotation.x = breathe * 0.012;
      chest.rotation.y = Math.sin(t * 0.42) * 0.018;
      chest.rotation.z = Math.sin(t * 0.5) * 0.008;
    }
    if (spine) spine.rotation.x = breathe * 0.004;
    if (leftUpperArm) leftUpperArm.rotation.z = -0.03 + Math.sin(t * 0.72) * 0.014;
    if (rightUpperArm) rightUpperArm.rotation.z = 0.03 - Math.sin(t * 0.72) * 0.014;

    vrm.scene.position.y = Math.sin(t * 1.25) * 0.006;

    const em = vrm.expressionManager;
    em?.setValue('blink', blinkWeight(frame));
    em?.setValue('aa', frame > 132 && frame < 160 ? Math.max(0, Math.sin((frame - 132) * 0.33)) * 0.18 : 0);

    vrm.update(1 / fps);
    s.renderer.render(s.scene, s.camera);
  }, [fps, frame, ready]);

  return (
    <AbsoluteFill style={{background: '#111318'}}>
      <canvas ref={canvas} width={width} height={height} style={{width: '100%', height: '100%', display: 'block'}} />
      <div style={{position: 'absolute', left: 28, bottom: 28, color: 'rgba(255,255,255,.46)', fontFamily: 'ui-monospace, monospace', fontSize: 13, letterSpacing: 2}}>
        VRM MOTION TEST / 01
      </div>
      {!ready ? <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', color: '#bbb', fontFamily: 'sans-serif'}}>VRM LOADING</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};
