(()=>{'use strict';
const ready=()=>document.documentElement.dataset.ready==='true';
const start=()=>{
  if(document.querySelector('[data-vrm-feature]'))return;
  const main=document.querySelector('#main');if(!main)return;
  const root=location.hostname.endsWith('github.io')?'/subeha-portfolio':'';
  const section=document.createElement('section');section.className='vrm-feature';section.dataset.vrmFeature='';section.innerHTML=`<div class="vrm-feature__copy"><p class="vrm-feature__eyebrow">3D MODEL / VIRTUAL BODY</p><h2>すべての歯が見える</h2><p>配信で使用している3Dモデル。</p></div><div class="vrm-stage" data-vrm-stage><img class="vrm-stage__poster" src="${root}/assets/vrm-poster.webp" alt="すべての歯が見えるの3Dモデル" width="640" height="800"><canvas aria-label="3Dモデル表示"></canvas><div class="vrm-stage__control"><button class="vrm-stage__button" type="button">3Dモデルを表示</button><p class="vrm-stage__status" role="status" aria-live="polite">約2MBのモデルデータを読み込みます</p></div><p class="vrm-stage__fallback">この端末では3D表示を開始できませんでした。</p></div>`;
  const hero=main.querySelector('section,header');hero?.after(section)||main.prepend(section);
  const stage=section.querySelector('[data-vrm-stage]'),button=section.querySelector('button'),status=section.querySelector('[role=status]'),canvas=section.querySelector('canvas');
  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('モデルデータの取得に失敗しました。'));document.head.append(s)});
  button.addEventListener('click',async()=>{
    button.disabled=true;button.textContent='読み込み中';window.__SUBEHA_VRM_GZ=[];
    try{
      if(!('WebGLRenderingContext'in window))throw new Error('WebGLに対応していません。');
      if(!('DecompressionStream'in window))throw new Error('このブラウザはモデル展開に対応していません。');
      for(let i=0;i<6;i++){status.textContent=`モデルデータ ${i+1} / 6`;await loadScript(`${root}/assets/vrm/subeha-${i}.js`)}
      const joined=window.__SUBEHA_VRM_GZ.join('');if(!joined)throw new Error('モデルデータが空です。');
      status.textContent='モデルを展開中';
      const compressed=Uint8Array.from(atob(joined),c=>c.charCodeAt(0));
      const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      const buffer=await new Response(stream).arrayBuffer();
      window.__SUBEHA_VRM_GZ.length=0;
      const modelUrl=URL.createObjectURL(new Blob([buffer],{type:'model/gltf-binary'}));
      status.textContent='表示を準備中';
      const viewer=await import(`${root}/assets/vrm-viewer.mjs`);
      await viewer.mountVRM({canvas,stage,modelUrl,onProgress:p=>{if(Number.isFinite(p))status.textContent=`モデルを準備中 ${Math.round(p*100)}%`}});
      stage.classList.add('is-live');status.textContent='表示中';
    }catch(error){console.error(error);stage.classList.add('is-error');status.textContent=error?.message||'3D表示に失敗しました。';button.disabled=false;button.textContent='もう一度試す'}
  });
};
if(ready())start();else{const observer=new MutationObserver(()=>{if(ready()){observer.disconnect();start()}});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-ready']})}
})();
