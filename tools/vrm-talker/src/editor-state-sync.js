import {getProject, patchProject} from './app/project-state.js';

const title = document.getElementById('titleTx');
const telop = document.getElementById('telop');
const bgFile = document.getElementById('bgFile');
const clearBg = document.getElementById('clearBg');
const seek = document.getElementById('seek');
const markA = document.getElementById('markA');
const markB = document.getElementById('markB');
const clearClip = document.getElementById('clearClip');
const status = document.getElementById('status');
const sizeV = document.getElementById('sizeV');
const sizeS = document.getElementById('sizeS');
const sizeH = document.getElementById('sizeH');

let applying = false;
const setStatus = (message) => { if (status) status.textContent = message; };

const currentMs = () => {
  const duration = Number(getProject().source.durationMs || 0);
  if (!seek || !duration) return 0;
  return Math.round(Number(seek.value || 0) / 1000 * duration);
};

const dataUrlForFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => resolve(String(reader.result || '')), {once: true});
  reader.addEventListener('error', () => reject(reader.error || new Error('背景画像を読み込めませんでした。')), {once: true});
  reader.readAsDataURL(file);
});

const patchText = () => {
  if (applying) return;
  const project = getProject();
  patchProject({
    text: {
      ...project.text,
      title: title?.value || '',
      telop: telop?.value || '',
    },
  });
};

title?.addEventListener('input', patchText);
telop?.addEventListener('input', patchText);

const captionBottomForSize = (width, height) => (
  height > width ? Math.round(height * 0.2265) : Math.round(height * 0.07)
);

const patchSize = (width, height) => {
  if (applying) return;
  const project = getProject();
  patchProject({
    layout: {
      ...project.layout,
      width,
      height,
      captionBottomPx: captionBottomForSize(width, height),
    },
  });
};
sizeV?.addEventListener('click', () => patchSize(720, 1280));
sizeS?.addEventListener('click', () => patchSize(900, 900));
sizeH?.addEventListener('click', () => patchSize(1280, 720));

bgFile?.addEventListener('change', async () => {
  if (applying) return;
  const file = bgFile.files?.[0];
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) {
    setStatus('背景は表示しましたが、12MBを超えるためproject.jsonには埋め込みません。再開時は背景を再選択してください。');
    return;
  }
  try {
    const dataUrl = await dataUrlForFile(file);
    const project = getProject();
    patchProject({layout: {...project.layout, background: dataUrl}});
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : String(error));
  }
});

clearBg?.addEventListener('click', () => {
  if (applying) return;
  const project = getProject();
  patchProject({layout: {...project.layout, background: null}});
});

markA?.addEventListener('click', () => {
  if (applying) return;
  const project = getProject();
  const startMs = currentMs();
  const duration = Number(project.source.durationMs || 0);
  const existingEnd = Number(project.clip.endMs || duration);
  const endMs = existingEnd > startMs ? existingEnd : duration;
  if (endMs > startMs) patchProject({clip: {startMs, endMs}});
});

markB?.addEventListener('click', () => {
  if (applying) return;
  const project = getProject();
  const endMs = currentMs();
  const existingStart = Number(project.clip.startMs || 0);
  const startMs = existingStart < endMs ? existingStart : 0;
  if (endMs > startMs) patchProject({clip: {startMs, endMs}});
});

clearClip?.addEventListener('click', () => {
  if (applying) return;
  const duration = Number(getProject().source.durationMs || 0);
  if (duration > 0) patchProject({clip: {startMs: 0, endMs: duration}});
});

const setSeekMs = (ms) => {
  const duration = Number(getProject().source.durationMs || 0);
  if (!seek || !duration) return;
  seek.value = String(Math.round(Math.max(0, Math.min(duration, Number(ms) || 0)) / duration * 1000));
  seek.dispatchEvent(new Event('input', {bubbles: true}));
};

const restoreClipControls = async () => {
  const project = getProject();
  const startMs = Number(project.clip.startMs || 0);
  const endMs = Number(project.clip.endMs || project.source.durationMs || 0);
  if (!(endMs > startMs) || markA?.disabled || markB?.disabled) return;
  applying = true;
  try {
    setSeekMs(startMs);
    markA?.click();
    setSeekMs(endMs);
    markB?.click();
    setSeekMs(startMs);
  } finally {
    applying = false;
  }
};

const restoreBackground = async (dataUrl) => {
  if (!bgFile || !dataUrl || !String(dataUrl).startsWith('data:image/')) return;
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const file = new File([blob], `project-background.${extension}`, {type: blob.type || 'image/jpeg'});
    if (typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    bgFile.files = transfer.files;
    bgFile.dispatchEvent(new Event('change', {bubbles: true}));
  } catch (error) {
    console.warn('project background restore failed', error);
  }
};

const restoreEditorUi = async ({restoreClip = false} = {}) => {
  const project = getProject();
  applying = true;
  try {
    if (title) {
      title.value = project.text?.title || '';
      title.dispatchEvent(new Event('input', {bubbles: true}));
    }
    if (telop) {
      telop.value = project.text?.telop || '';
      telop.dispatchEvent(new Event('input', {bubbles: true}));
    }

    const width = Number(project.layout?.width);
    const height = Number(project.layout?.height);
    if (width === 900 && height === 900) sizeS?.click();
    else if (width === 1280 && height === 720) sizeH?.click();
    else sizeV?.click();

    if (project.layout?.background) await restoreBackground(project.layout.background);
    else clearBg?.click();
  } finally {
    applying = false;
  }

  if (restoreClip) {
    // audio metadata側がUIを有効化するまで1tick譲る。
    setTimeout(() => void restoreClipControls(), 0);
  }
};

window.addEventListener('vrm-studio-project-changed', (event) => {
  const reason = event.detail?.reason;
  if (reason === 'loaded-awaiting-source') void restoreEditorUi({restoreClip: false});
  else if (reason === 'source-verified') void restoreEditorUi({restoreClip: true});
  else if (reason === 'new-source' || reason === 'reset') void restoreEditorUi({restoreClip: false});
});
