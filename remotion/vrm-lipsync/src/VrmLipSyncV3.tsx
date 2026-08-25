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

type EnvelopeFile = {fps?: number; durationInFrames?: number; values: number[]};
type StudioCaption = Caption & {speaker?: string; speakerConfidence?: number; speakerReason?: string};
type ClipFile = {
  title?: string;
  telop?: string;
  hook?: string;
  sourceLabel?: string;
  captions?: StudioCaption[];
  layout?: {width?: number; height?: number; captionBottomPx?: number};
};
type SpeakerTurn = {speaker: string; startMs: number; endMs: number};
type SpeakerPayload = {avatarSpeaker?: string; turns?: SpeakerTurn[]};
type SceneState = {renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; vrm: VRM};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const sans = '"Noto Sans CJK JP","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
const mono = '"IBM Plex Mono","Noto Sans Mono CJK JP",ui-monospace,monospace';

const mouthWeights = (frame: number, level: number) => {
  const gate = clamp01((level - 0.018) / 0.38);
  if (gate < 0.015) return {aa: 0, ih: 0, ou: 0, ee: 0, oh: 0};
  const phase = Math.floor(frame / 2) % 5;
  const base = Math.min(1, 0.24 + gate * 1.05);
  return {
    aa: phase === 0 || phase === 4 ? base : base * 0.18,
    ih: phase === 1 ? base * 0.82 : 0,
    ou: phase === 2 ? base * 0.70 : 0,
    ee: phase === 3 ? base * 0.78 : 0,
    oh: phase === 4 ? base * 0.70 : 0,
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
  const ls = vrm.humanoid?.getNormalizedBoneNode('leftShoulder');
  const rs = vrm.humanoid?.getNormalizedBoneNode('rightShoulder');
  const la = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
  const ra = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
  if (ls) ls.rotation.z = 0.04;
  if (rs) rs.rotation.z = -0.04;
  if (la) { la.rotation.z = Math.PI * 0.36; la.rotation.x = -0.05; }
  if (ra) { ra.rotation.z = -Math.PI * 0.36; ra.rotation.x = -0.05; }
};

export const VrmLipSync: React.FC<VrmLipSyncProps> = ({
  title, telop, modelFile, audioFile, envelopeFile, clipFile, background, showMeter,
}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneState = useRef<SceneState | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [envelope, setEnvelope] = useState<number[] | null>(null);
  const [clip, setClip] = useState<ClipFile | null>(null);
  const [speakerPayload, setSpeakerPayload] = useState<SpeakerPayload>({turns: []});
  const [modelHandle] = useState(() => delayRender('VRM loading'));
  const [envelopeHandle] = useState(() => delayRender('Envelope loading'));
  const [clipHandle] = useState(() => delayRender('Clip loading'));
  const [speakerHandle] = useState(() => delayRender('Speaker turns loading'));

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(envelopeFile))
      .then(async (r) => { if (!r.ok) throw new Error(`${envelopeFile} missing`); return await r.json() as EnvelopeFile; })
      .then((d) => {
        if (cancelled) return;
        if (!Array.isArray(d.values) || d.values.length === 0) throw new Error('Envelope is empty');
        if (d.fps && d.fps !== fps) throw new Error(`Envelope ${d.fps}fps != composition ${fps}fps`);
        setEnvelope(d.values); continueRender(envelopeHandle);
      })
      .catch((e) => cancelRender(e instanceof Error ? e : new Error(String(e))));
    return () => { cancelled = true; };
  }, [envelopeFile, envelopeHandle, fps]);

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile(clipFile))
      .then(async (r) => { if (!r.ok) throw new Error(`${clipFile} missing`); return await r.json() as ClipFile; })
      .then((d) => { if (!cancelled) { setClip(d); continueRender(clipHandle); } })
      .catch((e) => cancelRender(e instanceof Error ? e : new Error(String(e))));
    return () => { cancelled = true; };
  }, [clipFile, clipHandle]);

  useEffect(() => {
    let cancelled = false;
    fetch(staticFile('speaker-turns.json'))
      .then(async (r) => r.ok ? await r.json() as SpeakerPayload : ({turns: []} as SpeakerPayload))
      .then((d) => { if (!cancelled) { setSpeakerPayload(d); continueRender(speakerHandle); } })
      .catch(() => { if (!cancelled) { setSpeakerPayload({turns: []}); continueRender(speakerHandle); } });
    return () => { cancelled = true; };
  }, [speakerHandle]);

  useEffect(() => {
    if (!canvas.current || sceneState.current) return;
    const renderer = new THREE.WebGLRenderer({canvas: canvas.current, antialias: true, alpha: true, preserveDrawingBuffer: true});
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.07;

    const scene = new THREE.Scene();
    scene.background = background === 'transparent' ? null : new THREE.Color(background);
    const camera = new THREE.PerspectiveCamera(27, width / height, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x1c2027, 2.5));
    const key = new THREE.DirectionalLight(0xfff6e9, 3.8); key.position.set(2.4, 3.4, 3.3); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa7d8ff, 2.1); rim.position.set(-3.2, 2.8, -1.5); scene.add(rim);

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(staticFile(modelFile), (gltf: any) => {
      try {
        const vrm: VRM = gltf.userData.vrm;
        if (!vrm) throw new Error(`${modelFile} is not VRM`);
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        if (vrm.meta.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
        scene.add(vrm.scene);

        const box = new THREE.Box3().setFromObject(vrm.scene);
        const size = new THREE.Vector3(); box.getSize(size);
        vrm.scene.scale.setScalar(2.35 / (size.y || 1));
        const b2 = new THREE.Box3().setFromObject(vrm.scene);
        const center = new THREE.Vector3(); b2.getCenter(center);
        vrm.scene.position.x -= center.x; vrm.scene.position.z -= center.z;

        const framed = new THREE.Box3().setFromObject(vrm.scene);
        const fs = new THREE.Vector3(); framed.getSize(fs);
        const landscape = width > height;
        // Landscape is intentionally a bust-up shot. Head + shoulders + upper chest fill the left visual zone.
        const targetHeight = fs.y * (landscape ? 0.47 : 0.84);
        const targetCenterY = framed.max.y - targetHeight * (landscape ? 0.53 : 0.56) - fs.y * 0.01;
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
        const cameraDistance = (targetHeight / 2) / Math.tan(halfFov) * (landscape ? 1.04 : 1.10);
        if (landscape) vrm.scene.position.x -= 0.49;
        camera.position.set(0, targetCenterY, cameraDistance);
        camera.lookAt(0, targetCenterY, 0);

        applyNaturalPose(vrm);
        vrm.update(0); renderer.render(scene, camera);
        sceneState.current = {renderer, scene, camera, vrm};
        setModelReady(true); continueRender(modelHandle);
      } catch (e) { cancelRender(e instanceof Error ? e : new Error(String(e))); }
    }, undefined, (e) => cancelRender(e instanceof Error ? e : new Error(String(e))));
    return () => { renderer.dispose(); sceneState.current = null; };
  }, [background, height, modelFile, modelHandle, width]);

  const level = envelope?.[Math.min(frame, Math.max(0, envelope.length - 1))] ?? 0;
  const nowMs = frame / fps * 1000;
  const currentCaption = clip?.captions?.find((c) => c.startMs <= nowMs && c.endMs > nowMs) ?? null;
  const turn = speakerPayload.turns?.find((t) => t.startMs <= nowMs && t.endMs > nowMs) ?? null;
  const avatarSpeaker = speakerPayload.avatarSpeaker || 'HOST';
  const currentSpeaker = turn?.speaker || currentCaption?.speaker || 'UNKNOWN';
  const hostSpeaking = currentSpeaker === avatarSpeaker || (avatarSpeaker === 'HOST' && currentSpeaker === 'HOST');
  const drivenLevel = hostSpeaking ? level : 0;

  useLayoutEffect(() => {
    const s = sceneState.current;
    if (!s?.vrm || !envelope || !modelReady) return;
    const vrm = s.vrm;
    const em = vrm.expressionManager;
    const mouth = mouthWeights(frame, drivenLevel);
    em?.setValue('aa', mouth.aa); em?.setValue('ih', mouth.ih); em?.setValue('ou', mouth.ou);
    em?.setValue('ee', mouth.ee); em?.setValue('oh', mouth.oh); em?.setValue('blink', blinkWeight(frame));
    const head = vrm.humanoid?.getNormalizedBoneNode('head');
    const neck = vrm.humanoid?.getNormalizedBoneNode('neck');
    const chest = vrm.humanoid?.getNormalizedBoneNode('chest');
    const speech = Math.max(0, drivenLevel - 0.025);
    if (head) {
      head.rotation.x = Math.sin(frame * 0.055) * 0.019 - speech * 0.045;
      head.rotation.y = Math.sin(frame * 0.023) * 0.038;
      head.rotation.z = Math.sin(frame * 0.031) * 0.013;
    }
    if (neck) neck.rotation.y = Math.sin(frame * 0.019) * 0.020;
    if (chest) { chest.rotation.x = Math.sin(frame * 0.032) * 0.008 + speech * 0.015; chest.rotation.z = Math.sin(frame * 0.017) * 0.010; }
    vrm.scene.position.y = Math.sin(frame * 0.025) * 0.005;
    vrm.update(1 / fps); s.renderer.render(s.scene, s.camera);
  }, [drivenLevel, envelope, fps, frame, modelReady]);

  const landscape = width > height;
  const displayTitle = title || clip?.title || '';
  const displayTelop = currentCaption?.text || telop || clip?.telop || '';
  const sourceLabel = clip?.sourceLabel || '';
  const meter = Math.round(level * 100);
  const titleOpacity = interpolate(frame, [0, 9, 92, 108], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: background === 'transparent' ? 'transparent' : background, overflow: 'hidden'}}>
      <Audio src={staticFile(audioFile)} volume={1} />
      <canvas ref={canvas} width={width} height={height} style={{width: '100%', height: '100%', display: 'block'}} />

      {landscape ? <>
        <div style={{position:'absolute', inset:0, pointerEvents:'none', background:'linear-gradient(90deg, rgba(7,9,13,.08) 0%, rgba(7,9,13,.02) 41%, rgba(7,9,13,.22) 49%, rgba(7,9,13,.38) 100%)'}} />
        <div style={{position:'absolute', left:32, top:28, width:430, height:1, background:'linear-gradient(90deg,#d2aa62,rgba(210,170,98,0))'}} />
        <div style={{position:'absolute', left:32, top:40, color:'#d2aa62', fontFamily:mono, fontSize:12, letterSpacing:'0.18em'}}>GRAVITY ARCHIVE / OBSERVATION LOG</div>
        {sourceLabel ? <div style={{position:'absolute', left:32, top:62, color:'rgba(240,241,244,.48)', fontFamily:mono, fontSize:11, letterSpacing:'0.06em'}}>{sourceLabel}</div> : null}
        {displayTitle ? <div style={{position:'absolute', left:32, top:88, width:500, opacity:titleOpacity, color:'#f5f3ee', fontFamily:sans, fontWeight:760, fontSize:27, lineHeight:1.25, letterSpacing:'0.01em'}}>{displayTitle}</div> : null}
      </> : null}

      {!modelReady ? <AbsoluteFill style={{alignItems:'center',justifyContent:'center',color:'#ddd',fontFamily:sans}}>VRM LOADING</AbsoluteFill> : null}

      {displayTelop ? <div style={{position:'absolute', left:landscape ? 48 : 28, right:landscape ? 48 : 28, bottom:landscape ? 34 : 120, display:'flex', justifyContent:'center', pointerEvents:'none'}}>
        <div style={{maxWidth:landscape ? 1040 : width-56, padding:landscape ? '12px 24px 13px' : '16px 22px', border:'1px solid rgba(210,170,98,.28)', borderRadius:14, background:'linear-gradient(180deg,rgba(15,17,22,.78),rgba(9,11,15,.91))', boxShadow:'0 12px 38px rgba(0,0,0,.38), inset 0 1px rgba(255,255,255,.035)', color:'#f8f7f4', fontFamily:sans, fontWeight:750, fontSize:landscape ? 38 : 46, lineHeight:1.32, textAlign:'center', textShadow:'0 2px 9px rgba(0,0,0,.72)', whiteSpace:'pre-wrap'}}>{displayTelop}</div>
      </div> : null}

      {showMeter ? <div style={{position:'absolute', left:32, bottom:14, color:'rgba(255,255,255,.42)', fontFamily:mono, fontSize:10, letterSpacing:1.5}}>AUDIO {meter.toString().padStart(3,'0')} / {currentSpeaker}</div> : null}
    </AbsoluteFill>
  );
};
