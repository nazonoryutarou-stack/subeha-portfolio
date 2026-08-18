(function(){
  'use strict';
  if(document.querySelector('[data-legal-links]')) return;
  var base=location.hostname.endsWith('github.io')?'/subeha-portfolio':'';

  function mount(){
    if(document.querySelector('[data-legal-links]')) return;
    var host=document.querySelector('.footer-bottom')||document.querySelector('.site-footer')||document.body;
    if(!host) return;

    var nav=document.createElement('nav');
    nav.dataset.legalLinks='true';
    nav.setAttribute('aria-label','法務・サイト情報');
    nav.style.cssText='box-sizing:border-box;width:100%;margin:32px 0 0;padding:18px 16px;display:flex;flex-wrap:wrap;gap:10px 18px;justify-content:center;border-top:1px solid rgba(127,127,127,.35);font:12px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;z-index:10;';

    [
      ['特定商取引法に基づく表記','/tokusho/'],
      ['お問い合わせ','/contact/'],
      ['コンテンツ一覧','/contents/'],
      ['ホーム','/home.html']
    ].forEach(function(item){
      var a=document.createElement('a');
      a.textContent=item[0];
      a.href=base+item[1];
      a.style.cssText='color:inherit;text-decoration:underline;text-underline-offset:3px;opacity:.82;';
      nav.appendChild(a);
    });
    host.appendChild(nav);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
