const STORAGE_KEY = 'vrm-studio-api-base';

const normalizeBase = (value) => String(value || '').trim().replace(/\/$/, '');

export const getApiBase = () => {
  const saved = normalizeBase(localStorage.getItem(STORAGE_KEY));
  if (saved) return saved;
  const injected = normalizeBase(window.VRM_STUDIO_API_BASE);
  if (injected) return injected;
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
    throw new Error(`API returned non-JSON (${response.status})`);
  }
  if (!response.ok) {
    const message = data?.error || data?.message || `API request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
};

export const checkApiHealth = async () => {
  const response = await fetch(`${getApiBase()}/health`, {method: 'GET', cache: 'no-store'});
  return await parseJson(response);
};

export const transcribeAudio = async (file) => {
  const form = new FormData();
  form.append('audio', file, file.name);
  const response = await fetch(`${getApiBase()}/transcribe`, {
    method: 'POST',
    body: form,
  });
  return await parseJson(response);
};

export const suggestVisualCues = async (captions) => {
  const response = await fetch(`${getApiBase()}/visual-cues`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({captions}),
  });
  return await parseJson(response);
};

export const generateReferenceImage = async ({prompt, size = '1024x1024'}) => {
  const response = await fetch(`${getApiBase()}/images/generate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({prompt, size}),
  });
  return await parseJson(response);
};
