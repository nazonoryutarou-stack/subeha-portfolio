import {
  apiBaseIsConfigured,
  importOpenverseImage,
} from './api/client.js';
import {searchReferenceImages} from './references/search.js';
import {
  addVisualReference,
  availableSpeakers,
  downloadProject,
  getProject,
  setAvatarSpeaker,
  setSourceFile,
} from './app/project-state.js';

const panel = document.getElementById('panel');
const audioInput = document.getElementById('audioFile');
const seek = document.getElementById('seek');
const status = document.getElementById('status');

if (panel && audioInput) {
  const style = document.createElement('style');
  style.textContent = `
    .studio-tools{display:grid;gap:8px;border-top:1px solid #ffffff18;padding-top:8px}
    .studio-tools h2{font:700 11px ui-monospace,monospace;letter-spacing:.14em;color:#ffffff8a;margin:0}
    .studio-tools input,.studio-tools select{box-sizing:border-box;width:100%;min-height:40px;border:1px solid #ffffff22;border-radius:10px;background:#1c1c22;color:#fff;padding:0 10px}
    .studio-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}
    .studio-meta{font:11px ui-monospace,monospace;color:#ffffff80;line-height:1.45}
    .studio-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:240px;overflow:auto}
    .studio-card{border:1px solid #ffffff1d;background:#202026;border-radius:8px;padding:4px;cursor:pointer;color:#fff;text-align:left}
    .studio-card img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:5px;background:#111}
    .studio-card small{display:block;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ffffff99}
    .studio-chip{display:inline-block;border:1px solid #ffffff22;border-radius:999px;padding:3px 7px;margin-right:4px;font-size:10px;color:#ffffffa0}
    .studio-warning{font-size:11px;color:#ffc57a;line-height:1.4}
  `;
  document.head.appendChild(style);

  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>STUDIO REVIEW</h2>
    <div class="small">字幕・話者・切り抜き判断はChatGPTのedit-planを正本にします。ここでは確認・微調整だけ行います。</div>
    <button id="studioSave" type="button">project.json保存</button>
    <div id="studioMeta" class="studio-meta">project.jsonを開くか、音声を選択してください。</div>
    <select id="studioAvatarSpeaker" disabled>
      <option value="">edit-planに話者情報がありません</option>
    </select>
    <div id="studioSpeakerWarning" class="studio-warning">HOST以外はVRM発話モーションを止めます。</div>
    <input id="studioSearchQuery" type="text" placeholder="参考画像を検索 例: 昭和の遺影 写真館">
    <div class="studio-actions">
      <button id="studioSearch" type="button">参考画像検索</button>
      <button id="studioUseCaption" type="button">現在字幕を検索語へ</button>
    </div>
    <div id="studioResults" class="studio-results"></div>
  `;

  panel.insertBefore(section, status || null);

  const saveButton = document.getElementById('studioSave');
  const searchButton = document.getElementById('studioSearch');
  const useCaptionButton = document.getElementById('studioUseCaption');
  const speakerSelect = document.getElementById('studioAvatarSpeaker');
  const speakerWarning = document.getElementById('studioSpeakerWarning');
  const searchInput = document.getElementById('studioSearchQuery');
  const meta = document.getElementById('studioMeta');
  const results = document.getElementById('studioResults');

  const setStatus = (message) => {
    if (status) status.textContent = message;
  };

  const durationForFile = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      const durationMs = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
      URL.revokeObjectURL(url);
      resolve(durationMs);
    }, {once: true});
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('音声長を取得できませんでした。'));
    }, {once: true});
  });

  const refreshSpeakerSelect = () => {
    const speakers = availableSpeakers();
    const selected = getProject().avatar.speaker || '';
    speakerSelect.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = speakers.length ? 'アバター話者を確認' : 'edit-planに話者情報がありません';
    speakerSelect.appendChild(placeholder);
    for (const speaker of speakers) {
      const option = document.createElement('option');
      option.value = speaker;
      option.textContent = speaker;
      option.selected = speaker === selected;
      speakerSelect.appendChild(option);
    }
    speakerSelect.disabled = speakers.length === 0;
    speakerWarning.textContent = selected
      ? `アバター話者: ${selected}。この話者の区間だけ口・発話連動頭/胸モーションを有効化します。`
      : 'アバター話者が未指定です。完成レンダーではHOSTを使ってください。';
  };

  const refreshMeta = () => {
    const project = getProject();
    const host = project.avatar.speaker;
    const hostTurns = host ? project.speakerTurns.filter((turn) => turn.speaker === host).length : 0;
    const guestTurns = project.speakerTurns.filter((turn) => turn.speaker === 'GUEST').length;
    const unknownTurns = project.speakerTurns.filter((turn) => turn.speaker === 'UNKNOWN').length;
    meta.innerHTML = [
      `<span class="studio-chip">字幕 ${project.captions.length}</span>`,
      `<span class="studio-chip">アバター ${host || '未指定'}</span>`,
      `<span class="studio-chip">HOST ${hostTurns}</span>`,
      `<span class="studio-chip">GUEST ${guestTurns}</span>`,
      `<span class="studio-chip">UNKNOWN ${unknownTurns}</span>`,
      `<span class="studio-chip">画像 ${project.visualReferences.length}</span>`,
    ].join('');
    refreshSpeakerSelect();
  };

  const currentMs = () => {
    const project = getProject();
    const duration = Number(project.source.durationMs || 0);
    if (!duration || !seek) return 0;
    return Number(seek.value || 0) / 1000 * duration;
  };

  const currentCaption = () => {
    const now = currentMs();
    return getProject().captions.find((caption) => Number(caption.startMs) <= now && Number(caption.endMs) > now) || null;
  };

  audioInput.addEventListener('change', async () => {
    const file = audioInput.files?.[0];
    if (!file) return;
    try {
      const durationMs = await durationForFile(file);
      await setSourceFile(file, durationMs);
      refreshMeta();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  speakerSelect?.addEventListener('change', () => {
    try {
      setAvatarSpeaker(speakerSelect.value);
      refreshMeta();
      setStatus(speakerSelect.value ? `アバター話者を ${speakerSelect.value} に設定しました。` : 'アバター話者の指定を解除しました。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  saveButton?.addEventListener('click', () => {
    const project = getProject();
    if (project.speakerTurns.length > 0 && !project.avatar.speaker) {
      setStatus('アバター話者が未指定です。完成用ならHOSTを指定してください。');
      return;
    }
    const base = project.source.name.replace(/\.[^.]+$/, '') || 'project';
    downloadProject(`${base}-vrm-project.json`);
    setStatus('project.json を保存しました。');
  });

  useCaptionButton?.addEventListener('click', () => {
    const caption = currentCaption();
    if (!caption) {
      setStatus('現在位置に字幕がありません。');
      return;
    }
    if (caption.speaker && caption.speaker !== 'HOST') {
      setStatus('現在字幕はHOST以外なので、検索語へ自動コピーしません。');
      return;
    }
    searchInput.value = caption.text;
  });

  const renderImageCards = (items) => {
    results.textContent = '';
    for (const item of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'studio-card';
      const image = document.createElement('img');
      image.loading = 'lazy';
      image.alt = item.title || 'reference image';
      image.src = item.thumbnailUrl || item.url || '';
      const label = document.createElement('small');
      label.textContent = item.title || item.creator || item.kind;
      button.append(image, label);
      button.addEventListener('click', async () => {
        button.disabled = true;
        const now = Math.round(currentMs());
        let selected = item;
        let fixed = false;
        if (item.kind === 'search' && item.id && apiBaseIsConfigured()) {
          label.textContent = '録画用に固定中…';
          try {
            const payload = await importOpenverseImage(item.id);
            if (payload?.dataUrl) {
              selected = {
                ...item,
                url: payload.dataUrl,
                thumbnailUrl: payload.dataUrl,
                originalUrl: payload.originalUrl || item.url || null,
                sourceUrl: payload.sourceUrl || item.sourceUrl || null,
                creator: payload.creator || item.creator || null,
                license: payload.license || item.license || null,
                title: payload.title || item.title || null,
              };
              fixed = true;
            }
          } catch (error) {
            console.warn('Optional image proxy failed', error);
          }
        }
        addVisualReference({
          ...selected,
          startMs: now,
          endMs: Math.min(Number(getProject().source.durationMs || now + 5000), now + 5000),
          query: searchInput.value.trim() || null,
        });
        refreshMeta();
        label.textContent = fixed ? '採用済み・固定済み' : '採用済み';
        setStatus(fixed
          ? '参考画像を録画可能なdata URLとしてprojectへ追加しました。'
          : '参考画像をprojectへ追加しました。完成レンダーへ使う場合はローカル素材化してください。');
      });
      results.appendChild(button);
    }
  };

  searchButton?.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) return;
    searchButton.disabled = true;
    setStatus(`参考画像を検索中：${query}`);
    try {
      const items = await searchReferenceImages(query);
      renderImageCards(items);
      setStatus(`参考画像 ${items.length} 件`);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      searchButton.disabled = false;
    }
  });

  window.addEventListener('vrm-studio-project-changed', (event) => {
    if (['avatar-speaker', 'visual-add', 'visual-remove', 'loaded-awaiting-source', 'source-verified', 'new-source', 'reset', 'analysis'].includes(event.detail?.reason)) {
      refreshMeta();
    }
  });

  refreshMeta();
}
