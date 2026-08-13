(function(){
  'use strict';
  var base=location.hostname.endsWith('github.io')?'/subeha-portfolio':'';

  function ensureTheme(){
    var css=document.querySelector('link[data-unified-shell],link[href$="assets/unified-shell.css"]');
    if(!css){
      css=document.createElement('link');
      css.rel='stylesheet';
      css.href=base+'/assets/unified-shell.css';
      css.dataset.unifiedShell='true';
    }
    document.head.appendChild(css);
  }

  function forceReadableShell(){
    var id='unified-shell-hotfix';
    var style=document.getElementById(id);
    if(!style){
      style=document.createElement('style');
      style.id=id;
      document.head.appendChild(style);
    }
    style.textContent=[
      'html,body{background:#f3efe4!important;color:#161514!important}',
      'body:before,body:after{display:none!important;background:none!important}',
      '#main,main{background:#f3efe4!important;color:#161514!important}',
      '#main>*,#main section,#main article,#main .hero,#main .section,#main .page-hero,#main .section-hero{background:#f3efe4!important;color:#161514!important}',
      '#main h1,#main h2,#main h3,#main h4,#main h5,#main h6{color:#161514!important;text-shadow:none!important;opacity:1!important}',
      '#main p,#main li,#main dd,#main dt,#main blockquote,#main figcaption,#main label,#main td,#main th,#main strong,#main b,#main span{color:#2b2824!important;text-shadow:none!important;opacity:1!important}',
      '#main .eyebrow,#main .kicker,#main .label,#main .section-label,#main small,#main .muted,#main [class*="meta"],#main [class*="caption"]{color:#6b645b!important;opacity:1!important}',
      '#main .card,#main .panel,#main .tile,#main [class*="card"],#main [class*="panel"],#main [class*="record"],#main [class*="item"]{background:#fbf8f0!important;color:#161514!important;border-color:#cfc6b7!important;box-shadow:none!important}',
      '#main a{color:#161514!important}',
      '#main button,#main .button,#main .btn,#main [role="button"]{color:#161514!important;border-color:#161514!important;background:#fbf8f0!important}',
      '#main .primary,#main .cta-primary,#main button.primary,#main .button.primary,#main .btn.primary{background:#151412!important;color:#f3efe4!important}',
      '#main input,#main textarea,#main select{background:#fbf8f0!important;color:#161514!important;border-color:#cfc6b7!important}',
      '#main img,#main video,#main canvas,#main svg{opacity:1!important}',
      '.site-header{background:rgba(243,239,228,.98)!important;color:#161514!important}',
      '.site-header .logo,.site-header .logo b,.site-header .menu-button,.global-nav,.global-nav a{color:#161514!important}',
      '.global-nav{background:#fbf8f0!important;border-color:#cfc6b7!important}',
      '.site-footer{background:#151412!important;color:#f3efe4!important}.site-footer *{color:inherit!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function repairBrand(){
    var logo=document.querySelector('.site-header .logo');
    if(logo) logo.setAttribute('href',base+'/home.html');
    document.querySelectorAll('img.brand-crest').forEach(function(img){
      img.src=base+'/hitotsu-ore-choji.png';
      img.alt='一つ折れ丁字';
    });
  }

  function addLinks(){
    if(document.querySelector('[data-legal-links]')) return;
    var footer=document.querySelector('.footer-bottom')||document.querySelector('.site-footer');
    if(!footer) return;
    var nav=document.createElement('nav');
    nav.className='legal-nav';
    nav.dataset.legalLinks='true';
    nav.setAttribute('aria-label','法務情報');
    var items=[['特定商取引法に基づく表記','/tokusho/'],['お問い合わせ','/contact/'],['コンテンツ一覧','/contents/'],['ホーム','/home.html']];
    items.forEach(function(item){
      var a=document.createElement('a');
      a.textContent=item[0];
      a.href=base+item[1];
      nav.appendChild(a);
    });
    footer.appendChild(nav);
  }

  function run(){
    ensureTheme();
    forceReadableShell();
    repairBrand();
    addLinks();
    requestAnimationFrame(function(){ensureTheme();forceReadableShell();});
    setTimeout(function(){ensureTheme();forceReadableShell();},100);
    setTimeout(forceReadableShell,500);
  }

  if(document.documentElement.dataset.ready==='true') run();
  else {
    var observer=new MutationObserver(function(){
      if(document.documentElement.dataset.ready==='true'){
        observer.disconnect();
        run();
      }
    });
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-ready']});
  }
})();
