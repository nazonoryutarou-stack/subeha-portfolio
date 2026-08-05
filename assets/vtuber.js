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
      <p class="vtuber-kicker">VTUBER MODEL / 制作者の3D標本</p>
      <h2 id="vtuber-title">制作者の3D標本</h2>
      <p class="vtuber-intro">自然な立ち姿、表情、視線、呼吸の揺れを観測できます。モデルはボタンを押した時だけ読み込みます。</p>
      <div class="vtuber-actions">
        <button class="vtuber-start" type="button" data-vrm-start disabled>
          <span class="vtuber-start-icon" aria-hidden="true">◇</span>
          <span><strong>3Dモデルを読み込む</strong><small>約2.4MB</small></span>
        </button>
      </div>
    </div>
    <div class="vtuber-viewer">
      <div class="vtuber-stage" data-vrm-stage>
        <div class="vtuber-poster" aria-hidden="true"></div>
        <canvas class="vtuber-canvas" data-vrm-canvas aria-label="すべての歯が見えるの3Dモデル"></canvas>
        <button class="vtuber-stage-button vtuber-fit" type="button" data-view-fit hidden>全体を表示</button>
        <button class="vtuber-stage-button vtuber-reset" type="button" data-view-reset-stage hidden>正面に戻す</button>
        <div class="vtuber-help" data-vrm-help hidden>
          <strong>操作方法</strong>
          <span>左右にスワイプ：回転</span>
          <span>ピンチ：拡大／縮小</span>
          <span>ダブルタップ：正面へ</span>
        </div>
        <p class="vtuber-fallback">3D表示に失敗したため、静止画を表示しています。</p>
      </div>
      <div class="vtuber-expression-panel" data-vrm-controls hidden aria-label="表情切替">
        <p>表情切替</p>
        <div class="vtuber-expression-grid">
          <button type="button" data-expression="neutral" class="is-active"><b>●</b><span>平常</span></button>
          <button type="button" data-expression="happy"><b>☺</b><span>笑</span></button>
          <button type="button" data-expression="angry"><b>×</b><span>怒</span></button>
          <button type="button" data-expression="sad"><b>−</b><span>沈</span></button>
          <button type="button" data-expression="surprised"><b>○</b><span>驚</span></button>
        </div>
      </div>
    </div>
    <p class="vtuber-status" data-vrm-status aria-live="polite">表示時のみモデルデータを読み込みます。</p>`;

  main.append(section);

  const button = section.querySelector('[data-vrm-start]');
  const controls = section.querySelector('[data-vrm-controls]');
  const status = section.querySelector('[data-vrm-status]');
  const stage = section.querySelector('[data-vrm-stage]');
  const canvas = section.querySelector('[data-vrm-canvas]');
  const fitButton = section.querySelector('[data-view-fit]');
  const resetButton = section.querySelector('[data-view-reset-stage]');
  const help = section.querySelector('[data-vrm-help]');
  const base = location.hostname.endsWith('github.io') ? '/subeha-portfolio' : '';
  const modelUrl = `${base}/subeha-web-site.vrm`;
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData === true;
  let started = false;

  fetch(modelUrl, { method: 'HEAD', cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(`model unavailable: ${response.status}`);
    button.disabled = false;
    status.textContent = saveData
      ? 'データセーバー使用中です。押すまで約2.4MBのモデルは読み込みません。'
      : '押すと約2.4MBのモデルを読み込みます。';
  }).catch(() => {
    button.disabled = true;
    button.querySelector('strong').textContent = '3Dモデル準備中';
    status.textContent = 'モデルデータを確認できませんでした。静止画を表示しています。';
  });

  button.addEventListener('click', async () => {
    if (started) return;
    started = true;
    button.disabled = true;
    button.querySelector('strong').textContent = '読み込み中';
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
      const mobile = matchMedia('(max-width: 760px)').matches;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.2 : 1.65));
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
      scene.add(new THREE.HemisphereLight(0xfff4df, 0x17110d, 2.15));
      const key = new THREE.DirectionalLight(0xffdfad, 2.55);
      key.position.set(1.8, 2.7, 3.2);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x8b8179, 1.05);
      rim.position.set(-2.4, 1.3, -1.8);
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

      const bone = name => vrm.humanoid?.getNormalizedBoneNode?.(name);
      const bones = {
        hips: bone('hips'), spine: bone('spine'), chest: bone('chest'), upperChest: bone('upperChest'),
        neck: bone('neck'), head: bone('head'), leftShoulder: bone('leftShoulder'), rightShoulder: bone('rightShoulder'),
        leftUpperArm: bone('leftUpperArm'), rightUpperArm: bone('rightUpperArm'), leftLowerArm: bone('leftLowerArm'), rightLowerArm: bone('rightLowerArm'),
        leftUpperLeg: bone('leftUpperLeg'), rightUpperLeg: bone('rightUpperLeg'), leftLowerLeg: bone('leftLowerLeg'), rightLowerLeg: bone('rightLowerLeg')
      };

      const setRotation = (node, x = 0, y = 0, z = 0) => {
        if (!node) return;
        node.rotation.set(x, y, z);
      };

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

      const initialHead = bones.head?.rotation.clone();
      const initialChestScale = bones.chest?.scale.clone();
      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      vrm.scene.position.sub(center);
      vrm.scene.position.y += size.y * 0.015;

      const target = { x: 0, y: 0 };
      let bodyYaw = -0.16;
      let targetYaw = bodyYaw;
      let zoom = 1;
      let activeExpression = 'neutral';
      let dragging = false;
      let pointerStartX = 0;
      let yawStart = 0;
      let lastTap = 0;
      let pinchStart = 0;
      let zoomStart = 1;

      const expressionAliases = {
        happy: ['happy', 'joy', 'relaxed'],
        angry: ['angry'],
        sad: ['sad', 'sorrow'],
        surprised: ['surprised', 'surprise']
      };
      const availableExpressions = new Set(vrm.expressionManager?.expressions?.map(item => item.expressionName) || []);
      const resolveExpression = name => {
        if (name === 'neutral') return null;
        return expressionAliases[name]?.find(candidate => availableExpressions.has(candidate)) || expressionAliases[name]?.[0] || null;
      };

      const clearExpressions = () => {
        if (!vrm.expressionManager) return;
        availableExpressions.forEach(name => {
          if (name !== 'blink' && name !== 'blinkLeft' && name !== 'blinkRight') vrm.expressionManager.setValue(name, 0);
        });
      };

      const setExpression = name => {
        if (!vrm.expressionManager) return;
        clearExpressions();
        const resolved = resolveExpression(name);
        if (resolved) vrm.expressionManager.setValue(resolved, 1);
        activeExpression = name;
        controls.querySelectorAll('[data-expression]').forEach(control => {
          control.classList.toggle('is-active', control.dataset.expression === name);
        });
      };

      const fitView = () => {
        zoom = 1;
        const distance = Math.max(size.y * 1.32, size.x * 2.1);
        camera.position.set(0, size.y * 0.01, distance);
        camera.lookAt(0, size.y * 0.01, 0);
      };
      fitView();

      stage.addEventListener('pointerdown', event => {
        dragging = true;
        pointerStartX = event.clientX;
        yawStart = targetYaw;
        stage.setPointerCapture?.(event.pointerId);
      });
      stage.addEventListener('pointermove', event => {
        const rect = stage.getBoundingClientRect();
        target.x = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
        target.y = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
        if (dragging) targetYaw = THREE.MathUtils.clamp(yawStart + (event.clientX - pointerStartX) * 0.008, -1.1, 1.1);
      }, { passive: true });
      const endDrag = event => {
        dragging = false;
        stage.releasePointerCapture?.(event.pointerId);
      };
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);
      stage.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; }, { passive: true });
      stage.addEventListener('click', () => {
        const now = performance.now();
        if (now - lastTap < 320) {
          targetYaw = 0;
          target.x = 0;
          target.y = 0;
        }
        lastTap = now;
      });
      stage.addEventListener('touchstart', event => {
        if (event.touches.length !== 2) return;
        const [a, b] = event.touches;
        pinchStart = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        zoomStart = zoom;
      }, { passive: true });
      stage.addEventListener('touchmove', event => {
        if (event.touches.length !== 2 || !pinchStart) return;
        const [a, b] = event.touches;
        const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        zoom = THREE.MathUtils.clamp(zoomStart * (pinchStart / Math.max(distance, 1)), 0.72, 1.55);
      }, { passive: true });

      controls.addEventListener('click', event => {
        const expressionButton = event.target.closest('[data-expression]');
        if (expressionButton) setExpression(expressionButton.dataset.expression);
      });
      fitButton.addEventListener('click', fitView);
      resetButton.addEventListener('click', () => {
        targetYaw = 0;
        target.x = 0;
        target.y = 0;
        setExpression('neutral');
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
      const baseCameraZ = camera.position.z;

      const render = () => {
        raf = requestAnimationFrame(render);
        if (document.hidden) return;
        const delta = Math.min(clock.getDelta(), 0.05);
        elapsed += delta;

        bodyYaw = THREE.MathUtils.lerp(bodyYaw, targetYaw, 0.1);
        vrm.scene.rotation.y = bodyYaw;
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, baseCameraZ * zoom, 0.12);

        if (bones.head && initialHead && !prefersReducedMotion) {
          bones.head.rotation.x = THREE.MathUtils.lerp(bones.head.rotation.x, initialHead.x + target.y * 0.055, 0.045);
          bones.head.rotation.y = THREE.MathUtils.lerp(bones.head.rotation.y, initialHead.y + target.x * 0.09, 0.045);
        }
        if (bones.chest && initialChestScale && !prefersReducedMotion) {
          bones.chest.scale.y = initialChestScale.y * (1 + Math.sin(elapsed * 1.15) * 0.0022);
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
          const resolved = resolveExpression(activeExpression);
          if (resolved) vrm.expressionManager.setValue(resolved, 1);
        }

        vrm.update(delta);
        renderer.render(scene, camera);
      };
      render();

      stage.classList.add('is-live');
      controls.hidden = false;
      fitButton.hidden = false;
      resetButton.hidden = false;
      help.hidden = false;
      button.hidden = true;
      status.textContent = '左右にスワイプして回転。ピンチで拡大縮小。ダブルタップで正面に戻ります。';

      window.addEventListener('pagehide', () => {
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        renderer.dispose();
      }, { once: true });
    } catch (error) {
      console.error('[VTuber model]', error);
      stage.classList.add('has-error');
      button.disabled = false;
      button.hidden = false;
      button.querySelector('strong').textContent = 'もう一度試す';
      status.textContent = '3D表示に失敗しました。静止画はそのまま閲覧できます。';
      started = false;
    }
  });
})();
