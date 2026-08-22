import {transcribeAudioLocally} from '../local-analysis.js';
import {generateLocalReferenceImage, suggestLocalVisualCues} from '../local-visual-director.js';

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
  if (!apiBaseIsConfigured()) return {ok: true, freeOnly: true, openverseImport: false, localOnly: true};
  const response = await fetch(`${getApiBase()}/health`, {method: 'GET', cache: 'no-store'});
  return await parseJson(response);
};

// 正規経路は完全無料のブラウザ内推論。音声は外部APIへ送らない。
export const transcribeAudio = async (file, options = {}) => transcribeAudioLocally(file, options);

// 画像挿入候補も端末内ルールで決定する。時刻はcaptionの実タイムコードのみを使う。
export const suggestVisualCues = async (captions) => {
  window.dispatchEvent(new CustomEvent('vrm-studio-visual-progress', {detail: {phase: 'local-start', index: 0, count: 1}}));
  const payload = suggestLocalVisualCues(captions);
  window.dispatchEvent(new CustomEvent('vrm-studio-visual-progress', {detail: {phase: 'done', index: 1, count: 1}}));
  return payload;
};

// 抽象・架空素材の必須経路はローカルCanvas生成。課金APIは使わない。
export const generateReferenceImage = async ({prompt, size = '1024x1024'}) => generateLocalReferenceImage({prompt, size});

// Cloudflare Free Workerは任意のOpenverse固定化プロキシだけを担当する。
export const importOpenverseImage = async (id) => {
  if (!apiBaseIsConfigured()) throw new Error('Openverse画像の録画用固定化には無料Workerの接続が必要です。検索・プレビュー・ローカル解析はWorkerなしで使えます。');
  const response = await fetch(`${getApiBase()}/images/import-openverse`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({id}),
  });
  return await parseJson(response);
};
