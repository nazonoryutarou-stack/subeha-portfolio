(function(){
  'use strict';
  var base=location.hostname.endsWith('github.io')?'/subeha-portfolio':'';

  function ensureTheme(){
    if(!document.querySelector('link[data-unified-shell]')){
      var css=document.createElement('link');
      css.rel='stylesheet';
      css.href=base+'/assets/unified-shell.css';
      css.dataset.unifiedShell='true';
      document.head.appendChild(css);
    }
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

  function run(){ensureTheme();repairBrand();addLinks();}
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
