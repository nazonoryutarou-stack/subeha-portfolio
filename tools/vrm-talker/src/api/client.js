const STORAGE_KEY = 'vrm-studio-api-base';

const normalizeBase = (value) => String(value || '').trim().replace(/\/$/, '');
const BUILD_API_BASE = normalizeBase(import.meta.env.VITE_VRM_STUDIO_API_BASE);

export const getApiBase = () => {
  const saved = normalizeBase(localStorage.getItem(STORAGE_KEY));
  if (saved) return saved;
  const runtimeInjected = normalizeBase(window.VRM_STUDIO_API_BASE);
  if (runtimeInjected) return runtimeInjected;
  if (BUILD_API_BASE) return BUILD_API_BASE;
  return '/api';
};

export const setApiBase = (value) => {
  const normalized = normalizeBase(value);
  if (!normalized || normalized === '/api') localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, normalized);
  return getApiBase();
};

export const apiBaseIsConfigured = () => getApiBase() !== '/api';

const parseJson = async (response) => {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Worker returned non-JSON (${response.status})`);
  }
  if (!response.ok) {
    const message = data?.error || data?.message || `Worker request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
};

export const checkApiHealth = async () => {
  if (!apiBaseIsConfigured()) return {ok: true, freeOnly: true, openverseImport: false, optional: true};
  const response = await fetch(`${getApiBase()}/health`, {method: 'GET', cache: 'no-store'});
  return await parseJson(response);
};

// 正規動画制作ではChatGPTがedit-planを作る。Workerは任意のOpenverse固定化だけに使う。
export const importOpenverseImage = async (id) => {
  if (!apiBaseIsConfigured()) throw new Error('Openverse画像の録画用固定化には任意の無料Worker接続が必要です。');
  const response = await fetch(`${getApiBase()}/images/import-openverse`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({id}),
  });
  return await parseJson(response);
};
