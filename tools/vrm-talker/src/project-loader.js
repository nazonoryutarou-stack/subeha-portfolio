import {
  availableSpeakers,
  getProject,
  isSourceVerificationPending,
  loadProjectSnapshot,
} from './app/project-state.js';

const panel = document.getElementById('panel');
const status = document.getElementById('status');
const audioInput = document.getElementById('audioFile');

const setStatus = (message) => { if (status) status.textContent = message; };

const syncExistingUi = () => {
  const project = getProject();
  const speakerSelect = document.getElementById('studioAvatarSpeaker');
  const warning = document.getElementById('studioSpeakerWarning');
  const meta = document.getElementById('studioMeta');

  if (speakerSelect) {
    const speakers = availableSpeakers();
    speakerSelect.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = speakers.length ? '本人の話者を選択' : '話者解析が必要です';
    speakerSelect.appendChild(placeholder);
    for (const speaker of speakers) {
      const option = document.createElement('option');
      option.value = speaker;
      option.textContent = speaker;
      option.selected = speaker === project.avatar.speaker;
      speakerSelect.appendChild(option);
    }
    speakerSelect.disabled = speakers.length === 0 || isSourceVerificationPending();
  }

  if (warning) {
    warning.textContent = isSourceVerificationPending()
      ? '元音声が未確認です。同じ配信音声を選択してSHA-256照合を完了してください。'
      : project.avatar.speaker
        ? `アバター話者: ${project.avatar.speaker}。この話者の区間だけ口パク対象です。`
        : '本人話者を確定するまで、話者ゲート付き口パクを完成扱いしません。';
  }

  if (meta) {
    const host = project.avatar.speaker;
    const hostTurns = host ? project.speakerTurns.filter((turn) => turn.speaker === host).length : 0;
    const otherTurns = host ? project.speakerTurns.length - hostTurns : project.speakerTurns.length;
    meta.innerHTML = [
      `<span class="studio-chip">字幕 ${project.captions.length}</span>`,
      `<span class="studio-chip">本人 ${host || '未指定'}</span>`,
      `<span class="studio-chip">HOST区間 ${hostTurns}</span>`,
      `<span class="studio-chip">OTHER ${otherTurns}</span>`,
      `<span class="studio-chip">画像 ${project.visualReferences.length}</span>`,
      isSourceVerificationPending() ? '<span class="studio-chip">音声 未確認</span>' : '',
    ].filter(Boolean).join('');
  }
};

const blockUnsafePlayback = (event) => {
  if (!isSourceVerificationPending()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setStatus('project.json の元音声が未確認です。先に同じ配信音声を選択してください。');
};

for (const id of ['play', 'preview', 'record']) {
  document.getElementById(id)?.addEventListener('click', blockUnsafePlayback, true);
}

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools project-loader';
  section.innerHTML = `
    <h2>PROJECT</h2>
    <div class="studio-actions">
      <button id="studioOpenProject" type="button">project.jsonを開く</button>
      <button id="studioClearProjectInput" type="button">読み込み解除</button>
    </div>
    <input id="studioProjectFile" type="file" accept="application/json,.json" hidden>
    <div id="studioProjectState" class="small">新規プロジェクト</div>
  `;
  panel.insertBefore(section, panel.firstChild);

  const open = document.getElementById('studioOpenProject');
  const clear = document.getElementById('studioClearProjectInput');
  const input = document.getElementById('studioProjectFile');
  const projectState = document.getElementById('studioProjectState');

  const refresh = () => {
    const project = getProject();
    if (projectState) {
      projectState.textContent = isSourceVerificationPending()
        ? `復元待ち: ${project.source.name} / 元音声を再選択してください`
        : project.source.sha256
          ? `編集中: ${project.source.name}`
          : '新規プロジェクト';
    }
    syncExistingUi();
  };

  open?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      const project = loadProjectSnapshot(snapshot);
      if (audioInput) audioInput.value = '';
      refresh();
      setStatus(`project.jsonを読み込みました。元音声「${project.source.name}」を選択してSHA-256照合してください。`);
    } catch (error) {
      console.error(error);
      input.value = '';
      setStatus(`project.json読込失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  clear?.addEventListener('click', () => {
    if (input) input.value = '';
    setStatus('project.jsonのファイル選択を解除しました。編集中データはそのままです。');
  });

  window.addEventListener('vrm-studio-project-changed', refresh);
  window.addEventListener('vrm-studio-source-rejected', () => {
    refresh();
    setStatus('元音声が一致しません。project.jsonに対応する正しい配信音声を選択してください。');
  });
  window.addEventListener('vrm-studio-source-progress', (event) => {
    if (event.detail?.phase === 'hash-done') refresh();
  });
  refresh();
}
