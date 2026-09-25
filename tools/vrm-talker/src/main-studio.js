import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin, VRMUtils} from '@pixiv/three-vrm';
import {getProject, isAvatarSpeaking} from './app/project-state.js';

const $ = (id) => document.getElementById(id);
const el = {};
for (const id of [
  'c','stage','vrmFile','audioFile','bgFile','clearBg','play','stop','preview',
  'portrait','fullbody','flip','zoom','seek','bandFill','status','meterBar','dropHint',
  'markA','markB','clearClip','tNow','tEnd','tClip','telop','titleTx','hiRes',
  'sizeV','sizeS','sizeH','record','download','hudMode','hudRec',
]) el[id] = $(id);

const renderer = new THREE.WebGLRenderer({
  canvas: el.c,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setClearColor(0x17171c, 1);
renderer.setPixelRatio(1);

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(24, 9 / 16, 0.1, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x202027, 2.4));
const key = new THREE.DirectionalLight(0xffffff, 3.6);
key.position.set(2.4, 4, 4);
scene.add(key);
const fill = new THREE.DirectionalLight(0xcbd5ff, 1.2);
fill.position.set(-2.5, 1.7, 3);
scene.add(fill);

// 字幕・テロップはCanvas内へ焼き込み、MediaRecorderにも乗せる。
const telCanvas = document.createElement('canvas');
const telCtx = telCanvas.getContext('2d');
const telTex = new THREE.CanvasTexture(telCanvas);
telTex.colorSpace = THREE.SRGBColorSpace;
const telScene = new THREE.Scene();
const telCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
telScene.add(new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({map: telTex, transparent: true, depthTest: false, depthWrite: false}),
));

let vrm = null;
let audio = null;
let audioUrl = null;
let backgroundUrl = null;
let audioContext = null;
let sourceNode = null;
let analyser = null;
let recordDestination = null;
let freq = null;
let timeBuffer = null;
let smooth = 0;
let modelHeight = 1.7;
let mode = 'portrait';
let direction = 0;
let yaw = 0;
let pitch = 0;
let dragging = false;
let lastX = 0;
let lastY = 0;
let bones = {};
let clipA = null;
let clipB = null;
let previewing = false;
let output = {w: 720, h: 1280, name: 'PORTRAIT 9:16'};
let recorder = null;
let chunks = [];
let recordedBlob = null;
let recordedExtension = 'webm';
let recordStart = 0;
let lastBurnedCaption = null;

const formatTime = (value) => {
  const t = Number.isFinite(value) && value >= 0 ? value : 0;
  const minutes = Math.floor(t / 60);
  const seconds = Math.floor(t % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const setStatus = (text) => {
  if (el.status) el.status.textContent = text;
};

const currentCaptionText = () => {
  if (!audio) return '';
  const nowMs = audio.currentTime * 1000;
  const caption = getProject().captions.find((item) => Number(item.startMs) <= nowMs && Number(item.endMs) > nowMs);
  return caption?.text || '';
};

const hasSpeakerAnalysis = () => getProject().speakerTurns.length > 0;

const avatarGate = () => {
  const project = getProject();
  if (!hasSpeakerAnalysis()) return 1;
  if (!project.avatar.speaker || !audio) return 0;
  return isAvatarSpeaking(audio.currentTime * 1000) ? 1 : 0;
};

function applySize() {
  const multiplier = el.hiRes?.checked ? 1.5 : 1;
  const width = Math.round(output.w * multiplier);
  const height = Math.round(output.h * multiplier);
  renderer.setSize(width, height, false);
  cam.aspect = width / height;
  cam.updateProjectionMatrix();
  telCanvas.width = width;
  telCanvas.height = height;
  drawOverlay();
  fitToStage();
  if (el.hudMode) el.hudMode.textContent = output.name + (multiplier > 1 ? ' HQ' : '');
}

function fitToStage() {
  if (!el.stage) return;
  const rect = el.stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const scale = Math.min(rect.width / renderer.domElement.width, rect.height / renderer.domElement.height);
  el.c.style.width = `${Math.floor(renderer.domElement.width * scale)}px`;
  el.c.style.height = `${Math.floor(renderer.domElement.height * scale)}px`;
}
new ResizeObserver(fitToStage).observe(el.stage);

const NO_HEAD = '、。，．）］｝」』〉》】〕・：；？！ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々ゝゞヽヾ';
const NO_TAIL = '（［｛「『〈《【〔';

function wrapText(ctx, text, maxWidth, maxLines) {
  const chars = Array.from(text);
  const lines = [];
  let line = '';
  for (let i = 0; i < chars.length; i++) {
    let char = chars[i];
    if (line && ctx.measureText(line + char).width > maxWidth) {
      if (NO_HEAD.includes(char)) {
        line += char;
        continue;
      }
      if (NO_TAIL.includes(line[line.length - 1])) {
        char = line[line.length - 1] + char;
        line = line.slice(0, -1);
      }
      if (lines.length === maxLines - 1) {
        let rest = line;
        while (rest.length > 1 && ctx.measureText(rest + '…').width > maxWidth) rest = rest.slice(0, -1);
        lines.push(rest + '…');
        return lines;
      }
      lines.push(line);
      line = char;
    } else {
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawOverlay() {
  const width = telCanvas.width;
  const height = telCanvas.height;
  if (!width || !height) return;
  telCtx.clearRect(0, 0, width, height);
  const pad = Math.round(Math.min(width, height) * 0.048);
  const title = el.titleTx?.value.trim() || '';
  const timedCaption = currentCaptionText();
  const body = timedCaption || el.telop?.value.trim() || '';

  if (title) {
    const fontSize = Math.round(Math.min(width * 0.038, height * 0.046));
    telCtx.font = `700 ${fontSize}px "Noto Sans JP","Yu Gothic",system-ui,sans-serif`;
    telCtx.textBaseline = 'top';
    telCtx.textAlign = 'left';
    const titleWidth = telCtx.measureText(title).width;
    telCtx.fillStyle = 'rgba(0,0,0,.5)';
    telCtx.fillRect(pad - fontSize * 0.4, pad - fontSize * 0.28, titleWidth + fontSize * 0.8, fontSize * 1.6);
    telCtx.fillStyle = '#fff';
    telCtx.fillText(title, pad, pad);
  }

  if (body) {
    const fontSize = Math.round(Math.min(width * 0.062, height * 0.075));
    telCtx.font = `800 ${fontSize}px "Noto Sans JP","Yu Gothic",system-ui,sans-serif`;
    telCtx.textBaseline = 'middle';
    telCtx.textAlign = 'center';
    const lines = wrapText(telCtx, body, width * 0.86, height > width ? 3 : 2);
    const lineHeight = fontSize * 1.34;
    const boxHeight = lines.length * lineHeight + fontSize * 0.8;
    // 縦動画のSNS UIを避ける。720x1280では約290px相当。
    const safeBottom = height > width ? Math.round(height * 0.2265) : Math.round(height * 0.07);
    const boxY = Math.max(height * 0.45, height - safeBottom - boxHeight);
    const gradient = telCtx.createLinearGradient(0, boxY, 0, Math.min(height, boxY + boxHeight * 1.4));
    gradient.addColorStop(0, 'rgba(6,6,8,0)');
    gradient.addColorStop(0.35, 'rgba(6,6,8,.72)');
    gradient.addColorStop(1, 'rgba(6,6,8,.72)');
    telCtx.fillStyle = gradient;
    telCtx.fillRect(0, boxY, width, Math.min(height - boxY, boxHeight * 1.4));
    const centerY = boxY + boxHeight / 2;
    telCtx.lineWidth = Math.max(2, fontSize * 0.13);
    telCtx.strokeStyle = 'rgba(0,0,0,.9)';
    telCtx.lineJoin = 'round';
    lines.forEach((line, index) => {
      const y = centerY + (index - (lines.length - 1) / 2) * lineHeight;
      telCtx.strokeText(line, width / 2, y);
      telCtx.fillStyle = '#fff';
      telCtx.fillText(line, width / 2, y);
    });
  }
  telTex.needsUpdate = true;
}

el.telop?.addEventListener('input', drawOverlay);
el.titleTx?.addEventListener('input', drawOverlay);

const bone = (name) => vrm?.humanoid?.getNormalizedBoneNode(name) || null;
function cacheBones() {
  bones = {
    head: bone('head'),
    neck: bone('neck'),
    chest: bone('chest'),
    spine: bone('spine'),
    leftUpperArm: bone('leftUpperArm'),
    rightUpperArm: bone('rightUpperArm'),
    leftLowerArm: bone('leftLowerArm'),
    rightLowerArm: bone('rightLowerArm'),
    leftHand: bone('leftHand'),
    rightHand: bone('rightHand'),
  };
}

function applyPose(time = 0, energy = 0) {
  const sway = Math.sin(time * 0.9) * 0.012;
  if (bones.leftUpperArm) bones.leftUpperArm.rotation.set(0.08, 0, -1.18 + sway);
  if (bones.rightUpperArm) bones.rightUpperArm.rotation.set(0.08, 0, 1.18 - sway);
  if (bones.leftLowerArm) bones.leftLowerArm.rotation.set(0.14, 0, -0.12);
  if (bones.rightLowerArm) bones.rightLowerArm.rotation.set(0.14, 0, 0.12);
  if (bones.leftHand) bones.leftHand.rotation.set(0, 0, -0.04);
  if (bones.rightHand) bones.rightHand.rotation.set(0, 0, 0.04);
  if (bones.spine) bones.spine.rotation.x = 0.018 + sway * 0.3;
  if (bones.chest) {
    bones.chest.rotation.y = Math.sin(time * 0.34) * 0.018;
    bones.chest.rotation.x = 0.012 + energy * 0.015 + sway;
  }
  if (bones.neck) bones.neck.rotation.z = Math.sin(time * 0.43) * 0.014;
  if (bones.head) {
    bones.head.rotation.y = yaw + Math.sin(time * 0.73) * 0.038;
    bones.head.rotation.x = pitch + Math.sin(time * 0.51) * 0.014 - energy * 0.02;
  }
}

function frameCamera(nextMode = mode) {
  if (!vrm) return;
  mode = nextMode;
  const zoom = Number(el.zoom?.value || 108) / 100;
  if (mode === 'full') {
    cam.position.set(0, modelHeight * 0.54, modelHeight * 1.82 * zoom);
    cam.lookAt(0, modelHeight * 0.53, 0);
  } else {
    cam.position.set(0, modelHeight * 0.70, modelHeight * 1.12 * zoom);
    cam.lookAt(0, modelHeight * 0.72, 0);
  }
  cam.updateProjectionMatrix();
}

function canRecord() {
  return typeof MediaRecorder !== 'undefined' && typeof el.c?.captureStream === 'function';
}

function updateReadyState() {
  const ready = Boolean(vrm && audio);
  if (el.play) el.play.disabled = !ready;
  if (el.stop) el.stop.disabled = !audio;
  if (el.markA) el.markA.disabled = !audio;
  if (el.markB) el.markB.disabled = !audio;
  if (el.record) el.record.disabled = !(ready && canRecord());
  if (el.preview) el.preview.disabled = !(ready && clipA !== null && clipB !== null);
  if (el.clearClip) el.clearClip.disabled = !(clipA !== null || clipB !== null);
}

el.vrmFile?.addEventListener('change', async () => {
  const file = el.vrmFile.files?.[0];
  if (!file) return;
  setStatus('VRMを読み込み中…');
  try {
    const buffer = await file.arrayBuffer();
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await new Promise((resolve, reject) => loader.parse(buffer, '', resolve, reject));
    if (vrm) scene.remove(vrm.scene);
    vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('VRM data not found');
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    if (vrm.meta?.metaVersion === '0') VRMUtils.rotateVRM0(vrm);
    direction = 0;
    vrm.scene.rotation.y = 0;
    scene.add(vrm.scene);
    const box = new THREE.Box3().setFromObject(vrm.scene);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    vrm.scene.position.x -= center.x;
    vrm.scene.position.z -= center.z;
    const grounded = new THREE.Box3().setFromObject(vrm.scene);
    vrm.scene.position.y -= grounded.min.y;
    modelHeight = Math.max(size.y, 0.1);
    cacheBones();
    applyPose();
    frameCamera('portrait');
    if (el.dropHint) el.dropHint.style.display = 'none';

    const manager = vrm.expressionManager;
    const missing = ['aa', 'ih', 'ou', 'ee', 'oh'].filter((name) => !manager?.getExpression(name));
    if (missing.length === 5) {
      setStatus(`⚠ ${file.name}: 口の形 aa/ih/ou/ee/oh がありません。Subeha.vrm を使用してください。`);
    } else if (missing.length) {
      setStatus(`⚠ ${file.name}: 口の形が不足 (${missing.join('/')})`);
    } else {
      setStatus(`${file.name}: 読み込み完了 / 口の形5種あり`);
    }
    updateReadyState();
  } catch (error) {
    console.error(error);
    setStatus('VRM読み込み失敗。VRM 0.x / 1.0 を確認してください。');
  }
});

el.audioFile?.addEventListener('change', () => {
  const file = el.audioFile.files?.[0];
  if (!file) return;
  if (audio) {
    audio.pause();
    audio.src = '';
  }
  if (audioContext) audioContext.close().catch(() => {});
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(file);
  audio = new Audio(audioUrl);
  audio.preload = 'auto';
  sourceNode = null;
  analyser = null;
  audioContext = null;
  recordDestination = null;
  clipA = null;
  clipB = null;
  smooth = 0;
  audio.addEventListener('loadedmetadata', () => {
    el.seek.disabled = false;
    el.tEnd.textContent = formatTime(audio.duration);
    setStatus(`音声 ${formatTime(audio.duration)} 読み込み完了。字幕＋話者解析を実行できます。`);
    updateClipLabel();
    updateReadyState();
  });
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    el.seek.value = String(Math.round(audio.currentTime / audio.duration * 1000));
    el.tNow.textContent = formatTime(audio.currentTime);
  });
  audio.addEventListener('ended', () => {
    el.play.textContent = '再生';
    previewing = false;
    if (recorder?.state === 'recording') stopRecording();
  });
});

el.bgFile?.addEventListener('change', () => {
  const file = el.bgFile.files?.[0];
  if (!file) return;
  if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
  backgroundUrl = URL.createObjectURL(file);
  new THREE.TextureLoader().load(backgroundUrl, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    setStatus('背景読み込み完了');
  });
});

el.clearBg?.addEventListener('click', () => {
  scene.background = null;
  renderer.setClearColor(0x17171c, 1);
});

async function wireAudio() {
  if (!audio || sourceNode) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContextClass();
  sourceNode = audioContext.createMediaElementSource(audio);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.5;
  freq = new Uint8Array(analyser.frequencyBinCount);
  timeBuffer = new Uint8Array(analyser.fftSize);
  recordDestination = audioContext.createMediaStreamDestination();
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
  analyser.connect(recordDestination);
}

function rawEnvelope() {
  if (!analyser || !audio || audio.paused) return 0;
  analyser.getByteTimeDomainData(timeBuffer);
  let sum = 0;
  for (const sample of timeBuffer) {
    const x = (sample - 128) / 128;
    sum += x * x;
  }
  const rms = Math.sqrt(sum / timeBuffer.length);
  analyser.getByteFrequencyData(freq);
  let speech = 0;
  let count = 0;
  const nyquist = (audioContext?.sampleRate || 48000) / 2;
  for (let i = 0; i < freq.length; i++) {
    const hz = i / freq.length * nyquist;
    if (hz > 120 && hz < 4200) {
      speech += freq[i] / 255;
      count++;
    }
  }
  const value = Math.min(1, Math.max(0, (rms - 0.01) * 8.3 + (count ? speech / count * 0.13 : 0)));
  smooth = smooth * 0.64 + value * 0.36;
  return smooth;
}

function gatedEnvelope() {
  const value = rawEnvelope();
  return value * avatarGate();
}

el.play?.addEventListener('click', async () => {
  if (!vrm || !audio) return;
  await wireAudio();
  if (audioContext.state === 'suspended') await audioContext.resume();
  if (audio.paused) {
    await audio.play();
    el.play.textContent = '一時停止';
  } else {
    audio.pause();
    el.play.textContent = '再生';
  }
});

el.stop?.addEventListener('click', () => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = clipA !== null ? clipA : 0;
  el.play.textContent = '再生';
  previewing = false;
});

el.seek?.addEventListener('input', () => {
  if (audio?.duration) audio.currentTime = Number(el.seek.value) / 1000 * audio.duration;
});

function updateClipLabel() {
  if (clipA === null && clipB === null) el.tClip.textContent = '区間 未設定';
  else if (clipB === null) el.tClip.textContent = `始点 ${formatTime(clipA)} →`;
  else if (clipA === null) el.tClip.textContent = `→ 終点 ${formatTime(clipB)}`;
  else el.tClip.textContent = `${formatTime(clipA)} → ${formatTime(clipB)} (${formatTime(clipB - clipA)})`;
  const duration = audio?.duration || 0;
  if (duration && clipA !== null && clipB !== null) {
    el.bandFill.style.left = `${clipA / duration * 100}%`;
    el.bandFill.style.width = `${(clipB - clipA) / duration * 100}%`;
  } else {
    el.bandFill.style.width = '0%';
  }
  updateReadyState();
}

el.markA?.addEventListener('click', () => {
  if (!audio) return;
  clipA = audio.currentTime;
  if (clipB !== null && clipB <= clipA) clipB = null;
  updateClipLabel();
});

el.markB?.addEventListener('click', () => {
  if (!audio) return;
  clipB = audio.currentTime;
  if (clipA !== null && clipB <= clipA) clipA = null;
  updateClipLabel();
});

el.clearClip?.addEventListener('click', () => {
  clipA = null;
  clipB = null;
  updateClipLabel();
});

el.preview?.addEventListener('click', async () => {
  if (!audio || clipA === null || clipB === null) return;
  await wireAudio();
  if (audioContext.state === 'suspended') await audioContext.resume();
  audio.currentTime = clipA;
  previewing = true;
  await audio.play();
  el.play.textContent = '一時停止';
});

el.portrait?.addEventListener('click', () => frameCamera('portrait'));
el.fullbody?.addEventListener('click', () => frameCamera('full'));
el.zoom?.addEventListener('input', () => frameCamera(mode));
el.flip?.addEventListener('click', () => {
  if (!vrm) return;
  direction = direction === 0 ? Math.PI : 0;
  vrm.scene.rotation.y = direction;
  setStatus(direction === 0 ? '正面: 標準' : '正面: 180°反転');
});

for (const [button, width, height, name] of [
  [el.sizeV, 720, 1280, 'PORTRAIT 9:16'],
  [el.sizeS, 900, 900, 'SQUARE 1:1'],
  [el.sizeH, 1280, 720, 'LANDSCAPE 16:9'],
]) {
  button?.addEventListener('click', () => {
    output = {w: width, h: height, name};
    for (const option of [el.sizeV, el.sizeS, el.sizeH]) option?.setAttribute('aria-pressed', String(option === button));
    applySize();
    frameCamera(mode);
  });
}

el.hiRes?.addEventListener('change', () => {
  applySize();
  frameCamera(mode);
});

el.c?.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  el.c.setPointerCapture(event.pointerId);
});
el.c?.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw += (event.clientX - lastX) * 0.005;
  pitch = Math.max(-0.2, Math.min(0.2, pitch + (event.clientY - lastY) * 0.0025));
  lastX = event.clientX;
  lastY = event.clientY;
});
el.c?.addEventListener('pointerup', () => {
  dragging = false;
});

function pickRecordingType() {
  const options = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [type, extension] of options) {
    if (MediaRecorder.isTypeSupported?.(type)) return {type, extension};
  }
  return {type: '', extension: 'webm'};
}

async function startRecording() {
  if (!vrm || !audio) return;
  if (!canRecord()) {
    setStatus('この端末では録画できません。プレビューは利用できます。');
    return;
  }
  const project = getProject();
  if (project.speakerTurns.length > 0 && !project.avatar.speaker) {
    setStatus('本人話者を選んでから録画してください。');
    return;
  }
  await wireAudio();
  if (audioContext.state === 'suspended') await audioContext.resume();
  const {type, extension} = pickRecordingType();
  recordedExtension = extension;
  const stream = el.c.captureStream(30);
  for (const track of recordDestination.stream.getAudioTracks()) stream.addTrack(track);
  chunks = [];
  recordedBlob = null;
  el.download.disabled = true;
  try {
    recorder = new MediaRecorder(stream, type ? {mimeType: type, videoBitsPerSecond: 6_000_000} : undefined);
  } catch (error) {
    setStatus(`録画開始失敗: ${error.message}`);
    return;
  }
  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };
  recorder.onstop = () => {
    recordedBlob = new Blob(chunks, {type: chunks[0]?.type || 'video/webm'});
    el.download.disabled = false;
    el.record.textContent = '録画開始';
    el.record.classList.remove('recording');
    el.hudRec.textContent = '';
    setStatus(`録画完了 ${(recordedBlob.size / 1048576).toFixed(1)}MB (${recordedExtension.toUpperCase()})`);
  };
  audio.currentTime = clipA !== null ? clipA : 0;
  await audio.play();
  el.play.textContent = '一時停止';
  recorder.start(1000);
  recordStart = performance.now();
  el.record.textContent = '録画停止';
  el.record.classList.add('recording');
  setStatus('録画中…');
}

function stopRecording() {
  if (!recorder || recorder.state === 'inactive') return;
  recorder.stop();
  audio?.pause();
  if (el.play) el.play.textContent = '再生';
}

el.record?.addEventListener('click', () => {
  if (recorder?.state === 'recording') stopRecording();
  else startRecording();
});

el.download?.addEventListener('click', () => {
  if (!recordedBlob) return;
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const filename = `kiritori-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.${recordedExtension}`;
  const url = URL.createObjectURL(recordedBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  setStatus(`保存しました: ${filename}`);
});

function loop(ms) {
  requestAnimationFrame(loop);
  const time = audio ? audio.currentTime : ms / 1000;
  const energy = gatedEnvelope();
  if (el.meterBar) el.meterBar.style.width = `${Math.round(energy * 100)}%`;

  if (audio && !audio.paused && clipB !== null && time >= clipB) {
    if (recorder?.state === 'recording') stopRecording();
    else if (previewing) {
      audio.pause();
      previewing = false;
      el.play.textContent = '再生';
    }
  }

  if (recorder?.state === 'recording' && el.hudRec) {
    el.hudRec.textContent = `REC ${formatTime((performance.now() - recordStart) / 1000)}`;
  }

  const caption = currentCaptionText();
  if (caption !== lastBurnedCaption) {
    lastBurnedCaption = caption;
    drawOverlay();
  }

  if (vrm) {
    applyPose(time, energy);
    const manager = vrm.expressionManager;
    const active = energy > 0.025;
    if (manager) {
      manager.setValue('aa', active ? Math.min(1, energy * 0.92) : 0);
      manager.setValue('ih', active ? Math.max(0, Math.sin(time * 14)) * energy * 0.22 : 0);
      manager.setValue('ou', active ? Math.max(0, Math.sin(time * 10 + 1.1)) * energy * 0.17 : 0);
      manager.setValue('ee', active ? Math.max(0, Math.sin(time * 8 + 2.2)) * energy * 0.09 : 0);
      manager.setValue('oh', active ? Math.max(0, Math.sin(time * 9 + 0.4)) * energy * 0.14 : 0);
      const blinkPhase = (ms / 1000) % 4.5;
      manager.setValue('blink', Math.max(0, blinkPhase > 4.3 ? Math.sin((blinkPhase - 4.3) / 0.2 * Math.PI) : 0));
      manager.update();
    }
    vrm.update(1 / 60);
  }

  renderer.render(scene, cam);
  renderer.autoClear = false;
  renderer.render(telScene, telCam);
  renderer.autoClear = true;
}

applySize();
requestAnimationFrame(loop);
if (!canRecord()) setStatus('この端末は録画非対応です。プレビューまでは使えます。');
