import {inspectVideoVrmFile} from './vrm-preflight.js';

const DB_NAME = 'subeha-vrm-studio';
const STORE = 'assets';
const KEY = 'avatar-vrm';

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
});

const storeFile = async (file) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      name: file.name || 'Subeha.vrm',
      type: file.type || 'model/gltf-binary',
      lastModified: file.lastModified || Date.now(),
      blob: file,
    }, KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('VRM cache write failed'));
  });
  db.close();
};

const loadFile = async () => {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('VRM cache read failed'));
  });
  db.close();
  if (!value?.blob) return null;
  return new File([value.blob], value.name || 'Subeha.vrm', {
    type: value.type || 'model/gltf-binary',
    lastModified: value.lastModified || Date.now(),
  });
};

const forget = async () => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('VRM cache delete failed'));
  });
  db.close();
};

const assignFile = (input, file) => {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles: true}));
    return true;
  } catch (error) {
    console.warn('Cached VRM could not be assigned automatically', error);
    return false;
  }
};

const status = document.getElementById('status');
const input = document.getElementById('vrmFile');
const panel = document.getElementById('panel');

if (input && panel) {
  const controls = document.createElement('div');
  controls.className = 'row';
  controls.innerHTML = `
    <button id="vrmRemember" type="button" disabled>このVRMを記憶</button>
    <button id="vrmForget" type="button">記憶VRMを削除</button>
  `;
  panel.appendChild(controls);

  const rememberButton = document.getElementById('vrmRemember');
  const forgetButton = document.getElementById('vrmForget');

  input.addEventListener('change', () => {
    rememberButton.disabled = !input.files?.[0];
  });

  rememberButton?.addEventListener('click', async () => {
    const file = input.files?.[0];
    if (!file) return;
    rememberButton.disabled = true;
    try {
      const preflight = await inspectVideoVrmFile(file);
      if (!preflight.ok) {
        throw new Error(`動画用口形が不足しています: ${preflight.missing.join('/')}`);
      }
      await storeFile(file);
      if (status) status.textContent = `VRMをこのブラウザに記憶しました：${file.name}`;
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `VRM記憶失敗：${error instanceof Error ? error.message : String(error)}`;
    } finally {
      rememberButton.disabled = false;
    }
  });

  forgetButton?.addEventListener('click', async () => {
    try {
      await forget();
      if (status) status.textContent = '記憶したVRMを削除しました。';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `VRM削除失敗：${error instanceof Error ? error.message : String(error)}`;
    }
  });

  loadFile().then(async (file) => {
    if (!file) return;
    const preflight = await inspectVideoVrmFile(file);
    if (!preflight.ok) {
      await forget();
      if (status) status.textContent = `記憶済みVRMは動画用口形が不足していたため削除しました：${preflight.missing.join('/')}`;
      return;
    }
    if (assignFile(input, file) && status) {
      status.textContent = `記憶済み動画用VRMを自動ロードしました：${file.name}`;
    }
  }).catch(async (error) => {
    console.warn('Cached VRM load failed', error);
    try { await forget(); } catch {}
    if (status) status.textContent = `記憶済みVRMを検査できなかったため削除しました：${error instanceof Error ? error.message : String(error)}`;
  });
}
