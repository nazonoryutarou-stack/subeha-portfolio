const emptyProject = () => ({
  version: 1,
  source: {name: '', sha256: '', durationMs: 0},
  clip: {startMs: 0, endMs: 0},
  avatar: {speaker: 'HOST', model: 'Subeha.vrm'},
  captions: [],
  speakerTurns: [],
  visualReferences: [],
  layout: {width: 720, height: 1280, captionBottomPx: 290, showSafeArea: true, background: null},
});

let project = emptyProject();

export const getProject = () => project;

export const resetProject = () => {
  project = emptyProject();
  return project;
};

export const patchProject = (patch) => {
  project = {...project, ...patch};
  return project;
};

export const setSourceFile = async (file, durationMs = 0) => {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  project.source = {name: file.name, sha256, durationMs};
  if (durationMs > 0 && project.clip.endMs <= 0) project.clip.endMs = durationMs;
  return project.source;
};

export const setAnalysis = ({captions = [], speakerTurns = [], durationMs} = {}) => {
  project.captions = Array.isArray(captions) ? captions : [];
  project.speakerTurns = Array.isArray(speakerTurns) ? speakerTurns : [];
  if (Number.isFinite(Number(durationMs)) && Number(durationMs) > 0) {
    project.source.durationMs = Number(durationMs);
    if (project.clip.endMs <= 0) project.clip.endMs = Number(durationMs);
  }
  return project;
};

export const addVisualReference = (item) => {
  project.visualReferences.push(item);
  return item;
};

export const downloadProject = (filename = 'vrm-studio-project.json') => {
  const blob = new Blob([JSON.stringify(project, null, 2) + '\n'], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
