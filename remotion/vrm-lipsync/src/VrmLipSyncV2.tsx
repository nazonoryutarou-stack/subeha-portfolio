import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
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
  fps?: number;
  durationInFrames?: number;
  values: number[];
};

type StudioCaption = Caption & {
  speaker?: 'HOST' | 'GUEST' | 'UNKNOWN' | string;
  speakerConfidence?: number;
  speakerReason?: string;
};

type ClipFile = {
  title?: string;
  telop?: string;
  hook?: string;
  sourceLabel?: string;
  captions?: StudioCaption[];
  layout?: {
    width?: number;
    height?: number;
    captionBottomPx?: number;
  };
};

type SceneState = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  vrm: VRM;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const overlayFontFamily = '"Noto Sans CJK JP","Noto Sans JP","Yu Gothic",system-ui,sans-serif';

const mouthWeights = (frame: number, level: number) => {
  const gate = clamp01((level - 0.025) / 0.48);
  if (gate < 0.02) return {aa: 0, ih: 0, ou: 0, ee: 0, oh: 0};
  const phase = Math.floor(frame / 2) % 5;
  const base = Math.min(1, 0.16 + gate * 0.9);
  return {
    aa: phase === 0 || phase === 4 ? base : base * 0.16,
    ih: phase === 1 ? base * 0.72 : 0,
    ou: phase === 2 ? base * 0.62 : 0,
    ee: phase === 3 ? base * 0.7 : 0,
    oh: phase === 4 ? base * 0.62 : 0,
  };
};

const blinkWeight = (frame: number) => {
  const cycle = frame % 137;
  if (cycle === 0 || cycle === 4) return 0.35;
  if (cycle === 1 || cycle === 3) return 0.8;
  if (cycle === 2) return 1;
  return 0;
};

const applyNaturalPose = (vrm: VRM) => {
  const leftShoulder = vrm.humanoid?.getNormalizedBoneNode('leftShoulder');
  const rightShoulder = vrm.humanoid?.getNormalizedBoneNode('rightShoulder');
  const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
  const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
  const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
  const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm');

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
  if (leftLowerArm) leftLowerArm.rotation.y = -0.08;
  if (rightLowerArm) rightLowerArm.rotation.y = 0.08;
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
        if (!Array.isArray(data.values) || data.values.length === 0) throw new Error(`${envelopeFile} に口パク波形がありません。`);
        if (data.fps && data.fps !== fps) throw new Error(`${envelopeFile} は ${data.fps}fps 用です。Composition は ${fps}fps です。`);
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
    scene.background = background === 'transparent' ? null : new THREE.Color(background);

    const camera = new THREE.PerspectiveCamera(27, width / height, 0.01, 100);

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
          vrm.scene.scale.setScalar(2.35 / (size.y || 1));

          const box2 = new THREE.Box3().setFromObject(vrm.scene);
          const center = new THREE.Vector3();
          box2.getCenter(center);
          vrm.scene.position.x -= center.x;
          vrm.scene.position.z -= center.z;

          // Landscape QC prioritizes a visible face and upper body, while leaving the
          // right side free for reference images. The old fixed camera cropped the head.
          const framedBox = new THREE.Box3().setFromObject(vrm.scene);
          const framedSize = new THREE.Vector3();
          framedBox.getSize(framedSize);
          const landscape = width > height;
          const targetHeight = framedSize.y * (landscape ? 0.72 : 0.88);
          const targetCenterY = framedBox.max.y - targetHeight / 2 - framedSize.y * 0.02;
          const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
          const cameraDistance = (targetHeight / 2) / Math.tan(halfFov) * 1.12;
          if (landscape) vrm.scene.position.x -= 0.18;
          camera.position.set(0, targetCenterY, cameraDistance);
          camera.lookAt(0, targetCenterY, 0);

          applyNaturalPose(vrm);
          vrm.update(0);
          renderer.render(scene, camera);

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

  const level = envelope?.[Math.min(frame, Math.max(0, envelope.length - 1))] ?? 0;
  const nowMs = (frame / fps) * 1000;
  const currentCaption = clip?.captions?.find((caption) => caption.startMs <= nowMs && caption.endMs > nowMs) ?? null;
  const currentSpeaker = currentCaption?.speaker ?? 'UNKNOWN';
  const hostSpeaking = currentSpeaker === 'HOST';
  const drivenLevel = hostSpeaking ? level : 0;

  useLayoutEffect(() => {
    const s = sceneState.current;
    if (!s?.vrm || !envelope || !modelReady) return;

    const vrm = s.vrm;
    const em = vrm.expressionManager;
    const mouth = mouthWeights(frame, drivenLevel);
    em?.setValue('aa', mouth.aa);
    em?.setValue('ih', mouth.ih);
    em?.setValue('ou', mouth.ou);
    em?.setValue('ee', mouth.ee);
    em?.setValue('oh', mouth.oh);
    em?.setValue('blink', blinkWeight(frame));

    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const neck = vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
    const speech = Math.max(0, drivenLevel - 0.03);

    if (head) {
      head.rotation.x = Math.sin(frame * 0.055) * 0.018 - speech * 0.035;
      head.rotation.y = Math.sin(frame * 0.023) * 0.035;
      head.rotation.z = Math.sin(frame * 0.031) * 0.012;
    }
    if (neck) neck.rotation.y = Math.sin(frame * 0.019) * 0.018;
    if (chest) {
      chest.rotation.x = Math.sin(frame * 0.032) * 0.007 + speech * 0.012;
      chest.rotation.z = Math.sin(frame * 0.017) * 0.009;
    }

    vrm.scene.position.y = Math.sin(frame * 0.025) * 0.005;
    vrm.update(1 / fps);
    s.renderer.render(s.scene, s.camera);
  }, [drivenLevel, envelope, fps, frame, modelReady]);

  const displayTitle = title || clip?.title || '';
  const displayTelop = currentCaption?.text || telop || clip?.telop || '';
  const displayHook = clip?.hook || '';
  const sourceLabel = clip?.sourceLabel || '';
  const base = Math.min(width, height);
  const padX = Math.round(base * 0.048);
  const meter = Math.round(level * 100);
  const titleFontSize = Math.round(Math.min(width * 0.038, height * 0.046));
  const captionFontSize = Math.round(Math.min(width * 0.062, height * 0.075));
  const configuredCaptionBottom = Number(clip?.layout?.captionBottomPx);
  const captionBottomPx = Number.isFinite(configuredCaptionBottom) && configuredCaptionBottom > 0
    ? configuredCaptionBottom
    : (height > width ? Math.round(height * 0.2265) : Math.round(height * 0.07));
  const titleOpacity = interpolate(frame, [0, 10, 90, 105], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{background: background === 'transparent' ? 'transparent' : background}}>
      <Audio src={staticFile(audioFile)} volume={1} />
      <canvas ref={canvas} width={width} height={height} style={{width: '100%', height: '100%', display: 'block'}} />

      {!modelReady ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', color: '#ddd', fontFamily: overlayFontFamily}}>
          VRM LOADING
        </AbsoluteFill>
      ) : null}

      {sourceLabel ? (
        <div style={{position: 'absolute', top: Math.round(height * 0.022), left: padX, color: 'rgba(255,255,255,.58)', fontFamily: overlayFontFamily, fontSize: Math.max(11, Math.round(base * 0.017)), letterSpacing: '0.12em'}}>
          {sourceLabel}
        </div>
      ) : null}

      {displayTitle ? (
        <div
          style={{
            position: 'absolute',
            top: padX,
            left: padX,
            maxWidth: width - padX * 2,
            opacity: titleOpacity,
            color: 'white',
            background: 'rgba(0,0,0,.5)',
            padding: `${Math.round(titleFontSize * 0.18)}px ${Math.round(titleFontSize * 0.4)}px`,
            fontFamily: overlayFontFamily,
            fontWeight: 700,
            fontSize: titleFontSize,
            lineHeight: 1.2,
            textShadow: '0 2px 18px rgba(0,0,0,.7)',
          }}
        >
          {displayTitle}
        </div>
      ) : null}

      {displayHook ? (
        <div style={{position: 'absolute', top: Math.round(height * 0.13), left: padX, right: padX, color: 'rgba(255,255,255,.78)', fontFamily: overlayFontFamily, fontWeight: 700, fontSize: Math.round(base * 0.026), lineHeight: 1.35}}>
          {displayHook}
        </div>
      ) : null}

      {displayTelop ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: captionBottomPx,
            padding: `${Math.round(captionFontSize * 0.4)}px ${Math.round(width * 0.07)}px`,
            background: 'linear-gradient(to bottom, rgba(6,6,8,0), rgba(6,6,8,.72) 35%, rgba(6,6,8,.72))',
            color: 'white',
            fontFamily: overlayFontFamily,
            fontWeight: 800,
            fontSize: captionFontSize,
            lineHeight: 1.34,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: height > width ? 3 : 2,
            WebkitTextStroke: `${Math.max(2, Math.round(captionFontSize * 0.13))}px rgba(0,0,0,.9)`,
            paintOrder: 'stroke fill',
            textShadow: '0 3px 14px rgba(0,0,0,.8)',
          }}
        >
          {displayTelop}
        </div>
      ) : null}

      {showMeter ? (
        <div style={{position: 'absolute', left: padX, bottom: Math.round(height * 0.025), color: 'rgba(255,255,255,.55)', fontFamily: 'ui-monospace, monospace', fontSize: Math.max(11, Math.round(base * 0.018)), letterSpacing: 2}}>
          AUDIO DRIVE {meter.toString().padStart(3, '0')} / {currentSpeaker}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
