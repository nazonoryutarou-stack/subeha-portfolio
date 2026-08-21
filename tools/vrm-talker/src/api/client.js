const apiBase = () => String(window.VRM_STUDIO_API_BASE || '/api').replace(/\/$/, '');

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

export const transcribeAudio = async (file) => {
  const form = new FormData();
  form.append('audio', file, file.name);
  const response = await fetch(`${apiBase()}/transcribe`, {
    method: 'POST',
    body: form,
  });
  return await parseJson(response);
};

export const generateReferenceImage = async ({prompt, size = '1024x1024'}) => {
  const response = await fetch(`${apiBase()}/images/generate`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({prompt, size}),
  });
  return await parseJson(response);
};
