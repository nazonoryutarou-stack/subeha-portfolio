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
      <h2 id="vtuber-title">制作者の3D標本</h2>
      <p class="vtuber-intro">静止画では確認できない表情、視線、呼吸の揺れを観測できます。モデルデータはボタンを押した時だけ読み込みます。</p>
      <div class="vtuber-actions">
        <button class="vtuber-start" type="button" data-vrm-start disabled>3Dモデルを確認中</button>
      </div>
      <div class="vtuber-controls" data-vrm-controls hidden aria-label="3Dモデル操作">
        <span>表情</span>
        <button type="button" data-expression="neutral" class="is-active">平常</button>
        <button type="button" data-expression="happy">笑</button>
        <button type="button" data-expression="angry">怒</button>
        <button type="button" data-expression="sad">沈</button>
        <button type="button" data-expression="surprised">驚</button>
        <button type="button" data-view-reset>正面へ戻す</button>
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
  const controls = section.querySelector('[data-vrm-controls]');
  const status = section.querySelector('[data-vrm-status]');
  const stage = section.querySelector('[data-vrm-stage]');
  const canvas = section.querySelector('[data-vrm-canvas]');
  const base = location.hostname.endsWith('github.io') ? '/subeha-portfolio' : '';
  const modelUrl = `${base}/subeha-web-site.vrm`;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  let started = false;

  fetch(modelUrl, { method: 'HEAD', cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`model unavailable: ${response.status}`);
    button.disabled = false;
    button.textContent = '3Dモデルを表示';
    status.textContent = saveData
      ? 'データセーバー使用中です。押すまで約2.4MBのモデルは読み込みません。'
      : '押すと約2.4MBのモデルを読み込みます。';
  }).catch(() => {
    button.disabled = true;
    button.textContent = '3Dモデル準備中';
    status.textContent = 'モデルデータを確認できませんでした。静止画を表示しています。';
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
      let bodyYaw = 0;
      let activeExpression = 'neutral';

      stage.addEventListener('pointermove', event => {
        const rect = stage.getBoundingClientRect();
        target.x = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
        target.y = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
      }, { passive: true });
      stage.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; }, { passive: true });
      stage.addEventListener('wheel', event => {
        if (!event.shiftKey) return;
        event.preventDefault();
        bodyYaw = THREE.MathUtils.clamp(bodyYaw + event.deltaY * 0.0008, -0.55, 0.55);
      }, { passive: false });

      const setExpression = name => {
        if (!vrm.expressionManager) return;
        ['happy', 'angry', 'sad', 'relaxed', 'surprised'].forEach(key => vrm.expressionManager.setValue(key, 0));
        if (name !== 'neutral') vrm.expressionManager.setValue(name, 0.82);
        activeExpression = name;
        controls.querySelectorAll('[data-expression]').forEach(control => {
          control.classList.toggle('is-active', control.dataset.expression === name);
        });
      };

      controls.addEventListener('click', event => {
        const expressionButton = event.target.closest('[data-expression]');
        if (expressionButton) setExpression(expressionButton.dataset.expression);
        if (event.target.closest('[data-view-reset]')) {
          target.x = 0;
          target.y = 0;
          bodyYaw = 0;
          setExpression('neutral');
        }
      });

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

        vrm.scene.rotation.y = THREE.MathUtils.lerp(vrm.scene.rotation.y, bodyYaw, 0.06);
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
          if (activeExpression !== 'neutral') vrm.expressionManager.setValue(activeExpression, 0.82);
        }

        vrm.update(delta);
        renderer.render(scene, camera);
      };
      render();

      stage.classList.add('is-live');
      controls.hidden = false;
      button.textContent = '3D表示中';
      status.textContent = '視線はポインターを追います。Shift＋スクロールで身体の向きを変えられます。';

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
