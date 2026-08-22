const clearCueList = () => {
  const list = document.getElementById('visualCueList');
  if (list) list.textContent = '';
};

window.addEventListener('vrm-studio-project-changed', (event) => {
  const reason = event.detail?.reason;
  if (['caption-edit', 'analysis', 'new-source', 'reset'].includes(reason)) clearCueList();
});
