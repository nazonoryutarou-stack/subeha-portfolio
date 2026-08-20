import React, {useEffect, useRef, useState} from 'react';
import type {Caption} from '@remotion/captions';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Audio} from '@remotion/media';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRM, VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';

export type VrmLipSyncProps = {
  title: string;
  telop: string;
  modelFile: string;
  audioFile: string;
  envelopeFile: string;
  clipFile: string;
  background: string;
  showMeter: boolean;
};

type EnvelopeFile = {
  version?: number;
  fps?: number;
  durationInFrames?: number;
  values: number[];
};

type ClipFile = {
  version?: number;
  title?: string;
  telop?: string;
  hook?: string;
  sourceLabel?: string;
  startMs?: number;
  endMs?: number;
  durationMs?: number;
  captions?: Caption[];
};

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  vrm: VRM;
};

const mouthWeights = (frame: number, level: number) => {
  const gate = Math.max(0, Math.min(1, (level - 0.08) / 0.72));
  if (gate < 0.035) return {A: 0, I: 0, U: 0, E: 0, O: 0};
  const phase = Math.floor(frame / 3) % 5;
  const base = Math.min(0.92, 0.1 + gate * 0.9);
  return {
    A: phase === 0 || phase === 4 ? base : base * 0.12,
    I: phase === 1 ? base * 0.7 : 0,
    U: phase === 2 ? base * 0.58 : 0,
    E: phase === 3 ? base * 0.68 : 0,
    O: phase === 4 ? base * 0.55 : 0,
  };
};

const blinkWeight = (frame: number) => {
  const cycle = frame % 137;
  if (cycle === 0 || cycle === 4) return 0.35;
  if (cycle === 1 || cycle === 3) return 0.8;
  if (cycle === 2) return 1;
  return 0;
};

export const VrmLipSync: React.FC<VrmLipSyncProps> = ({
  title,
  telop,
  modelFile,
  audioFile,
  envelopeFile,
  clipFile,
  background,
  showMeter,
}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneState = useRef<SceneState | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [envelope, setEnvelope] = useState<number[] | null>(null);
  const [clip, setClip] = useState<ClipFile | null>(null);
  const [modelHandle] = useState(() => delayRender('VRMモデルを読み込み中'));
  const [envelopeHandle] = useState(() => delayRender('口パク波形を読み込み中'));
  const [clipHandle] = useState(() => delayRender('切り抜き情報を読み込み中'));

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(envelopeFile))
      .then(async (response) => {
        if (!response.ok) throw new Error(`public/${envelopeFile} がありません。npm run prepare を実行してください。`);
        return await response.json() as EnvelopeFile;
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data.values) || data.values.length === 0) {
          throw new Error(`${envelopeFile} に口パク波形がありません。`);
        }
        if (data.fps && data.fps !== fps) {
          throw new Error(`${envelopeFile} は ${data.fps}fps 用です。Composition は ${fps}fps です。`);
        }
        setEnvelope(data.values);
        continueRender(envelopeHandle);
      })
      .catch((error) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    return () => {
      cancelled = true;
    };
  }, [envelopeFile, envelopeHandle, fps]);

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(clipFile))
      .then(async (response) => {
        if (!response.ok) throw new Error(`public/${clipFile} がありません。npm run prepare を実行してください。`);
        return await response.json() as ClipFile;
      })
      .then((data) => {
        if (cancelled) return;
        setClip(data);
        continueRender(clipHandle);
      })
      .catch((error) => cancelRender(error instanceof Error ? error : new Error(String(error))));
    return () => {
      cancelled = true;
    };
  }, [clipFile, clipHandle]);

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
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);

    const camera = new THREE.PerspectiveCamera(27, width / height, 0.01, 100);
    camera.position.set(0, 1.48, 3.15);
    camera.lookAt(0, 1.42, 0);

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
      staticFile(modelFile),
      (gltf: any) => {
        try {
          const vrm: VRM = gltf.userData.vrm;
          if (!vrm) throw new Error(`${modelFile} をVRMとして読み込めませんでした。`);

          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
          VRMUtils.combineMorphs(vrm);
          if (vrm.meta.metaVersion === '0') VRMUtils.rotateVRM0(vrm);

          scene.add(vrm.scene);
          const box = new THREE.Box3().setFromObject(vrm.scene);
          const size = new THREE.Vector3();
          box.getSize(size);
          const targetHeight = 2.35;
          const scale = targetHeight / (size.y || 1);
          vrm.scene.scale.setScalar(scale);

          const box2 = new THREE.Box3().setFromObject(vrm.scene);
          const center2 = new THREE.Vector3();
          box2.getCenter(center2);
          vrm.scene.position.x -= center2.x;
          vrm.scene.position.z -= center2.z;

          sceneState.current = {renderer, scene, camera, vrm};
          setModelReady(true);
          continueRender(modelHandle);
        } catch (error) {
          cancelRender(error instanceof Error ? error : new Error(String(error)));
        }
      },
      undefined,
      (error) => cancelRender(error instanceof Error ? error : new Error(`VRM load failed: ${String(error)}`)),
    );

    return () => {
      renderer.dispose();
      sceneState.current = null;
    };
  }, [background, height, modelFile, modelHandle, width]);

  const level = envelope?.[Math.min(frame, envelope.length - 1)] ?? 0;

  useEffect(() => {
    const s = sceneState.current;
    if (!s?.vrm || !envelope) return;

    const vrm = s.vrm;
    const em = vrm.expressionManager;
    const mouth = mouthWeights(frame, level);
    em?.setValue('aa', mouth.A);
    em?.setValue('ih', mouth.I);
    em?.setValue('ou', mouth.U);
    em?.setValue('ee', mouth.E);
    em?.setValue('oh', mouth.O);
    em?.setValue('blink', blinkWeight(frame));

    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const neck = vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
    const speech = Math.max(0, level - 0.08);

    if (head) {
      head.rotation.x = Math.sin(frame * 0.055) * 0.018 - speech * 0.025;
      head.rotation.y = Math.sin(frame * 0.023) * 0.035;
      head.rotation.z = Math.sin(frame * 0.031) * 0.012;
    }
    if (neck) neck.rotation.y = Math.sin(frame * 0.019) * 0.018;
    if (chest) {
      chest.rotation.x = Math.sin(frame * 0.032) * 0.007 + speech * 0.01;
      chest.rotation.z = Math.sin(frame * 0.017) * 0.009;
    }
    vrm.scene.position.y = Math.sin(frame * 0.025) * 0.005;
    vrm.update(1 / fps);
    s.renderer.render(s.scene, s.camera);
  }, [envelope, fps, frame, level, modelReady]);

  const nowMs = (frame / fps) * 1000;
  const currentCaption = clip?.captions?.find((caption) => caption.startMs <= nowMs && caption.endMs > nowMs) ?? null;
  const displayTitle = title || clip?.title || '';
  const displayTelop = currentCaption?.text || telop || clip?.telop || '';
  const displayHook = clip?.hook || '';
  const sourceLabel = clip?.sourceLabel || '';

  const meter = Math.round(level * 100);
  const titleOpacity = interpolate(frame, [0, 10, 90, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hookOpacity = interpolate(frame, [0, 8, 72, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const padX = Math.round(width * 0.055);
  const isLandscape = width > height;
  const base = Math.min(width, height);

  return (
    <AbsoluteFill style={{background}}>
      <Audio src={staticFile(audioFile)} volume={1} />
      <canvas ref={canvas} width={width} height={height} style={{width: '100%', height: '100%', display: 'block'}} />

      {!modelReady && (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', color: '#ddd', fontFamily: 'sans-serif'}}>
          VRM LOADING
        </AbsoluteFill>
      )}

      {sourceLabel ? (
        <div style={{position: 'absolute', top: Math.round(height * 0.022), left: padX, color: 'rgba(255,255,255,.58)', fontFamily: 'ui-monospace, monospace', fontSize: Math.max(11, Math.round(base * 0.017)), letterSpacing: '0.12em'}}>
          {sourceLabel}
        </div>
      ) : null}

      {displayTitle ? (
        <div
          style={{
            position: 'absolute',
            top: Math.round(height * 0.055),
            left: padX,
            right: padX,
            opacity: titleOpacity,
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 900,
            fontSize: Math.round(base * 0.042),
            lineHeight: 1.2,
            letterSpacing: '0.03em',
            textShadow: '0 2px 18px rgba(0,0,0,.7)',
          }}
        >
          {displayTitle}
        </div>
      ) : null}

      {displayHook ? (
        <div style={{position: 'absolute', top: Math.round(height * 0.13), left: padX, right: padX, opacity: hookOpacity, color: 'rgba(255,255,255,.78)', fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: Math.round(base * 0.026), lineHeight: 1.35}}>
          {displayHook}
        </div>
      ) : null}

      {displayTelop ? (
        <div
          style={{
            position: 'absolute',
            left: padX,
            right: padX,
            bottom: Math.round(height * (isLandscape ? 0.075 : 0.11)),
            color: 'white',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 900,
            fontSize: Math.round(base * (isLandscape ? 0.045 : 0.052)),
            lineHeight: 1.35,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            WebkitTextStroke: `${Math.max(2, Math.round(base * 0.004))}px rgba(0,0,0,.9)`,
            paintOrder: 'stroke fill',
            textShadow: '0 3px 14px rgba(0,0,0,.8)',
          }}
        >
          {displayTelop}
        </div>
      ) : null}

      {showMeter ? (
        <div
          style={{
            position: 'absolute',
            left: padX,
            bottom: Math.round(height * 0.025),
            color: 'rgba(255,255,255,.55)',
            fontFamily: 'ui-monospace, monospace',
            fontSize: Math.max(11, Math.round(base * 0.018)),
            letterSpacing: 2,
          }}
        >
          AUDIO DRIVE {meter.toString().padStart(3, '0')}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
