import {
  apiBaseIsConfigured,
  suggestVisualCues,
  generateReferenceImage,
  importOpenverseImage,
} from './api/client.js';
import {searchReferenceImages} from './references/search.js';
import {addVisualReference, getProject, patchProject} from './app/project-state.js';

const panel = document.getElementById('panel');
const status = document.getElementById('status');

const fmt = (ms) => {
  const total = Math.max(0, Number(ms) || 0) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
};

const setStatus = (message) => {
  if (status) status.textContent = message;
};

const makeReference = (cue, item) => ({
  id: item.id || crypto.randomUUID(),
  kind: item.kind || 'search',
  startMs: cue.startMs,
  endMs: cue.endMs,
  query: cue.query || null,
  prompt: cue.prompt || null,
  url: item.url || item.imageUrl || null,
  thumbnailUrl: item.thumbnailUrl || item.url || item.imageUrl || null,
  originalUrl: item.originalUrl || null,
  sourceUrl: item.sourceUrl || null,
  creator: item.creator || null,
  license: item.license || null,
  title: item.title || null,
});

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools visual-director';
  section.innerHTML = `
    <h2>VISUAL DIRECTOR</h2>
    <div class="studio-actions">
      <button id="visualSuggest" type="button">AIで画像挿入候補</button>
      <button id="visualClear" type="button">候補を消す</button>
    </div>
    <div class="small">AIは字幕番号だけ選び、表示時刻は実タイムコードから確定します。検索候補は自動取得、画像生成は明示操作です。</div>
    <div id="visualCueList" class="visual-cue-list"></div>
  `;
  panel.insertBefore(section, status || null);

  const style = document.createElement('style');
  style.textContent = `
    .visual-cue-list{display:grid;gap:8px}
    .visual-cue{border:1px solid #ffffff18;border-radius:10px;padding:8px;background:#1c1c22;display:grid;gap:6px}
    .visual-cue-head{display:flex;justify-content:space-between;gap:8px;font:700 11px ui-monospace,monospace;color:#ffffffa8}
    .visual-cue-reason{font-size:11px;color:#ffffff78;line-height:1.4}
    .visual-cue-query{font-size:12px;color:#fff;line-height:1.4}
    .visual-candidates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
    .visual-candidate{padding:3px;min-height:0;display:block;background:#25252b}
    .visual-candidate img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:5px}
    .visual-candidate small{display:block;padding:4px 2px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9px;color:#ffffff99}
    .visual-generate{width:100%}
  `;
  document.head.appendChild(style);

  const button = document.getElementById('visualSuggest');
  const clearButton = document.getElementById('visualClear');
  const list = document.getElementById('visualCueList');

  const renderSearch = async (cue, container) => {
    container.innerHTML = '<div class="small">参考画像を検索中…</div>';
    try {
      const results = await searchReferenceImages(cue.query);
      const candidates = results.slice(0, 3);
      if (!candidates.length) {
        container.innerHTML = '<div class="small">検索候補なし</div>';
        return;
      }
      container.textContent = '';
      for (const item of candidates) {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'visual-candidate';
        const image = document.createElement('img');
        image.loading = 'lazy';
        image.alt = item.title || cue.query || 'reference';
        image.src = item.thumbnailUrl || item.url || '';
        const label = document.createElement('small');
        label.textContent = item.title || item.creator || '採用';
        choice.append(image, label);
        choice.addEventListener('click', async () => {
          choice.disabled = true;
          label.textContent = '固定中…';
          let selected = {...item, kind: 'search'};
          let imported = false;
          if (apiBaseIsConfigured() && item.id) {
            try {
              const payload = await importOpenverseImage(item.id);
              if (payload?.dataUrl) {
                selected = {
                  ...selected,
                  url: payload.dataUrl,
                  thumbnailUrl: payload.dataUrl,
                  originalUrl: payload.originalUrl || item.url || null,
                  sourceUrl: payload.sourceUrl || item.sourceUrl || null,
                  creator: payload.creator || item.creator || null,
                  license: payload.license || item.license || null,
                  title: payload.title || item.title || null,
                };
                imported = true;
              }
            } catch (error) {
              console.warn('Openverse image import failed; using remote image', error);
            }
          }
          const ref = makeReference(cue, selected);
          addVisualReference(ref);
          label.textContent = imported ? '採用済み・録画用固定済み' : '採用済み';
          setStatus(imported
            ? `${fmt(cue.startMs)} の参考画像を録画可能な形でタイムラインへ固定しました。`
            : `${fmt(cue.startMs)} の参考画像をタイムラインへ追加しました。録画時はCORS可否を確認します。`);
          window.dispatchEvent(new CustomEvent('vrm-studio-project-changed'));
        });
        container.appendChild(choice);
      }
    } catch (error) {
      console.error(error);
      container.innerHTML = `<div class="small">検索失敗：${error instanceof Error ? error.message : String(error)}</div>`;
    }
  };

  const renderGenerate = (cue, container) => {
    const generate = document.createElement('button');
    generate.type = 'button';
    generate.className = 'visual-generate';
    generate.textContent = 'この素材を画像生成';
    generate.addEventListener('click', async () => {
      generate.disabled = true;
      generate.textContent = '生成中…';
      try {
        const payload = await generateReferenceImage({prompt: cue.prompt});
        const first = payload?.data?.[0] || {};
        const b64 = first.b64_json || null;
        if (!b64) throw new Error('生成画像データがありません。');
        const url = `data:image/png;base64,${b64}`;
        const ref = makeReference(cue, {
          id: crypto.randomUUID(),
          kind: 'generated',
          url,
          thumbnailUrl: url,
          title: cue.prompt,
          creator: 'OpenAI',
        });
        addVisualReference(ref);
        container.textContent = '';
        const image = document.createElement('img');
        image.alt = cue.prompt || 'generated reference';
        image.src = url;
        image.style.width = '100%';
        image.style.borderRadius = '8px';
        container.appendChild(image);
        setStatus(`${fmt(cue.startMs)} の生成画像をタイムラインへ追加しました。`);
        window.dispatchEvent(new CustomEvent('vrm-studio-project-changed'));
      } catch (error) {
        console.error(error);
        generate.disabled = false;
        generate.textContent = `生成失敗：${error instanceof Error ? error.message : String(error)}`;
      }
    });
    container.appendChild(generate);
  };

  const renderCues = async (cues) => {
    list.textContent = '';
    for (const cue of cues) {
      const card = document.createElement('article');
      card.className = 'visual-cue';
      const head = document.createElement('div');
      head.className = 'visual-cue-head';
      head.innerHTML = `<span>${cue.mode === 'generate' ? 'GENERATE' : 'SEARCH'}</span><span>${fmt(cue.startMs)}–${fmt(cue.endMs)}</span>`;
      const query = document.createElement('div');
      query.className = 'visual-cue-query';
      query.textContent = cue.mode === 'generate' ? cue.prompt : cue.query;
      const reason = document.createElement('div');
      reason.className = 'visual-cue-reason';
      reason.textContent = cue.reason || '';
      const candidates = document.createElement('div');
      candidates.className = 'visual-candidates';
      if (cue.mode === 'generate') candidates.style.gridTemplateColumns = '1fr';
      card.append(head, query, reason, candidates);
      list.appendChild(card);
      if (cue.mode === 'search') void renderSearch(cue, candidates);
      else renderGenerate(cue, candidates);
    }
  };

  button?.addEventListener('click', async () => {
    const project = getProject();
    if (!project.captions.length) {
      setStatus('先に「字幕＋話者解析」を実行してください。');
      return;
    }
    button.disabled = true;
    setStatus('字幕の意味を解析して画像挿入候補を選定中…');
    try {
      const payload = await suggestVisualCues(project.captions);
      const cues = Array.isArray(payload?.cues) ? payload.cues : [];
      patchProject({visualCues: cues});
      await renderCues(cues);
      setStatus(`画像挿入候補 ${cues.length} 件。検索素材は候補取得済みです。`);
    } catch (error) {
      console.error(error);
      setStatus(`Visual Director: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      button.disabled = false;
    }
  });

  clearButton?.addEventListener('click', () => {
    patchProject({visualCues: []});
    list.textContent = '';
    setStatus('画像挿入候補をクリアしました。採用済み素材はproject.jsonに残ります。');
  });
}
