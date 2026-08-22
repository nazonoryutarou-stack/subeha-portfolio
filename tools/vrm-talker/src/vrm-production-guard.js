import {inspectVideoVrmFile} from './vrm-preflight.js';

const input = document.getElementById('vrmFile');
const status = document.getElementById('status');
let validationToken = 0;
let current = {file: null, checking: false, ok: false, missing: []};

const setStatus = (message) => { if (status) status.textContent = message; };
const rememberButton = () => document.getElementById('vrmRemember');
const recordButton = () => document.getElementById('record');

const publish = () => {
  window.dispatchEvent(new CustomEvent('vrm-studio-vrm-preflight', {detail: {...current}}));
};

const validateSelected = async () => {
  const file = input?.files?.[0] || null;
  const token = ++validationToken;
  current = {file, checking: Boolean(file), ok: false, missing: []};
  if (file) {
    const remember = rememberButton();
    if (remember) remember.disabled = true;
  }
  publish();
  if (!file) return;

  try {
    const result = await inspectVideoVrmFile(file);
    if (token !== validationToken) return;
    current = {file, checking: false, ok: result.ok, missing: result.missing};
    const remember = rememberButton();
    if (remember) remember.disabled = !result.ok;
    if (!result.ok) {
      const record = recordButton();
      if (record) record.disabled = true;
      setStatus(`⚠ ${file.name}: 動画用口形が不足 (${result.missing.join('/')})。録画・記憶を禁止しました。Subeha.vrm を使用してください。`);
    }
    publish();
  } catch (error) {
    if (token !== validationToken) return;
    current = {file, checking: false, ok: false, missing: []};
    const remember = rememberButton();
    if (remember) remember.disabled = true;
    const record = recordButton();
    if (record) record.disabled = true;
    setStatus(`VRM事前検査失敗: ${error instanceof Error ? error.message : String(error)}`);
    publish();
  }
};

input?.addEventListener('change', () => { void validateSelected(); });

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const guarded = target.closest('#record, #vrmRemember');
  if (!guarded) return;
  if (current.ok && !current.checking) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setStatus(current.checking
    ? '動画用VRMを検査中です。aa / ih / ou / ee / oh を確認してから続行します。'
    : '動画用VRMの5口形 aa / ih / ou / ee / oh が確認できないため、録画・記憶を実行できません。');
}, true);
