import {extractWavRange} from './audio-chunker.js';
import {getProject} from './app/project-state.js';
import {
  forgetKnownSpeakerReference,
  getKnownSpeakerReference,
  saveKnownSpeakerReference,
} from './known-speaker-store.js';

const panel = document.getElementById('panel');
const audioInput = document.getElementById('audioFile');
const seek = document.getElementById('seek');
const status = document.getElementById('status');
let startMs = null;
let endMs = null;

const setStatus = (message) => {
  if (status) status.textContent = message;
};

const currentMs = () => {
  const duration = Number(getProject().source.durationMs || 0);
  if (!duration || !seek) return 0;
  return Math.round(Number(seek.value || 0) / 1000 * duration);
};

const fmt = (ms) => `${(Math.max(0, Number(ms) || 0) / 1000).toFixed(2)}s`;

if (panel && audioInput) {
  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>HOST VOICE REFERENCE</h2>
    <div class="small">本人だけが話している2〜10秒を一度登録すると、長尺音声を分割してもHOSTを固定できます。</div>
    <div class="studio-actions">
      <button id="hostRefStart" type="button">本人声の始点</button>
      <button id="hostRefEnd" type="button">本人声の終点</button>
    </div>
    <div id="hostRefRange" class="studio-meta">未指定</div>
    <div class="studio-actions">
      <button id="hostRefSave" type="button">この区間をHOST登録</button>
      <button id="hostRefForget" type="button">HOST登録を削除</button>
    </div>
    <div id="hostRefSaved" class="small"></div>
  `;
  panel.insertBefore(section, status || null);

  const startButton = document.getElementById('hostRefStart');
  const endButton = document.getElementById('hostRefEnd');
  const saveButton = document.getElementById('hostRefSave');
  const forgetButton = document.getElementById('hostRefForget');
  const range = document.getElementById('hostRefRange');
  const saved = document.getElementById('hostRefSaved');

  const refreshRange = () => {
    if (startMs == null && endMs == null) range.textContent = '未指定';
    else range.textContent = `${startMs == null ? '…' : fmt(startMs)} → ${endMs == null ? '…' : fmt(endMs)}`;
  };

  const refreshSaved = async () => {
    const item = await getKnownSpeakerReference().catch(() => null);
    saved.textContent = item?.file ? `登録済み: ${item.name || 'HOST'} / ${(item.file.size / 1024).toFixed(0)}KB` : 'HOST声サンプル未登録';
  };

  startButton?.addEventListener('click', () => {
    startMs = currentMs();
    if (endMs != null && endMs <= startMs) endMs = null;
    refreshRange();
  });

  endButton?.addEventListener('click', () => {
    endMs = currentMs();
    if (startMs != null && endMs <= startMs) startMs = null;
    refreshRange();
  });

  saveButton?.addEventListener('click', async () => {
    const source = audioInput.files?.[0];
    if (!source) {
      setStatus('先に配信音声を選んでください。');
      return;
    }
    if (startMs == null || endMs == null) {
      setStatus('本人声の始点と終点を指定してください。');
      return;
    }
    const duration = (endMs - startMs) / 1000;
    if (duration < 2 || duration > 10) {
      setStatus('HOST声サンプルは2〜10秒にしてください。');
      return;
    }
    saveButton.disabled = true;
    setStatus('HOST声サンプルを抽出中…');
    try {
      const reference = await extractWavRange(source, startMs / 1000, endMs / 1000);
      await saveKnownSpeakerReference(reference, 'HOST');
      await refreshSaved();
      setStatus(`HOST声を登録しました: ${fmt(endMs - startMs)}`);
    } catch (error) {
      console.error(error);
      setStatus(`HOST声登録失敗: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      saveButton.disabled = false;
    }
  });

  forgetButton?.addEventListener('click', async () => {
    await forgetKnownSpeakerReference();
    await refreshSaved();
    setStatus('HOST声サンプルを削除しました。');
  });

  audioInput.addEventListener('change', () => {
    startMs = null;
    endMs = null;
    refreshRange();
  });

  refreshRange();
  void refreshSaved();
}
