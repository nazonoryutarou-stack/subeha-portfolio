(() => {
  'use strict';

  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  if (!path.endsWith('/creator/')) return;

  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-vtuber-lab]')) return;

  const section = document.createElement('section');
  section.className = 'vtuber-lab';
  section.dataset.vtuberLab = '';
  section.setAttribute('aria-labelledby', 'vtuber-title');
  section.innerHTML = `
    <div class="vtuber-copy">
      <p class="vtuber-kicker">VTUBER MODEL / すべての歯が見える</p>
      <h2 id="vtuber-title">3Dモデル</h2>
      <div class="vtuber-actions">
        <button class="vtuber-start" type="button" data-vrm-start disabled>3Dモデルを確認中</button>
      </div>
      <p class="vtuber-status" data-vrm-status aria-live="polite">表示時のみモデルデータを読み込みます。</p>
    </div>
    <div class="vtuber-stage" data-vrm-stage>
      <div class="vtuber-poster" aria-hidden="true"></div>
      <canvas class="vtuber-canvas" data-vrm-canvas aria-label="すべての歯が見えるの3Dモデル"></canvas>
      <p class="vtuber-fallback">3D表示に失敗したため、静止画を表示しています。</p>
    </div>`;

  main.append(section);

  const button = section.querySelector('[data-vrm-start]');
  const status = section.querySelector('[data-vrm-status]');
  const stage = section.querySelector('[data-vrm-stage]');
  const canvas = section.querySelector('[data-vrm-canvas]');
  const base = location.hostname.endsWith('github.io') ? '/subeha-portfolio' : '';
  const modelUrl = `${base}/assets/vrm/subeha-web.vrm`;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  let started = false;

  fetch(modelUrl, { method: 'HEAD', cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`model unavailable: ${response.status}`);
    button.disabled = false;
    button.textContent = '3Dモデルを表示';
    status.textContent = saveData
      ? 'データセーバー使用中です。押すまで3Dデータは読み込みません。'
      : '表示時のみモデルデータを読み込みます。';
  }).catch(() => {
    button.disabled = true;
    button.textContent = '3Dモデル準備中';
    status.textContent = '静止画版を先行公開しています。';
  });

  button.addEventListener('click', async () => {
    if (started) return;
    started = true;
    button.disabled = true;
    button.textContent = '読み込み中';
    status.textContent = 'モデルデータを読み込んでいます…';

    try {
      const [THREE, loaderModule, vrmModule] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('@pixiv/three-vrm')
      ]);
      const { GLTFLoader } = loaderModule;
      const { VRMLoaderPlugin, VRMUtils } = vrmModule;

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
      scene.add(new THREE.HemisphereLight(0xfff1d7, 0x18110d, 2.1));
      const key = new THREE.DirectionalLight(0xffdfad, 2.7);
      key.position.set(1.6, 2.4, 2.8);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x668a87, 1.1);
      rim.position.set(-2.4, 1.1, -1.5);
      scene.add(rim);

      const loader = new GLTFLoader();
      loader.register(parser => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(modelUrl);
      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error('VRM data was not found');

      VRMUtils.removeUnnecessaryVertices?.(vrm.scene);
      VRMUtils.combineSkeletons?.(vrm.scene);
      VRMUtils.rotateVRM0?.(vrm);
      scene.add(vrm.scene);

      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      vrm.scene.position.sub(center);
      vrm.scene.position.y += size.y * 0.02;
      const distance = Math.max(size.y * 1.45, size.x * 2.15);
      camera.position.set(0, size.y * 0.03, distance);
      camera.lookAt(0, size.y * 0.03, 0);

      const head = vrm.humanoid?.getNormalizedBoneNode?.('head');
      const chest = vrm.humanoid?.getNormalizedBoneNode?.('chest');
      const initialHead = head?.rotation.clone();
      const initialChestScale = chest?.scale.clone();
      const target = { x: 0, y: 0 };

      stage.addEventListener('pointermove', event => {
        const rect = stage.getBoundingClientRect();
        target.x = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
        target.y = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
      }, { passive: true });
      stage.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; }, { passive: true });

      const resize = () => {
        const rect = stage.getBoundingClientRect();
        renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
        camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(stage);
      resize();

      const clock = new THREE.Clock();
      let blinkAt = 2.5 + Math.random() * 2.5;
      let elapsed = 0;
      let raf = 0;

      const render = () => {
        raf = requestAnimationFrame(render);
        if (document.hidden) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        elapsed += delta;

        if (head && initialHead && !prefersReducedMotion) {
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, initialHead.x + target.y * 0.075, 0.045);
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, initialHead.y + target.x * 0.13, 0.045);
        }
        if (chest && initialChestScale && !prefersReducedMotion) {
          chest.scale.y = initialChestScale.y * (1 + Math.sin(elapsed * 1.2) * 0.0025);
        }

        if (vrm.expressionManager && !prefersReducedMotion) {
          const phase = elapsed - blinkAt;
          let blink = 0;
          if (phase >= 0 && phase < 0.17) blink = Math.sin((phase / 0.17) * Math.PI);
          if (phase >= 0.17) {
            blinkAt = elapsed + 2.6 + Math.random() * 3.2;
            blink = 0;
          }
          vrm.expressionManager.setValue('blink', blink);
        }

        vrm.update(delta);
        renderer.render(scene, camera);
      };
      render();

      stage.classList.add('is-live');
      button.textContent = '3D表示中';
      status.textContent = '視線がポインターを追います。';

      window.addEventListener('pagehide', () => {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        renderer.dispose();
      }, { once: true });
    } catch (error) {
      console.error('[VTuber model]', error);
      stage.classList.add('has-error');
      button.disabled = false;
      button.textContent = 'もう一度試す';
      status.textContent = '3D表示に失敗しました。静止画はそのまま閲覧できます。';
      started = false;
    }
  });
})();
