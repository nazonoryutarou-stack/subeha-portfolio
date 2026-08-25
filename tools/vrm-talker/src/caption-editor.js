import {getProject, patchProject} from './app/project-state.js';

const panel = document.getElementById('panel');
const seek = document.getElementById('seek');
const status = document.getElementById('status');
const PAGE_SIZE = 30;

const setStatus = (message) => { if (status) status.textContent = message; };
const fmt = (ms) => {
  const total = Math.max(0, Number(ms) || 0) / 1000;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
};

const currentMs = () => {
  const duration = Number(getProject().source.durationMs || 0);
  if (!seek || !duration) return 0;
  return Number(seek.value || 0) / 1000 * duration;
};

const seekTo = (ms) => {
  const duration = Number(getProject().source.durationMs || 0);
  if (!seek || !duration) return;
  seek.value = String(Math.round(Math.max(0, Math.min(duration, Number(ms) || 0)) / duration * 1000));
  seek.dispatchEvent(new Event('input', {bubbles: true}));
};

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools caption-editor';
  section.innerHTML = `
    <h2>CAPTION EDITOR</h2>
    <div class="small">字幕本文だけを訂正します。タイムコードと話者は変更しません。</div>
    <div class="studio-actions caption-nav">
      <button id="captionPrev" type="button">前の30件</button>
      <button id="captionCurrent" type="button">現在位置へ</button>
    </div>
    <div class="studio-actions caption-nav">
      <button id="captionNext" type="button">次の30件</button>
      <input id="captionFind" type="search" placeholder="字幕を検索">
    </div>
    <div id="captionEditorMeta" class="studio-meta">字幕解析後に編集できます。</div>
    <div id="captionEditorList" class="caption-editor-list"></div>
  `;
  panel.insertBefore(section, status || null);

  const style = document.createElement('style');
  style.textContent = `
    .caption-editor-list{display:grid;gap:6px;max-height:420px;overflow:auto}
    .caption-editor-row{display:grid;grid-template-columns:82px 1fr;gap:6px;align-items:start;border:1px solid #ffffff16;background:#1b1b20;border-radius:8px;padding:6px}
    .caption-editor-side{display:grid;gap:4px}
    .caption-editor-time{min-height:30px!important;padding:4px!important;font:700 9px ui-monospace,monospace!important;line-height:1.2}
    .caption-editor-speaker{font:9px ui-monospace,monospace;color:#ffffff78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .caption-editor-text{width:100%;min-height:54px;resize:vertical;box-sizing:border-box;border:1px solid #ffffff22;border-radius:7px;background:#24242a;color:#fff;padding:7px;font:13px/1.45 "Noto Sans JP","Yu Gothic",system-ui,sans-serif}
    .caption-editor-text[data-speaker="avatar"]{border-color:#7fe6cf66}
  `;
  document.head.appendChild(style);

  const list = document.getElementById('captionEditorList');
  const meta = document.getElementById('captionEditorMeta');
  const prev = document.getElementById('captionPrev');
  const next = document.getElementById('captionNext');
  const current = document.getElementById('captionCurrent');
  const find = document.getElementById('captionFind');
  let pageStart = 0;

  const clampPageStart = () => {
    const count = getProject().captions.length;
    const maxStart = Math.max(0, Math.floor(Math.max(0, count - 1) / PAGE_SIZE) * PAGE_SIZE);
    pageStart = Math.max(0, Math.min(maxStart, pageStart));
  };

  const render = () => {
    if (!list || !meta) return;
    const project = getProject();
    const captions = project.captions;
    clampPageStart();
    list.textContent = '';

    if (!captions.length) {
      meta.textContent = '字幕解析後に編集できます。';
      prev.disabled = true;
      next.disabled = true;
      current.disabled = true;
      return;
    }

    const end = Math.min(captions.length, pageStart + PAGE_SIZE);
    meta.textContent = `${pageStart + 1}–${end} / ${captions.length}件　本文訂正のみ・時刻固定`;
    prev.disabled = pageStart <= 0;
    next.disabled = end >= captions.length;
    current.disabled = false;

    for (let index = pageStart; index < end; index++) {
      const caption = captions[index];
      const row = document.createElement('article');
      row.className = 'caption-editor-row';

      const side = document.createElement('div');
      side.className = 'caption-editor-side';
      const time = document.createElement('button');
      time.type = 'button';
      time.className = 'caption-editor-time';
      time.textContent = `${fmt(caption.startMs)}\n${fmt(caption.endMs)}`;
      time.title = 'この字幕位置へ移動';
      time.addEventListener('click', () => seekTo(caption.startMs));
      const speaker = document.createElement('div');
      speaker.className = 'caption-editor-speaker';
      speaker.textContent = caption.speaker || 'speakerなし';
      side.append(time, speaker);

      const text = document.createElement('textarea');
      text.className = 'caption-editor-text';
      text.value = caption.text || '';
      text.dataset.speaker = project.avatar.speaker && caption.speaker === project.avatar.speaker ? 'avatar' : 'other';
      text.setAttribute('aria-label', `字幕 ${index + 1}`);
      text.addEventListener('change', () => {
        const value = text.value.trim();
        const latest = getProject().captions[index];
        if (!value) {
          text.value = latest?.text || caption.text || '';
          setStatus('字幕本文を空にはできません。削除ではなく本文を訂正してください。');
          return;
        }
        if (value === latest?.text) return;
        const nextCaptions = getProject().captions.map((item, i) => i === index ? {...item, text: value} : item);
        patchProject({captions: nextCaptions, visualCues: []}, 'caption-edit');
        setStatus(`字幕 ${index + 1} を訂正しました。時刻・話者は維持し、未採用のAI画像候補を無効化しました。`);
      });

      row.append(side, text);
      list.appendChild(row);
    }
  };

  prev?.addEventListener('click', () => { pageStart -= PAGE_SIZE; render(); });
  next?.addEventListener('click', () => { pageStart += PAGE_SIZE; render(); });
  current?.addEventListener('click', () => {
    const now = currentMs();
    const captions = getProject().captions;
    const index = captions.findIndex((caption) => Number(caption.startMs) <= now && Number(caption.endMs) > now);
    const nearest = index >= 0 ? index : captions.findIndex((caption) => Number(caption.startMs) >= now);
    if (nearest >= 0) pageStart = Math.floor(nearest / PAGE_SIZE) * PAGE_SIZE;
    render();
  });
  find?.addEventListener('change', () => {
    const query = find.value.trim().toLocaleLowerCase('ja');
    if (!query) return;
    const index = getProject().captions.findIndex((caption) => String(caption.text || '').toLocaleLowerCase('ja').includes(query));
    if (index < 0) {
      setStatus(`字幕に「${find.value.trim()}」は見つかりませんでした。`);
      return;
    }
    pageStart = Math.floor(index / PAGE_SIZE) * PAGE_SIZE;
    seekTo(getProject().captions[index].startMs);
    render();
    setStatus(`字幕 ${index + 1} に移動しました。`);
  });

  window.addEventListener('vrm-studio-project-changed', (event) => {
    const reason = event.detail?.reason;
    if (['analysis', 'loaded-awaiting-source', 'source-verified', 'reset', 'new-source', 'avatar-speaker'].includes(reason)) render();
  });

  render();
}
