(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const renderTree = (stage, data) => {
    const rootId = `${data.prefix}-root`;
    const categories = data.categories || [];
    const root = document.createElement('ul');
    root.className = 'tree';

    const rootLi = document.createElement('li');
    rootLi.innerHTML = `<div class="node root" data-node="${esc(rootId)}"><strong>${esc(data.rootLabel)}</strong></div>`;
    const categoryList = document.createElement('ul');

    categories.forEach((category, categoryIndex) => {
      const categoryId = `${data.prefix}-c${categoryIndex + 1}`;
      const li = document.createElement('li');
      li.dataset.parent = rootId;

      const glyph = ((categoryIndex % 5) + 1);
      li.innerHTML = `<div class="node category" data-node="${esc(categoryId)}"><span class="glyph glyph-${glyph}" aria-hidden="true"></span><span class="category-copy"><strong>${esc(category.name)}</strong><small>${esc(category.meta || `分類 ${String(categoryIndex + 1).padStart(2,'0')}`)}</small></span></div>`;

      const products = document.createElement('ul');
      (category.products || []).forEach((product, productIndex) => {
        const productId = `${data.prefix}-p${categoryIndex + 1}-${productIndex + 1}`;
        const productLi = document.createElement('li');
        productLi.dataset.parent = categoryId;
        productLi.innerHTML = `<div class="node product" tabindex="0" data-node="${esc(productId)}"><strong>${esc(product.name)}</strong><span class="meta"><i></i>${esc(product.code || `${data.prefix.toUpperCase()}-${String(categoryIndex + 1).padStart(2,'0')}-${String(productIndex + 1).padStart(2,'0')}`)}${product.version ? ` / ${esc(product.version)}` : ''}</span></div>`;
        products.appendChild(productLi);
      });
      li.appendChild(products);
      categoryList.appendChild(li);
    });

    rootLi.appendChild(categoryList);
    root.appendChild(rootLi);
    stage.appendChild(root);
  };

  const initStage = async (stage) => {
    const src = stage.dataset.src;
    if (!src) return;

    const response = await fetch(src, {cache:'no-store'});
    if (!response.ok) throw new Error(`product data: ${response.status}`);
    const data = await response.json();
    renderTree(stage, data);

    const tree = stage.querySelector('.tree');
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add('connectors');
    svg.setAttribute('aria-hidden', 'true');
    stage.prepend(svg);

    const pathByNode = new Map();
    let resizeTimer;
    let observerTimer;
    const nodeById = (id) => tree.querySelector(`.node[data-node="${CSS.escape(id)}"]`);

    const draw = (animate = false) => {
      const stageRect = stage.getBoundingClientRect();
      const width = Math.max(stage.scrollWidth, stage.clientWidth);
      const height = Math.max(stage.scrollHeight, stage.clientHeight);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.replaceChildren();
      pathByNode.clear();

      const items = [...tree.querySelectorAll('li[data-parent]')];
      items.forEach((li, index) => {
        const child = li.firstElementChild;
        const parent = nodeById(li.dataset.parent);
        if (!child || !parent) return;

        const pr = parent.getBoundingClientRect();
        const cr = child.getBoundingClientRect();
        const sx = pr.right - stageRect.left - 1;
        const sy = pr.top - stageRect.top + pr.height / 2;
        const ex = cr.left - stageRect.left + 1;
        const ey = cr.top - stageRect.top + cr.height / 2;
        const span = Math.max(30, ex - sx);
        const curve = Math.max(24, Math.min(70, span * .46));

        const path = document.createElementNS(NS, 'path');
        path.classList.add('connector-path');
        path.setAttribute('d', `M ${sx} ${sy} C ${sx + curve} ${sy}, ${ex - curve} ${ey}, ${ex} ${ey}`);
        path.dataset.to = child.dataset.node || '';
        path.dataset.from = li.dataset.parent || '';
        svg.appendChild(path);
        pathByNode.set(child.dataset.node, path);

        if (animate && !reduceMotion) {
          const length = path.getTotalLength();
          path.style.strokeDasharray = `${length}`;
          path.style.strokeDashoffset = `${length}`;
          path.style.opacity = '0';
          const isProduct = child.classList.contains('product');
          const delay = isProduct ? 700 + index * 14 : 280 + index * 48;
          path.animate([
            {strokeDashoffset:length, opacity:0},
            {strokeDashoffset:0, opacity:1}
          ], {duration:isProduct ? 860 : 720, delay, easing:'cubic-bezier(.25,.72,.25,1)', fill:'forwards'});
        }
      });
    };

    const clearFocus = () => {
      stage.classList.remove('is-focused');
      stage.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
    };

    const focusBranch = (product) => {
      clearFocus();
      stage.classList.add('is-focused');
      let node = product;
      while (node) {
        node.classList.add('is-active');
        const path = pathByNode.get(node.dataset.node);
        if (path) path.classList.add('is-active');
        const li = node.closest('li');
        if (!li?.dataset.parent) break;
        node = nodeById(li.dataset.parent);
      }
    };

    stage.querySelectorAll('.product').forEach((product, i) => {
      if (!reduceMotion) {
        product.animate([
          {opacity:0, transform:'translateY(5px)', filter:'blur(1.4px)'},
          {opacity:1, transform:'translateY(0)', filter:'blur(0)'}
        ], {duration:760, delay:760 + i * 28, easing:'cubic-bezier(.2,.75,.25,1)', fill:'both'});
      }
      product.addEventListener('pointerenter', () => focusBranch(product));
      product.addEventListener('pointerleave', clearFocus);
      product.addEventListener('focus', () => focusBranch(product));
      product.addEventListener('blur', clearFocus);
    });

    const redraw = () => {
      clearTimeout(observerTimer);
      observerTimer = setTimeout(() => draw(false), 40);
    };

    new ResizeObserver(redraw).observe(stage);
    new MutationObserver(redraw).observe(tree, {childList:true, subtree:true, characterData:true});
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => draw(false), 100);
    }, {passive:true});

    const firstDraw = () => requestAnimationFrame(() => draw(true));
    if (document.fonts?.ready) document.fonts.ready.then(firstDraw);
    else firstDraw();
  };

  document.querySelectorAll('.tree-stage[data-src]').forEach((stage) => {
    initStage(stage).catch((err) => {
      console.error(err);
      stage.innerHTML = '<p class="load-error">商品系統を読み込めませんでした。</p>';
    });
  });
})();
