(() => {
  'use strict';
  const path = location.pathname.endsWith('/') ? location.pathname : `${location.pathname}/`;
  if (!path.endsWith('/products/')) return;
  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-real-store]')) return;
  const cfg = window.SUBEHA_STORE || { products: [] };

  const section = document.createElement('section');
  section.className = 'real-store';
  section.dataset.realStore = '';
  section.innerHTML = `
    <div class="real-store-head">
      <p class="store-kicker">BUKIYA MAIN SHELF / DIRECT SALE</p>
      <h1>不氣屋 本店</h1>
      <p>ここに置いてある物は、本当に買えます。決済はStripeが処理し、カード情報をこのサイト側には保存しません。</p>
    </div>
    <div class="real-store-grid" data-store-grid></div>
    <div class="store-note">
      <b>販売について</b>
      <p>受注生産品は決済確認後に制作します。超常的効果を保証する商品ではありません。変なものとして、ちゃんと作っています。</p>
    </div>`;
  main.prepend(section);

  const grid = section.querySelector('[data-store-grid]');

  for (const product of (cfg.products || [])) {
    const article = document.createElement('article');
    article.className = 'store-product store-product-featured';
    article.dataset.productId = product.id;
    const badge = product.madeToOrder ? '受注生産' : (product.leadTime === '一点物' ? '一点物' : '販売品');
    const specs = (product.specs || []).map(x => `<li>${x}</li>`).join('');
    article.innerHTML = `
      ${product.image ? `<figure class="store-product-visual"><img src="${product.image}" alt="${product.name} 商品資料画像" loading="eager"><figcaption>観測記録 / ${product.id}</figcaption></figure>` : ''}
      <div class="store-product-main">
        <div class="store-product-index">${product.id}</div>
        <div class="store-product-meta"><span class="store-product-badge">${badge}</span>${product.leadTime ? `<span>${product.leadTime}</span>` : ''}</div>
        <h2>${product.name}</h2>
        <p class="store-product-description">${product.description || ''}</p>
        ${product.warning ? `<aside class="store-warning"><b>使用上の注意</b><p>${product.warning}</p></aside>` : ''}
        ${specs ? `<div class="store-specs"><b>仕様</b><ul>${specs}</ul></div>` : ''}
        <div class="store-product-buy">
          <strong>${product.price || ''}</strong>
          <div class="store-buy-slot"></div>
        </div>
      </div>`;
    const slot = article.querySelector('.store-buy-slot');
    if (product.paymentLink) {
      const buy = document.createElement('a');
      buy.className = 'store-buy-link';
      buy.href = product.paymentLink;
      buy.target = '_blank';
      buy.rel = 'noopener noreferrer';
      buy.textContent = '妹字くん1号を迎える';
      slot.append(buy);
    } else {
      const pending = document.createElement('button');
      pending.type = 'button';
      pending.className = 'store-pending';
      pending.disabled = true;
      pending.textContent = '販売準備中';
      slot.append(pending);
    }
    grid.append(article);
  }
})();
