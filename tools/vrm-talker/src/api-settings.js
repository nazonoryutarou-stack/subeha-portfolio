import {apiBaseIsConfigured, checkApiHealth, getApiBase, setApiBase} from './api/client.js';

const panel = document.getElementById('panel');
const status = document.getElementById('status');

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>OPTIONAL OPENVERSE PROXY</h2>
    <div class="small">正規動画制作は ChatGPT edit-plan → GitHub/Remotion で完結し、このWorkerは不要です。Webレビュー画面でOpenverse画像をdata URLへ固定したい時だけ使います。</div>
    <input id="studioApiBase" type="url" inputmode="url" placeholder="https://YOUR-WORKER.workers.dev/api">
    <div class="studio-actions">
      <button id="studioApiSave" type="button">Worker URLを保存</button>
      <button id="studioApiTest" type="button">接続テスト</button>
    </div>
    <button id="studioApiReset" type="button">Workerなしに戻す</button>
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
      ? `Openverse画像プロキシ: ${base}`
      : 'Worker未設定。正規のChatGPT→GitHubレンダーには影響しません。Web上のOpenverse検索・プレビューは利用できます。';
  };

  save?.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) {
      if (status) status.textContent = 'WorkerのURLを入力してください。';
      return;
    }
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) throw new Error('http/https only');
      const base = setApiBase(value);
      if (status) status.textContent = `Openverse画像プロキシを保存しました: ${base}`;
      refresh();
    } catch {
      if (status) status.textContent = 'Worker URLが不正です。例: https://xxxx.workers.dev/api';
    }
  });

  test?.addEventListener('click', async () => {
    if (!apiBaseIsConfigured()) {
      if (status) status.textContent = 'Workerは未設定です。正規レンダーには不要です。';
      return;
    }
    test.disabled = true;
    if (status) status.textContent = `Openverse画像プロキシ接続確認中: ${getApiBase()}`;
    try {
      const health = await checkApiHealth();
      if (health?.ok !== true) throw new Error('health response is not ok');
      const freeOnly = health?.freeOnly === true || health?.paidAI === false;
      state.textContent = `接続OK / Openverse固定化: ${health?.openverseImport ? '対応' : '未対応'} / 有料AIなし: ${freeOnly ? 'YES' : '確認不可'} / API v${health.version || 1}`;
      if (status) status.textContent = freeOnly
        ? 'Openverse画像プロキシへ接続できました。有料AI APIは使いません。'
        : 'Workerには接続できましたが、free-only状態を確認できません。';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `Worker接続失敗: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      test.disabled = false;
    }
  });

  reset?.addEventListener('click', () => {
    setApiBase('/api');
    if (status) status.textContent = 'Worker設定を解除しました。ChatGPT→GitHubレンダーには影響ありません。';
    refresh();
  });

  refresh();
}
