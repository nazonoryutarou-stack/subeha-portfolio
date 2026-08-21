import {transcribeAudio, generateReferenceImage} from './api/client.js';
import {searchReferenceImages} from './references/search.js';
import {
  addVisualReference,
  availableSpeakers,
  downloadProject,
  getProject,
  setAnalysis,
  setAvatarSpeaker,
  setSourceFile,
} from './app/project-state.js';

const panel = document.getElementById('panel');
const stage = document.getElementById('stage');
const audioInput = document.getElementById('audioFile');
const seek = document.getElementById('seek');
const status = document.getElementById('status');

if (panel && stage && audioInput) {
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
    .studio-caption-preview{position:absolute;z-index:8;left:6%;right:6%;bottom:22%;text-align:center;color:#fff;font:800 clamp(20px,5vw,48px)/1.25 system-ui,sans-serif;text-shadow:0 2px 5px #000,0 0 2px #000;pointer-events:none;white-space:pre-wrap}
    .studio-chip{display:inline-block;border:1px solid #ffffff22;border-radius:999px;padding:3px 7px;margin-right:4px;font-size:10px;color:#ffffffa0}
    .studio-warning{font-size:11px;color:#ffc57a;line-height:1.4}
  `;
  document.head.appendChild(style);

  const captionPreview = document.createElement('div');
  captionPreview.className = 'studio-caption-preview';
  stage.appendChild(captionPreview);

  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>STUDIO AI</h2>
    <div class="studio-actions">
      <button id="studioAnalyze" type="button">字幕＋話者解析</button>
      <button id="studioSave" type="button">project.json保存</button>
    </div>
    <div id="studioMeta" class="studio-meta">音声を選ぶとプロジェクトを作成します。</div>
    <select id="studioAvatarSpeaker" disabled>
      <option value="">解析後、本人の話者を選択</option>
    </select>
    <div id="studioSpeakerWarning" class="studio-warning">本人を選ぶまでは、話者ゲート付き口パクを完成扱いしません。</div>
    <input id="studioSearchQuery" type="text" placeholder="参考画像を検索 例: 昭和の遺影 写真館">
    <div class="studio-actions">
      <button id="studioSearch" type="button">参考画像検索</button>
      <button id="studioUseCaption" type="button">現在字幕を検索語へ</button>
    </div>
    <input id="studioGeneratePrompt" type="text" placeholder="生成画像プロンプト">
    <button id="studioGenerate" type="button">参考画像を生成</button>
    <div id="studioResults" class="studio-results"></div>
  `;

  panel.insertBefore(section, status || null);

  const analyzeButton = document.getElementById('studioAnalyze');
  const saveButton = document.getElementById('studioSave');
  const searchButton = document.getElementById('studioSearch');
  const useCaptionButton = document.getElementById('studioUseCaption');
  const generateButton = document.getElementById('studioGenerate');
  const speakerSelect = document.getElementById('studioAvatarSpeaker');
  const speakerWarning = document.getElementById('studioSpeakerWarning');
  const searchInput = document.getElementById('studioSearchQuery');
  const promptInput = document.getElementById('studioGeneratePrompt');
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
    placeholder.textContent = speakers.length ? '本人の話者を選択' : '話者解析が必要です';
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
      ? `アバター話者: ${selected}。この話者の区間だけ口パク対象にします。`
      : '本人を選ぶまでは、話者ゲート付き口パクを完成扱いしません。';
  };

  const refreshMeta = () => {
    const project = getProject();
    const host = project.avatar.speaker;
    const hostTurns = host ? project.speakerTurns.filter((turn) => turn.speaker === host).length : 0;
    const guestTurns = host ? project.speakerTurns.length - hostTurns : project.speakerTurns.length;
    meta.innerHTML = [
      `<span class="studio-chip">字幕 ${project.captions.length}</span>`,
      `<span class="studio-chip">本人 ${host || '未指定'}</span>`,
      `<span class="studio-chip">HOST区間 ${hostTurns}</span>`,
      `<span class="studio-chip">OTHER ${guestTurns}</span>`,
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

  setInterval(() => {
    const caption = currentCaption();
    captionPreview.textContent = caption?.text || '';
  }, 80);

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

  analyzeButton?.addEventListener('click', async () => {
    const file = audioInput.files?.[0];
    if (!file) {
      setStatus('先に音声を選んでください。');
      return;
    }
    analyzeButton.disabled = true;
    setStatus('字幕と話者を解析中…');
    try {
      const payload = await transcribeAudio(file);
      setAnalysis({
        captions: payload?.captions || [],
        speakerTurns: payload?.speakerTurns || payload?.speaker_turns || [],
        durationMs: payload?.durationMs || payload?.duration_ms,
      });
      refreshMeta();
      setStatus(`解析完了：字幕 ${getProject().captions.length} / 話者区間 ${getProject().speakerTurns.length}。本人の話者を選択してください。`);
    } catch (error) {
      console.error(error);
      setStatus(`字幕API: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      analyzeButton.disabled = false;
    }
  });

  speakerSelect?.addEventListener('change', () => {
    try {
      setAvatarSpeaker(speakerSelect.value);
      refreshMeta();
      setStatus(speakerSelect.value ? `本人話者を ${speakerSelect.value} に設定しました。` : '本人話者の指定を解除しました。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  });

  saveButton?.addEventListener('click', () => {
    const project = getProject();
    if (project.speakerTurns.length > 0 && !project.avatar.speaker) {
      setStatus('本人話者が未指定です。先に本人を選んでください。');
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
      button.addEventListener('click', () => {
        const now = Math.round(currentMs());
        addVisualReference({
          ...item,
          startMs: now,
          endMs: now + 5000,
          query: searchInput.value.trim() || null,
        });
        refreshMeta();
        setStatus('参考画像をprojectへ追加しました。');
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

  generateButton?.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    generateButton.disabled = true;
    setStatus('参考画像を生成中…');
    try {
      const payload = await generateReferenceImage({prompt});
      const first = payload?.data?.[0] || payload || {};
      const b64 = first.b64_json || first.b64 || null;
      const url = first.url || first.imageUrl || first.image_url || (b64 ? `data:image/png;base64,${b64}` : null);
      if (!url) throw new Error('画像生成APIから画像が返りませんでした。');
      const item = {
        id: crypto.randomUUID(),
        kind: 'generated',
        title: prompt,
        url,
        thumbnailUrl: url,
        sourceUrl: null,
        creator: 'generated',
        license: null,
        prompt,
      };
      renderImageCards([item]);
      setStatus('参考画像を生成しました。クリックするとprojectへ追加します。');
    } catch (error) {
      console.error(error);
      setStatus(`画像生成API: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      generateButton.disabled = false;
    }
  });

  refreshMeta();
}
