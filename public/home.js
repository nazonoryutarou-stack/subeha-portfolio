const mechanicalCard = document.querySelector('#mechanicalCard');
const eyeLocket = document.querySelector('#eyeLocket');
const secretStar = document.querySelector('#secretStar');
const resetCabinet = document.querySelector('#resetCabinet');
const dragItems = [...document.querySelectorAll('.drag-item')];

mechanicalCard?.addEventListener('click', () => {
  const open = document.body.classList.toggle('mechanical-open');
  mechanicalCard.setAttribute('aria-expanded', String(open));
});

eyeLocket?.addEventListener('click', () => {
  const closed = document.body.classList.toggle('eye-closed');
  eyeLocket.setAttribute('aria-pressed', String(closed));
});

let starCount = 0;
secretStar?.addEventListener('click', () => {
  starCount += 1;
  if (starCount >= 3) {
    document.body.classList.toggle('secret-open');
    starCount = 0;
  }
});

function px(value) {
  const n = Number.parseFloat(value || '0');
  return Number.isFinite(n) ? n : 0;
}

dragItems.forEach((item) => {
  let state = null;

  item.addEventListener('pointerdown', (event) => {
    state = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      dx: px(item.style.getPropertyValue('--dx')),
      dy: px(item.style.getPropertyValue('--dy'))
    };
    item.setPointerCapture(event.pointerId);
  });

  item.addEventListener('pointermove', (event) => {
    if (!state || state.id !== event.pointerId) return;
    item.style.setProperty('--dx', `${state.dx + event.clientX - state.x}px`);
    item.style.setProperty('--dy', `${state.dy + event.clientY - state.y}px`);
  });

  const end = (event) => {
    if (!state || state.id !== event.pointerId) return;
    if (item.hasPointerCapture(event.pointerId)) item.releasePointerCapture(event.pointerId);
    state = null;
  };

  item.addEventListener('pointerup', end);
  item.addEventListener('pointercancel', end);
});

resetCabinet?.addEventListener('click', () => {
  document.body.classList.remove('mechanical-open', 'eye-closed', 'secret-open');
  mechanicalCard?.setAttribute('aria-expanded', 'false');
  eyeLocket?.setAttribute('aria-pressed', 'false');
  dragItems.forEach((item) => {
    item.style.removeProperty('--dx');
    item.style.removeProperty('--dy');
  });
  starCount = 0;
});
