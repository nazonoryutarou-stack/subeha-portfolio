import {apiBaseIsConfigured, checkApiHealth, getApiBase, setApiBase} from './api/client.js';

const panel = document.getElementById('panel');
const status = document.getElementById('status');

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>API CONNECTION</h2>
    <input id="studioApiBase" type="url" inputmode="url" placeholder="https://YOUR-WORKER.workers.dev/api">
    <div class="studio-actions">
      <button id="studioApiSave" type="button">API URLを保存</button>
      <button id="studioApiTest" type="button">接続テスト</button>
    </div>
    <button id="studioApiReset" type="button">既定に戻す</button>
    <div id="studioApiState" class="studio-meta"></div>
  `;
  panel.insertBefore(section, panel.firstChild);

  const input = document.getElementById('studioApiBase');
  const save = document.getElementById('studioApiSave');
  const test = document.getElementById('studioApiTest');
  const reset = document.getElementById('studioApiReset');
  const state = document.getElementById('studioApiState');

  const refresh = () => {
    const base = getApiBase();
    input.value = apiBaseIsConfigured() ? base : '';
    state.textContent = apiBaseIsConfigured()
      ? `接続先: ${base}`
      : 'API未設定。GitHub Pagesでは字幕解析・画像生成は動きません。参考画像検索は利用できます。';
  };

  save?.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) {
      if (status) status.textContent = 'WorkerのAPI URLを入力してください。';
      return;
    }
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) throw new Error('http/https only');
      const base = setApiBase(value);
      if (status) status.textContent = `API接続先を保存しました: ${base}`;
      refresh();
    } catch {
      if (status) status.textContent = 'API URLが不正です。例: https://xxxx.workers.dev/api';
    }
  });

  test?.addEventListener('click', async () => {
    test.disabled = true;
    if (status) status.textContent = `API接続確認中: ${getApiBase()}`;
    try {
      const health = await checkApiHealth();
      if (health?.ok !== true) throw new Error('health response is not ok');
      state.textContent = `接続OK / OpenAI secret: ${health.openaiConfigured ? '設定済み' : '未設定'} / API v${health.version || 1}`;
      if (status) status.textContent = health.openaiConfigured
        ? 'VRM Studio APIへ接続できました。字幕解析・画像生成を利用できます。'
        : 'Workerには接続できましたが、OPENAI_API_KEY が未設定です。';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `API接続失敗: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      test.disabled = false;
    }
  });

  reset?.addEventListener('click', () => {
    setApiBase('/api');
    if (status) status.textContent = 'API接続先を既定値 /api に戻しました。';
    refresh();
  });

  refresh();
}
