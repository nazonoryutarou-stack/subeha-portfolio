(() => {
  'use strict';

  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  if (!path.endsWith('/creator/')) return;

  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-vtuber-lab]')) return;

  const PART_COUNT = 27;
  const section = document.createElement('section');
  section.className = 'vtuber-lab';
  section.dataset.vtuberLab = '';
  section.setAttribute('aria-labelledby', 'vtuber-title');
  section.innerHTML = `
    <div class="vtuber-copy">
      <p class="vtuber-kicker">VTUBER MODEL / すべての歯が見える</p>
      <h2 id="vtuber-title">3Dモデル</h2>
      <p class="vtuber-description">軽量化したモデルを分割保管し、閲覧時だけ端末内で復元します。</p>
      <div class="vtuber-actions">
        <button class="vtuber-start" type="button" data-vrm-start disabled>3Dモデルを確認中</button>
      </div>
      <div class="vtuber-progress" data-vrm-progress role="progressbar" aria-label="3Dモデルデータの準備状況" aria-valuemin="0" aria-valuemax="${PART_COUNT}" aria-valuenow="0">
        <span data-vrm-progress-bar></span>
      </div>
      <p class="vtuber-status" data-vrm-status aria-live="polite">モデルデータの配置を確認しています。</p>
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
  const progress = section.querySelector('[data-vrm-progress]');
  const progressBar = section.querySelector('[data-vrm-progress-bar]');
  const base = location.hostname.endsWith('github.io') ? '/subeha-portfolio' : '';
  const directModelUrl = `${base}/assets/vrm/subeha-web.vrm`;
  const partUrls = Array.from({ length: PART_COUNT }, (_, index) =>
    `${base}/assets/vrm/lite-${String(index).padStart(2, '0')}.b64`
  );
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;

  let started = false;
  let source = null;
  let objectUrl = null;

  const setProgress = (value) => {
    const safeValue = Math.max(0, Math.min(PART_COUNT, value));
    progress.setAttribute('aria-valuenow', String(safeValue));
    progressBar.style.width = `${(safeValue / PART_COUNT) * 100}%`;
  };

  const headExists = async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    }
  };

  const inspectModelAssets = async () => {
    if (await headExists(directModelUrl)) {
      source = { type: 'direct', url: directModelUrl };
      setProgress(PART_COUNT);
      progress.classList.add('is-complete');
      button.disabled = false;
      button.textContent = '3Dモデルを表示';
      status.textContent = saveData
        ? 'データセーバー使用中です。押すまで3Dデータは読み込みません。'
        : '表示時のみモデルデータを読み込みます。';
      return;
    }

    const availability = await Promise.all(partUrls.map(headExists));
    const available = availability.filter(Boolean).length;
    setProgress(available);

    if (available === PART_COUNT) {
      source = { type: 'parts', urls: partUrls };
      progress.classList.add('is-complete');
      button.disabled = false;
      button.textContent = '3Dモデルを復元して表示';
      status.textContent = saveData
        ? '全27片を確認済み。押すまでモデルデータは読み込みません。'
        : '全27片を確認済み。閲覧時に端末内で復元します。';
      return;
    }

    button.disabled = true;
    button.textContent = `3Dモデル準備中 ${available}/${PART_COUNT}`;
    status.textContent = available > 0
      ? `軽量モデルは現在 ${available}/${PART_COUNT} 片まで配置済みです。静止画版は閲覧できます。`
      : '軽量モデルの分割データはまだ配置されていません。静止画版を表示しています。';
  };

  const decodeBase64 = (text) => {
    const normalized = text.replace(/\s+/g, '');
    const binary = atob(normalized);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  };

  const restoreSplitModel = async (urls) => {
    if (!('DecompressionStream' in window)) {
      throw new Error('DecompressionStream is not supported');
    }

    let loaded = 0;
    const parts = await Promise.all(urls.map(async (url) => {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`model part unavailable: ${response.status}`);
      const text = await response.text();
      loaded += 1;
      status.textContent = `モデルデータを読み込み中… ${loaded}/${PART_COUNT}`;
      return text;
    }));

    status.textContent = '分割データを結合し、モデルを復元しています…';
    const compressed = decodeBase64(parts.join(''));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const restored = await new Response(stream).blob();
    objectUrl = URL.createObjectURL(new Blob([restored], { type: 'model/gltf-binary' }));
    return objectUrl;
  };

  const getModelUrl = async () => {
    if (!source) throw new Error('model source is not ready');
    if (source.type === 'direct') return source.url;
    return restoreSplitModel(source.urls);
  };

  button.addEventListener('click', async () => {
    if (started || !source) return;
    started = true;
    button.disabled = true;
    button.textContent = '読み込み中';
    status.textContent = '表示エンジンを準備しています…';

    try {
      const [THREE, loaderModule, vrmModule, modelUrl] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('@pixiv/three-vrm'),
        getModelUrl()
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
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }, { once: true });
    } catch (error) {
      console.error('[VTuber model]', error);
      stage.classList.add('has-error');
      button.disabled = false;
      button.textContent = 'もう一度試す';
      status.textContent = '3D表示に失敗しました。静止画はそのまま閲覧できます。';
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      started = false;
    }
  });

  inspectModelAssets();
})();
