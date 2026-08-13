(() => {
  'use strict';

  const base = location.hostname.endsWith('github.io') ? '/subeha-portfolio' : '';

  function injectLegalLinks() {
    if (document.querySelector('[data-legal-links]')) return;
    const footerBottom = document.querySelector('.footer-bottom');
    if (!footerBottom) return;

    const nav = document.createElement('nav');
    nav.dataset.legalLinks = '';
    nav.setAttribute('aria-label', '法務情報');
    nav.style.display = 'flex';
    nav.style.flexWrap = 'wrap';
    nav.style.gap = '.75rem 1rem';
    nav.style.marginTop = '.75rem';
    nav.style.fontSize = '.78rem';

    const links = [
      ['特定商取引法に基づく表記', `${base}/tokusho/`],
      ['お問い合わせ', `${base}/contact/`]
    ];

    links.forEach(([label, href]) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label;
      nav.appendChild(a);
    });

    footerBottom.appendChild(nav);
  }

  if (document.documentElement.dataset.ready === 'true') {
    injectLegalLinks();
    return;
  }

  const observer = new MutationObserver(() => {
    if (document.documentElement.dataset.ready !== 'true') return;
    observer.disconnect();
    injectLegalLinks();
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-ready']
  });
})();
