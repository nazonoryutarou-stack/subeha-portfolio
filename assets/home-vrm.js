(() => {
  'use strict';

  const root = document.querySelector('[data-home-vrm]');
  if (!root) return;

  const stage = root.querySelector('[data-home-vrm-stage]');
  const canvas = root.querySelector('[data-home-vrm-canvas]');
  const poster = root.querySelector('[data-home-vrm-poster]');
  const button = root.querySelector('[data-home-vrm-load]');
  const status = root.querySelector('[data-home-vrm-status]');
  if (!stage || !canvas || !poster || !button || !status) return;

  const modelUrl = 'subeha-web-site.vrm';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 768px)').matches;
  let loading = false;
  let loaded = false;
  let dispose = null;

  const setStatus = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle('home-vrm-error', error);
  };

  const resetFallback = (message) => {
    root.classList.remove('is-live');
    canvas.hidden = true;
    poster.hidden = false;
    button.disabled = false;
    button.textContent = 'もう一度試す';
    setStatus(message, true);
  };

  async function mountModel() {
    const [THREE, loaderModule, vrmModule] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm')
    ]);
    const { GLTFLoader } = loaderModule;
    const { VRMLoaderPlugin, VRMUtils } = vrmModule;

    if (!window.WebGLRenderingContext) throw new Error('WebGL is not available');

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.2 : 1.65));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    scene.add(new THREE.HemisphereLight(0xfff4df, 0x17110d, 2.15));
    const key = new THREE.DirectionalLight(0xffdfad, 2.55);
    key.position.set(1.8, 2.7, 3.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8b8179, 1.05);
    rim.position.set(-2.4, 1.3, -1.8);
    scene.add(rim);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loadedItems, totalItems) => {
      if (totalItems > 0) setStatus(`3Dモデルを読み込み中… ${Math.round((loadedItems / totalItems) * 100)}%`);
    };

    const loader = new GLTFLoader(manager);
    loader.register(parser => new VRMLoaderPlugin(parser));
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        modelUrl,
        resolve,
        event => {
          if (event.total > 0) setStatus(`3Dモデルを読み込み中… ${Math.round((event.loaded / event.total) * 100)}%`);
          else setStatus(`3Dモデルを読み込み中… ${(event.loaded / 1024 / 1024).toFixed(1)}MB`);
        },
        reject
      );
    });

    const vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('VRM data was not found');

    VRMUtils.removeUnnecessaryVertices?.(vrm.scene);
    VRMUtils.combineSkeletons?.(vrm.scene);
    VRMUtils.rotateVRM0?.(vrm);
    vrm.scene.traverse(object => { object.frustumCulled = false; });
    scene.add(vrm.scene);

    const bone = name => vrm.humanoid?.getNormalizedBoneNode?.(name);
    const bones = {
      hips: bone('hips'), spine: bone('spine'), chest: bone('chest'), upperChest: bone('upperChest'),
      neck: bone('neck'), head: bone('head'), leftShoulder: bone('leftShoulder'), rightShoulder: bone('rightShoulder'),
      leftUpperArm: bone('leftUpperArm'), rightUpperArm: bone('rightUpperArm'), leftLowerArm: bone('leftLowerArm'), rightLowerArm: bone('rightLowerArm'),
      leftUpperLeg: bone('leftUpperLeg'), rightUpperLeg: bone('rightUpperLeg'), leftLowerLeg: bone('leftLowerLeg'), rightLowerLeg: bone('rightLowerLeg')
    };
    const setRotation = (node, x = 0, y = 0, z = 0) => { if (node) node.rotation.set(x, y, z); };
    setRotation(bones.hips, 0.02, -0.06, 0.035);
    setRotation(bones.spine, 0.015, 0.035, -0.025);
    setRotation(bones.chest, -0.03, -0.025, 0.025);
    setRotation(bones.upperChest, -0.015, 0.02, 0.012);
    setRotation(bones.neck, 0.02, 0, -0.012);
    setRotation(bones.head, -0.035, 0.035, 0.02);
    setRotation(bones.leftShoulder, 0.03, 0, -0.2);
    setRotation(bones.rightShoulder, 0.03, 0, 0.17);
    setRotation(bones.leftUpperArm, 0.1, 0.06, -1.05);
    setRotation(bones.rightUpperArm, -0.06, -0.05, 0.95);
    setRotation(bones.leftLowerArm, -0.28, 0.04, -0.12);
    setRotation(bones.rightLowerArm, -0.34, -0.04, 0.1);
    setRotation(bones.leftUpperLeg, 0.04, -0.08, -0.035);
    setRotation(bones.rightUpperLeg, -0.02, 0.06, 0.04);
    setRotation(bones.leftLowerLeg, 0.08, 0, 0);
    setRotation(bones.rightLowerLeg, 0.035, 0, 0);

    const headBase = bones.head?.rotation.clone();
    const chestBase = bones.chest?.rotation.clone();
    const hipsBaseY = bones.hips?.position.y ?? 0;

    const bounds = new THREE.Box3().setFromObject(vrm.scene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    vrm.scene.position.sub(center);
    vrm.scene.position.y += size.y * 0.015;

    const distance = Math.max(size.y * 1.32, size.x * 2.1);
    camera.position.set(0, size.y * 0.01, distance);
    camera.lookAt(0, size.y * 0.01, 0);

    let pointerX = 0;
    let pointerY = 0;
    let smoothX = 0;
    let smoothY = 0;
    const onPointerMove = event => {
      const rect = stage.getBoundingClientRect();
      pointerX = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      pointerY = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
    };
    const onPointerLeave = () => { pointerX = 0; pointerY = 0; };
    stage.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerleave', onPointerLeave, { passive: true });

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

    let visible = true;
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px' });
    io.observe(stage);

    let nextBlink = 2.4 + Math.random() * 3;
    let blinkStart = -1;
    let elapsed = 0;
    let lastTime = performance.now();
    let raf = 0;
    let stopped = false;

    const tick = now => {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (!visible || document.hidden) return;
      elapsed += dt;
      smoothX = THREE.MathUtils.lerp(smoothX, pointerX, 0.08);
      smoothY = THREE.MathUtils.lerp(smoothY, pointerY, 0.08);

      if (bones.head && headBase) {
        bones.head.rotation.set(
          headBase.x + smoothY * 0.06,
          headBase.y - smoothX * 0.12,
          headBase.z - smoothX * 0.015
        );
      }
      if (!reducedMotion && bones.chest && chestBase) {
        bones.chest.rotation.set(
          chestBase.x + Math.sin(elapsed * 1.25) * 0.006,
          chestBase.y + Math.sin(elapsed * 0.48) * 0.004,
          chestBase.z + Math.sin(elapsed * 0.66) * 0.003
        );
      }
      if (!reducedMotion && bones.hips) bones.hips.position.y = hipsBaseY + Math.sin(elapsed * 1.25) * 0.002;

      const expressions = vrm.expressionManager;
      if (!reducedMotion && expressions) {
        if (blinkStart < 0 && elapsed >= nextBlink) blinkStart = elapsed;
        if (blinkStart >= 0) {
          const phase = (elapsed - blinkStart) / 0.16;
          const value = phase < 0.5 ? phase * 2 : Math.max(0, 2 - phase * 2);
          expressions.setValue('blink', THREE.MathUtils.clamp(value, 0, 1));
          if (phase >= 1) {
            expressions.setValue('blink', 0);
            blinkStart = -1;
            nextBlink = elapsed + 2.4 + Math.random() * 3.2;
          }
        }
      }

      vrm.update(dt);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      renderer.dispose();
    };
  }

  button.addEventListener('click', async () => {
    if (loading || loaded) return;
    loading = true;
    button.disabled = true;
    button.textContent = '読み込み中…';
    setStatus('3Dモデルの準備をしています…');
    try {
      dispose?.();
      dispose = await mountModel();
      loaded = true;
      canvas.hidden = false;
      poster.hidden = false;
      root.classList.add('is-live');
      button.hidden = true;
      setStatus(reducedMotion ? '3Dモデルを静止表示しています。' : '3Dモデルを表示中。視線がポインタを追います。');
    } catch (error) {
      console.error('[home-vrm] failed to load VRM', error);
      resetFallback('3D表示に失敗しました。静止画で表示しています。');
    } finally {
      loading = false;
    }
  });

  window.addEventListener('pagehide', () => dispose?.(), { once: true });
})();
