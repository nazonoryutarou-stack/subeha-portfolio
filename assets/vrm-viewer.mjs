import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const lerp=(a,b,t)=>a+(b-a)*t;

export async function mountVRM({ canvas, stage, modelUrl, onProgress }) {
  if (!canvas || !stage) throw new Error('VRMの表示領域が見つかりません。');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 1, 0.01, 20);
  scene.add(new THREE.HemisphereLight(0xf6e7cb, 0x17100d, 2.2));
  const key = new THREE.DirectionalLight(0xffe2b3, 2.8);
  key.position.set(-1.5, 2.8, -2.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8bb6b1, 1.25);
  rim.position.set(1.8, 1.8, 1.5);
  scene.add(rim);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(modelUrl, (event) => {
    if (event.total && onProgress) onProgress(event.loaded / event.total);
  });
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('VRMとして読み込めませんでした。');

  vrm.scene.traverse((object) => {
    object.frustumCulled = false;
    if (object.isMesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  scene.add(vrm.scene);
  vrm.scene.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(vrm.scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const visibleHeight = Math.max(size.y * 0.73, 1.15);
  const targetY = box.max.y - visibleHeight * 0.52;
  const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
  camera.position.set(center.x, targetY + 0.015, box.min.z - distance * 1.02);
  camera.lookAt(center.x, targetY, center.z);

  const humanoid = vrm.humanoid;
  const head = humanoid?.getNormalizedBoneNode('head') || null;
  const chest = humanoid?.getNormalizedBoneNode('chest') || humanoid?.getNormalizedBoneNode('spine') || null;
  const hips = humanoid?.getNormalizedBoneNode('hips') || null;
  const headBase = head?.rotation.clone();
  const chestBase = chest?.rotation.clone();
  const hipsBaseY = hips?.position.y ?? 0;
  const expression = vrm.expressionManager;

  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  const pointerMove = (event) => {
    const r = stage.getBoundingClientRect();
    pointerX = clamp(((event.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    pointerY = clamp(((event.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
  };
  const pointerLeave = () => { pointerX = 0; pointerY = 0; };
  stage.addEventListener('pointermove', pointerMove, { passive: true });
  stage.addEventListener('pointerleave', pointerLeave, { passive: true });

  const resize = () => {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '120px' });
  io.observe(stage);

  const clock = new THREE.Clock();
  let nextBlink = 2.2 + Math.random() * 2.4;
  let blinkStart = -1;
  let elapsed = 0;
  let disposed = false;

  const render = () => {
    if (disposed) return;
    requestAnimationFrame(render);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    elapsed += dt;
    smoothX = lerp(smoothX, pointerX, 1 - Math.pow(0.002, dt));
    smoothY = lerp(smoothY, pointerY, 1 - Math.pow(0.002, dt));

    if (head && headBase) {
      head.rotation.set(
        headBase.x + smoothY * 0.075,
        headBase.y - smoothX * 0.14,
        headBase.z - smoothX * 0.018
      );
    }
    if (!reduceMotion && chest && chestBase) {
      chest.rotation.set(
        chestBase.x + Math.sin(elapsed * 1.35) * 0.008,
        chestBase.y + Math.sin(elapsed * 0.52) * 0.006,
        chestBase.z + Math.sin(elapsed * 0.71) * 0.004
      );
    }
    if (!reduceMotion && hips) hips.position.y = hipsBaseY + Math.sin(elapsed * 1.35) * 0.0025;

    if (!reduceMotion && expression) {
      if (blinkStart < 0 && elapsed >= nextBlink) blinkStart = elapsed;
      if (blinkStart >= 0) {
        const phase = (elapsed - blinkStart) / 0.16;
        const value = phase < 0.5 ? phase * 2 : Math.max(0, 2 - phase * 2);
        expression.setValue('blink', clamp(value, 0, 1));
        if (phase >= 1) {
          expression.setValue('blink', 0);
          blinkStart = -1;
          nextBlink = elapsed + 2.4 + Math.random() * 3.2;
        }
      }
    }

    vrm.update(dt);
    renderer.render(scene, camera);
  };
  render();

  return () => {
    disposed = true;
    ro.disconnect();
    io.disconnect();
    stage.removeEventListener('pointermove', pointerMove);
    stage.removeEventListener('pointerleave', pointerLeave);
    renderer.dispose();
    URL.revokeObjectURL(modelUrl);
  };
}
