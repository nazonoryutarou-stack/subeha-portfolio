(()=>{
  'use strict';
  const assetBase=location.hostname.endsWith('github.io')?'/subeha-portfolio':'';
  const ready=()=>document.documentElement.dataset.ready==='true'&&document.querySelector('#main')&&document.querySelector('.site-header');
  const run=()=>{
    if(!ready()) return false;
    if(document.querySelector('link[data-home-redesign]')) return true;

    const css=document.createElement('link');
    css.rel='stylesheet';
    css.href=assetBase+'/assets/home-redesign.css';
    css.dataset.homeRedesign='1';
    document.head.append(css);

    document.title='すべての歯が見える';
    const desc=document.querySelector('meta[name="description"]');
    if(desc) desc.content='霊能を感覚のままにせず、観測・研究・祭祀技術として組み直す。すべての歯が見えるの公式サイト。';

    const logo=document.querySelector('.site-header .logo');
    if(logo){
      logo.setAttribute('href',assetBase+'/home.html');
      logo.innerHTML=`<img class="brand-crest" src="${assetBase}/hitotsu-ore-choji.png" alt="一つ折れ丁字"><span><b>すべての歯が見える</b><small>SPECTRUM RESEARCH</small></span>`;
    }

    const nav=document.querySelector('.global-nav');
    if(nav){
      nav.innerHTML=`
        <a href="${assetBase}/products/">製品</a>
        <a href="${assetBase}/research/">研究</a>
        <a href="${assetBase}/quality/">霊務品質</a>
        <a href="${assetBase}/creator/">制作者</a>
      `;
    }

    const main=document.querySelector('#main');
    main.innerHTML=`
      <div class="brand-home">
        <section class="brand-hero">
          <p class="brand-kicker">ESTABLISHED 2019.11.11 / SPECTRUM RESEARCH</p>
          <h1>霊能を、<br>技術として<br>組み直す。</h1>
          <p class="brand-lead">すべての歯が見えるは、霊視・祭祀・呪文・護符・式神などを、観測、仮説、実験、改良の対象として扱っています。安易に安心させません。不安も売りません。分かるところまで説明し、分からないところは未確定のまま記録します。</p>
          <div class="brand-actions">
            <a class="primary" href="${assetBase}/research/">何をしているか</a>
            <a href="${assetBase}/products/">製品を見る</a>
          </div>
        </section>

        <section class="motto" aria-labelledby="motto-title">
          <h2 class="motto-copy" id="motto-title">呪われてても<br>心は錦</h2>
          <p class="motto-note">これは安心の約束ではなく、態度の話です。霊的な問題があるとしても、現実の生活を捨てない。怖い話を怖いまま扱いながら、食べて、寝て、働いて、必要なら逃げる。そのための道具と方法を作ります。</p>
        </section>

        <section class="home-nav" aria-labelledby="home-nav-title">
          <p class="section-label">ENTRANCE / 04</p>
          <h2 id="home-nav-title">入口</h2>
          <div class="nav-grid">
            <a class="nav-card" href="${assetBase}/research/"><small>01 / RESEARCH</small><strong>研究</strong><span>仮説、検証、失敗、改訂。現在の理論を見る。</span></a>
            <a class="nav-card" href="${assetBase}/products/"><small>02 / PRODUCTS</small><strong>製品</strong><span>妹字、式神、祭祀具など、実際に作っているもの。</span></a>
            <a class="nav-card" href="${assetBase}/quality/"><small>03 / PRACTICE</small><strong>霊視・霊務</strong><span>できること、できないこと、依頼を断る条件。</span></a>
            <a class="nav-card" href="${assetBase}/creator/"><small>04 / CREATOR</small><strong>制作者</strong><span>すべての歯が見えるについて。</span></a>
          </div>
        </section>

        <section class="products-preview" aria-labelledby="products-title">
          <p class="section-label">CURRENT IMPLEMENTATIONS</p>
          <h2 id="products-title">現在の実装</h2>
          <div class="product-row">
            <a class="product-mini" href="${assetBase}/brands/imoji/"><span class="code">IMJ / PERSONAL STRING</span><h3>妹字</h3><p>個人の目的に合わせて一文字を設計し、必要に応じて実物を発行する。</p></a>
            <a class="product-mini" href="${assetBase}/brands/shikigami/"><span class="code">SHK / SHIKIGAMI</span><h3>式神</h3><p>古い術法をそのまま保存せず、用途と材料から組み直す。</p></a>
            <a class="product-mini" href="${assetBase}/research/"><span class="code">LOG / REVISION</span><h3>研究記録</h3><p>採用した仮説だけでなく、棄却したものと改訂理由も残す。</p></a>
          </div>
        </section>
      </div>`;

    const footerBrand=document.querySelector('.footer-brand');
    if(footerBrand){
      footerBrand.innerHTML=`<img class="brand-crest" src="${assetBase}/hitotsu-ore-choji.png" alt="一つ折れ丁字"><div><b>すべての歯が見える</b><p>霊能を、観測・研究・祭祀技術として組み直す。</p></div>`;
    }

    document.querySelectorAll('body *').forEach(el=>{
      if(el.children.length===0 && el.textContent.includes('不氣屋界隈')) el.textContent=el.textContent.replaceAll('不氣屋界隈','すべての歯が見える');
    });
    return true;
  };

  if(run()) return;
  const observer=new MutationObserver(()=>{if(run()) observer.disconnect();});
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ready']});
  setTimeout(()=>{if(run()) observer.disconnect();},2500);
})();
