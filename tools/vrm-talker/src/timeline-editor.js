import {
  getProject,
  removeVisualReference,
  updateVisualReference,
} from './app/project-state.js';

const panel = document.getElementById('panel');
const seek = document.getElementById('seek');
const status = document.getElementById('status');

const setStatus = (message) => { if (status) status.textContent = message; };
const sec = (ms) => (Math.max(0, Number(ms) || 0) / 1000).toFixed(2);

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>VISUAL TIMELINE</h2>
    <div class="small">AIが置いた初期区間を、必要な時だけ微調整できます。</div>
    <div id="visualTimelineList" class="visual-timeline-list"></div>
  `;
  panel.insertBefore(section, status || null);

  const style = document.createElement('style');
  style.textContent = `
    .visual-timeline-list{display:grid;gap:7px}
    .visual-track{border:1px solid #ffffff18;border-radius:9px;padding:7px;background:#1b1b20;display:grid;gap:6px}
    .visual-track-top{display:grid;grid-template-columns:42px 1fr auto;gap:7px;align-items:center}
    .visual-track-thumb{width:42px;height:42px;border-radius:6px;object-fit:cover;background:#111}
    .visual-track-title{font-size:11px;line-height:1.3;color:#ffffffc4;overflow:hidden}
    .visual-track-time{display:grid;grid-template-columns:1fr auto 1fr;gap:5px;align-items:center}
    .visual-track-time input{min-height:34px!important;font:12px ui-monospace,monospace;text-align:center}
    .visual-track button{min-height:34px;font-size:11px}
  `;
  document.head.appendChild(style);
  const list = document.getElementById('visualTimelineList');

  const seekTo = (ms) => {
    const duration = Number(getProject().source.durationMs || 0);
    if (!seek || !duration) return;
    seek.value = String(Math.round(Math.max(0, Math.min(duration, ms)) / duration * 1000));
    seek.dispatchEvent(new Event('input', {bubbles: true}));
  };

  const render = () => {
    if (!list) return;
    const refs = getProject().visualReferences;
    list.textContent = '';
    list.dataset.count = String(refs.length);
    if (!refs.length) {
      const empty = document.createElement('div');
      empty.className = 'small';
      empty.textContent = '採用済み画像はまだありません。';
      list.appendChild(empty);
      return;
    }

    for (const ref of refs) {
      const card = document.createElement('article');
      card.className = 'visual-track';
      const top = document.createElement('div');
      top.className = 'visual-track-top';
      const image = document.createElement('img');
      image.className = 'visual-track-thumb';
      image.alt = ref.title || ref.query || ref.prompt || 'visual';
      image.src = ref.thumbnailUrl || ref.url || '';
      const title = document.createElement('div');
      title.className = 'visual-track-title';
      title.textContent = ref.title || ref.query || ref.prompt || ref.kind || '画像素材';
      const jump = document.createElement('button');
      jump.type = 'button';
      jump.textContent = '移動';
      jump.addEventListener('click', () => seekTo(Number(ref.startMs)));
      top.append(image, title, jump);

      const time = document.createElement('div');
      time.className = 'visual-track-time';
      const start = document.createElement('input');
      start.type = 'number';
      start.step = '0.05';
      start.min = '0';
      start.value = sec(ref.startMs);
      start.setAttribute('aria-label', '開始秒');
      const arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.style.color = '#ffffff70';
      const end = document.createElement('input');
      end.type = 'number';
      end.step = '0.05';
      end.min = '0';
      end.value = sec(ref.endMs);
      end.setAttribute('aria-label', '終了秒');
      time.append(start, arrow, end);

      const actions = document.createElement('div');
      actions.className = 'studio-actions';
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.textContent = '時刻を反映';
      apply.addEventListener('click', () => {
        try {
          const updated = updateVisualReference(ref.id, {
            startMs: Math.round(Number(start.value) * 1000),
            endMs: Math.round(Number(end.value) * 1000),
          });
          if (!updated) throw new Error('画像素材が見つかりません。');
          setStatus(`画像区間を ${sec(updated.startMs)}s–${sec(updated.endMs)}s に更新しました。`);
          render();
        } catch (error) {
          setStatus(error instanceof Error ? error.message : String(error));
        }
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '削除';
      remove.addEventListener('click', () => {
        const removed = removeVisualReference(ref.id);
        setStatus(removed ? '画像素材をタイムラインから削除しました。' : '画像素材が見つかりませんでした。');
        render();
      });
      actions.append(apply, remove);
      card.append(top, time, actions);
      list.appendChild(card);
    }
  };

  window.addEventListener('vrm-studio-project-changed', render);
  setInterval(() => {
    const count = getProject().visualReferences.length;
    if (Number(list.dataset.count || -1) !== count) render();
  }, 400);
  render();
}
