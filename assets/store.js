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
      <p>ここに置いてある物は、設定が済んだ商品から本当に買えます。決済はStripeが処理し、カード情報をこのサイト側には保存しません。</p>
    </div>
    <div class="real-store-grid" data-store-grid></div>
    <div class="store-note">
      <b>販売について</b>
      <p>一点物は売約後に搬出済表示へ切り替えます。超常的効果を保証する商品ではありません。</p>
    </div>`;
  main.prepend(section);

  const grid = section.querySelector('[data-store-grid]');
  const key = cfg.stripePublishableKey || '';
  const readyKey = key.startsWith('pk_');

  for (const product of (cfg.products || [])) {
    const article = document.createElement('article');
    article.className = 'store-product';
    article.dataset.productId = product.id;
    article.innerHTML = `
      <div class="store-product-index">${product.id}</div>
      <div class="store-product-body">
        <h2>${product.name}</h2>
        <p>${product.description || ''}</p>
      </div>
      <div class="store-product-buy">
        <strong>${product.price || ''}</strong>
        <div class="store-buy-slot"></div>
      </div>`;
    const slot = article.querySelector('.store-buy-slot');
    if (readyKey && product.buyButtonId) {
      const buy = document.createElement('stripe-buy-button');
      buy.setAttribute('buy-button-id', product.buyButtonId);
      buy.setAttribute('publishable-key', key);
      buy.setAttribute('client-reference-id', product.id);
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

  if (!document.querySelector('script[data-stripe-buy]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://js.stripe.com/v3/buy-button.js';
    script.dataset.stripeBuy = '';
    document.body.append(script);
  }
})();
