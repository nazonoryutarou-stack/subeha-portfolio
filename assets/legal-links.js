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
      '#main>*,#main section,#main article,#main .hero,#main .section,#main .page-hero,#main .section-hero{color:#161514!important}',
      '#main h1,#main h2,#main h3,#main h4,#main h5,#main h6{color:#161514!important;text-shadow:none!important;opacity:1!important}',
      '#main p,#main li,#main dd,#main dt,#main blockquote,#main figcaption,#main label,#main td,#main th,#main strong,#main b,#main span{color:#2b2824!important;text-shadow:none!important;opacity:1!important}',
      '#main .eyebrow,#main .kicker,#main .label,#main .section-label,#main small,#main .muted,#main [class*="meta"],#main [class*="caption"]{color:#6b645b!important;opacity:1!important}',
      '#main .card,#main .panel,#main .tile,#main [class*="card"],#main [class*="panel"],#main [class*="record"],#main [class*="item"]{color:#161514!important;border-color:#cfc6b7!important}',
      '#main a{color:#161514!important}',
      '#main button,#main .button,#main .btn,#main [role="button"]{color:#161514!important;border-color:#161514!important}',
      '#main .primary,#main .cta-primary,#main button.primary,#main .button.primary,#main .btn.primary{background:#151412!important;color:#f3efe4!important}',
      '#main input,#main textarea,#main select{background:#fbf8f0!important;color:#161514!important;border-color:#cfc6b7!important}',
      '#main img,#main video,#main canvas,#main svg{opacity:1!important}',
      '#main .auto-dark-surface,#main .auto-dark-surface *{color:#f3efe4!important;text-shadow:none!important;opacity:1!important}',
      '#main .auto-dark-surface h1,#main .auto-dark-surface h2,#main .auto-dark-surface h3,#main .auto-dark-surface h4{color:#f3efe4!important}',
      '#main .auto-dark-surface p,#main .auto-dark-surface li,#main .auto-dark-surface span,#main .auto-dark-surface strong,#main .auto-dark-surface b{color:#e0d8ca!important}',
      '#main .auto-dark-surface .eyebrow,#main .auto-dark-surface .kicker,#main .auto-dark-surface small,#main .auto-dark-surface .muted,#main .auto-dark-surface [class*="meta"],#main .auto-dark-surface [class*="caption"]{color:#b8afa0!important}',
      '#main .auto-dark-surface a{color:#f3efe4!important}',
      '.site-header{background:rgba(243,239,228,.98)!important;color:#161514!important}',
      '.site-header .logo,.site-header .logo b,.site-header .menu-button,.global-nav,.global-nav a{color:#161514!important}',
      '.global-nav{background:#fbf8f0!important;border-color:#cfc6b7!important}',
      '.site-footer{background:#151412!important;color:#f3efe4!important}.site-footer *{color:inherit!important}'
    ].join('');
    document.head.appendChild(style);
  }

  function parseColor(value){
    var m=String(value||'').match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/i);
    if(!m) return null;
    return {r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:+m[4]};
  }

  function luminance(c){
    function chan(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}
    return 0.2126*chan(c.r)+0.7152*chan(c.g)+0.0722*chan(c.b);
  }

  function markAutomaticDarkSurfaces(root){
    root.querySelectorAll('*').forEach(function(el){
      var cs=getComputedStyle(el);
      var bg=parseColor(cs.backgroundColor);
      var hasImage=cs.backgroundImage&&cs.backgroundImage!=='none';
      var darkBg=bg&&bg.a>0.45&&luminance(bg)<0.09;
      if(darkBg||hasImage){
        var rect=el.getBoundingClientRect();
        if(rect.width>180&&rect.height>120) el.classList.add('auto-dark-surface');
      }
    });
  }

  function markNamedDarkPanels(root){
    var labels=[
      'PRODUCT INFORMATION',
      'RESEARCH & DEVELOPMENT',
      'READING / PROCEDURE',
      'PROVISIONAL TERM / TESSHI'
    ];

    root.querySelectorAll('*').forEach(function(el){
      if(el.children.length>3) return;
      var text=(el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
      if(!text) return;
      var hit=labels.some(function(label){return text.indexOf(label)>=0;});
      if(!hit) return;

      var node=el;
      var fallback=null;
      while(node&&node!==root){
        var rect=node.getBoundingClientRect();
        if(rect.width>260&&rect.height>220){
          if(!fallback) fallback=node;
          var cs=getComputedStyle(node);
          var bg=parseColor(cs.backgroundColor);
          var hasImage=cs.backgroundImage&&cs.backgroundImage!=='none';
          var darkBg=bg&&bg.a>0.25&&luminance(bg)<0.16;
          if(darkBg||hasImage){
            node.classList.add('auto-dark-surface');
            return;
          }
        }
        node=node.parentElement;
      }
      if(fallback) fallback.classList.add('auto-dark-surface');
    });
  }

  function markDarkSurfaces(){
    var root=document.getElementById('main');
    if(!root) return;
    root.querySelectorAll('.auto-dark-surface').forEach(function(el){el.classList.remove('auto-dark-surface');});
    markAutomaticDarkSurfaces(root);
    markNamedDarkPanels(root);
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

  function repairAll(){
    ensureTheme();
    forceReadableShell();
    markDarkSurfaces();
  }

  function run(){
    repairAll();
    repairBrand();
    addLinks();
    requestAnimationFrame(repairAll);
    setTimeout(repairAll,100);
    setTimeout(repairAll,500);
    setTimeout(repairAll,1200);
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
