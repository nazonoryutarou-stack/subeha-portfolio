import {apiBaseIsConfigured, checkApiHealth, getApiBase, setApiBase} from './api/client.js';

const panel = document.getElementById('panel');
const status = document.getElementById('status');

if (panel) {
  const section = document.createElement('section');
  section.className = 'studio-tools';
  section.innerHTML = `
    <h2>OPTIONAL FREE IMAGE PROXY</h2>
    <div class="small">字幕・話者解析・画像候補選定・抽象素材生成は端末内で無料実行します。このWorkerはOpenverse画像を録画安全なdata URLへ固定する時だけ使います。</div>
    <input id="studioApiBase" type="url" inputmode="url" placeholder="https://YOUR-WORKER.workers.dev/api">
    <div class="studio-actions">
      <button id="studioApiSave" type="button">無料Worker URLを保存</button>
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
      ? `無料画像プロキシ: ${base}`
      : 'Worker未設定。ローカル解析はそのまま利用できます。Openverse画像は検索・プレビューできますが、録画用固定化はできません。';
  };

  save?.addEventListener('click', () => {
    const value = input.value.trim();
    if (!value) {
      if (status) status.textContent = '無料WorkerのURLを入力してください。';
      return;
    }
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) throw new Error('http/https only');
      const base = setApiBase(value);
      if (status) status.textContent = `無料画像プロキシを保存しました: ${base}`;
      refresh();
    } catch {
      if (status) status.textContent = 'Worker URLが不正です。例: https://xxxx.workers.dev/api';
    }
  });

  test?.addEventListener('click', async () => {
    if (!apiBaseIsConfigured()) {
      if (status) status.textContent = 'Workerは未設定です。ローカル解析には不要です。';
      return;
    }
    test.disabled = true;
    if (status) status.textContent = `無料画像プロキシ接続確認中: ${getApiBase()}`;
    try {
      const health = await checkApiHealth();
      if (health?.ok !== true) throw new Error('health response is not ok');
      const freeOnly = health?.freeOnly === true || health?.paidAI === false;
      state.textContent = `接続OK / Openverse固定化: ${health?.openverseImport ? '対応' : '未対応'} / 無料専用: ${freeOnly ? 'YES' : '確認不可'} / API v${health.version || 1}`;
      if (status) status.textContent = freeOnly
        ? '無料画像プロキシへ接続できました。有料AI APIは使いません。'
        : 'Workerには接続できましたが、無料専用Workerか確認できません。';
    } catch (error) {
      console.error(error);
      if (status) status.textContent = `Worker接続失敗: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      test.disabled = false;
    }
  });

  reset?.addEventListener('click', () => {
    setApiBase('/api');
    if (status) status.textContent = '無料Worker設定を解除しました。ローカル解析は引き続き使えます。';
    refresh();
  });

  refresh();
}
