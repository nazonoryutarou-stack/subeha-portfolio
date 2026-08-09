(() => {
  'use strict';
  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  if (path !== '/') return;

  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-home-showcase]')) return;
  const base = location.hostname.endsWith('github.io') ? '/subeha-portfolio' : '';

  const section = document.createElement('section');
  section.className = 'home-showcase';
  section.dataset.homeShowcase = '';
  section.innerHTML = `
    <div class="home-showcase-copy">
      <p class="home-showcase-kicker">RITUAL TECHNICIAN / ARTIST / ARCHIVE</p>
      <h1>すべての歯が<br>見える</h1>
      <p class="home-showcase-lead">祭祀、異物、記録、配信。霊能を見世物だけで終わらせず、そこから出てきた考えや物体を作品として残しています。</p>
      <div class="home-showcase-actions">
        <a class="is-primary" href="/products/">作品と製品を見る</a>
        <a href="/works/">作品記録</a>
        <a href="/creator/">制作者について</a>
      </div>
    </div>
    <div class="home-vrm-card" data-home-vrm-card>
      <div class="home-vrm-meta"><strong>制作者の3D標本</strong><span>VRM / BUST VIEW</span></div>
      <div class="home-vrm-stage" data-home-vrm-stage>
        <div class="home-vrm-placeholder">
          <div><span>◇</span><p>ホームでは軽量化のため、必要な時だけ3Dモデルを読み込みます。</p><button class="home-vrm-load" type="button" data-home-vrm-load>3Dモデルを表示</button></div>
        </div>
        <canvas class="home-vrm-canvas" data-home-vrm-canvas aria-label="すべての歯が見えるの3Dモデル"></canvas>
        <div class="home-vrm-badge">LIVE SPECIMEN</div>
        <p class="home-vrm-status" data-home-vrm-status>約2.4MB / タップで読込</p>
      </div>
    </div>
    <div class="home-shelf">
      <div class="home-shelf-head"><div><p class="home-showcase-kicker">FROM THE WORKSHOP</p><h2>工房の棚</h2></div><p>売り物も、まだ売り物じゃない物も置く。</p></div>
      <div class="home-shelf-grid">
        <a class="home-shelf-card" href="/brands/imoji/"><small>SHELF 01</small><b>妹字・御札</b><span>貼る文字、持ち歩く文字、意味のありそうな紙片。</span></a>
        <a class="home-shelf-card" href="/brands/kuro-teruteru/"><small>SHELF 02</small><b>祭祀具・異物製品</b><span>手で作った小型祭祀物と一点物。</span></a>
        <a class="home-shelf-card" href="/works/"><small>SHELF 03</small><b>作品記録</b><span>売れた物、壊れた物、まだ名前のない物の記録。</span></a>
      </div>
    </div>`;
  main.prepend(section);

  const card = section.querySelector('[data-home-vrm-card]');
  const stage = section.querySelector('[data-home-vrm-stage]');
  const canvas = section.querySelector('[data-home-vrm-canvas]');
  const button = section.querySelector('[data-home-vrm-load]');
  const status = section.querySelector('[data-home-vrm-status]');
  const modelUrl = `${base}/subeha-web-site.vrm`;
  let started = false;

  button.addEventListener('click', async () => {
    if (started) return;
    started = true;
    button.disabled = true;
    button.textContent = '読み込み中…';
    status.textContent = '3Dモデルを読み込んでいます';

    try {
      const [THREE, loaderModule, vrmModule] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js'),
        import('https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/loaders/GLTFLoader.js'),
        import('https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.5.3/lib/three-vrm.module.min.js')
      ]);
      const { GLTFLoader } = loaderModule;
      const { VRMLoaderPlugin, VRMUtils } = vrmModule;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(max-width:760px)').matches ? 1.15 : 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(27, 1, 0.01, 100);
      scene.add(new THREE.HemisphereLight(0xfff1d9, 0x160f0a, 2.25));
      const key = new THREE.DirectionalLight(0xffd99d, 2.65); key.position.set(1.8, 2.5, 3.1); scene.add(key);
      const rim = new THREE.DirectionalLight(0x7e8796, .85); rim.position.set(-2, 1.5, -2); scene.add(rim);

      const loader = new GLTFLoader();
      loader.register(parser => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(modelUrl);
      const vrm = gltf.userData.vrm;
      if (!vrm) throw new Error('VRM not found');
      VRMUtils.removeUnnecessaryVertices?.(vrm.scene);
      VRMUtils.combineSkeletons?.(vrm.scene);
      VRMUtils.rotateVRM0?.(vrm);
      scene.add(vrm.scene);

      const bounds = new THREE.Box3().setFromObject(vrm.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      vrm.scene.position.sub(center);
      vrm.scene.position.y -= size.y * .17;
      vrm.scene.rotation.y = -0.08;
      camera.position.set(0, size.y * .17, Math.max(size.y * .72, size.x * 1.7));
      camera.lookAt(0, size.y * .12, 0);

      const head = vrm.humanoid?.getNormalizedBoneNode?.('head');
      const chest = vrm.humanoid?.getNormalizedBoneNode?.('chest');
      const initialHead = head?.rotation.clone();
      const initialChest = chest?.rotation.clone();
      let pointerX = 0, pointerY = 0;
      stage.addEventListener('pointermove', e => {
        const r = stage.getBoundingClientRect();
        pointerX = ((e.clientX - r.left) / r.width - .5) * 2;
        pointerY = ((e.clientY - r.top) / r.height - .5) * 2;
      }, { passive:true });
      stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; }, { passive:true });

      const resize = () => {
        const r = stage.getBoundingClientRect();
        renderer.setSize(Math.max(1,r.width), Math.max(1,r.height), false);
        camera.aspect = Math.max(1,r.width)/Math.max(1,r.height);
        camera.updateProjectionMatrix();
      };
      new ResizeObserver(resize).observe(stage); resize();
      const clock = new THREE.Clock();
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const render = () => {
        requestAnimationFrame(render);
        const t = performance.now() * .001;
        const dt = Math.min(clock.getDelta(), .05);
        if (!reduced) {
          vrm.scene.rotation.y += ((-0.08 + pointerX * .12) - vrm.scene.rotation.y) * .05;
          if (head && initialHead) {
            head.rotation.x = initialHead.x + pointerY * -.035 + Math.sin(t*.75)*.008;
            head.rotation.y = initialHead.y + pointerX * .08;
          }
          if (chest && initialChest) chest.rotation.z = initialChest.z + Math.sin(t*.9)*.008;
        }
        vrm.update(dt);
        renderer.render(scene,camera);
      };
      render();
      card.classList.add('is-ready');
      status.textContent = '視線に合わせて少し動きます';
    } catch (error) {
      console.error(error);
      started = false;
      button.disabled = false;
      button.textContent = 'もう一度試す';
      status.textContent = '3D表示に失敗しました';
    }
  });
})();