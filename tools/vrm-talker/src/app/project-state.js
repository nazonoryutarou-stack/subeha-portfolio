import {sha256Blob} from '../sha256.js';

const emptyProject = () => ({
  version: 1,
  source: {name: '', sha256: '', durationMs: 0},
  clip: {startMs: 0, endMs: 0},
  avatar: {speaker: null, model: 'Subeha.vrm'},
  captions: [],
  speakerTurns: [],
  visualCues: [],
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
  const sha256 = await sha256Blob(file, {
    onProgress: ({loaded, total}) => {
      window.dispatchEvent(new CustomEvent('vrm-studio-source-progress', {
        detail: {phase: 'hash', loaded, total},
      }));
    },
  });
  project.source = {name: file.name, sha256, durationMs};
  project.avatar.speaker = null;
  project.captions = [];
  project.speakerTurns = [];
  project.visualCues = [];
  project.visualReferences = [];
  project.clip = {startMs: 0, endMs: durationMs > 0 ? durationMs : 0};
  window.dispatchEvent(new CustomEvent('vrm-studio-source-progress', {
    detail: {phase: 'hash-done', loaded: file.size, total: file.size},
  }));
  return project.source;
};

export const setAnalysis = ({captions = [], speakerTurns = [], durationMs} = {}) => {
  project.captions = Array.isArray(captions) ? captions : [];
  project.speakerTurns = Array.isArray(speakerTurns) ? speakerTurns : [];
  project.avatar.speaker = project.speakerTurns.some((turn) => turn?.speaker === 'HOST') ? 'HOST' : null;
  project.visualCues = [];
  project.visualReferences = [];
  if (Number.isFinite(Number(durationMs)) && Number(durationMs) > 0) {
    project.source.durationMs = Number(durationMs);
    if (project.clip.endMs <= 0) project.clip.endMs = Number(durationMs);
  }
  return project;
};

export const availableSpeakers = () => [...new Set(project.speakerTurns.map((turn) => String(turn.speaker || '')).filter(Boolean))];

export const setAvatarSpeaker = (speaker) => {
  const value = String(speaker || '').trim();
  if (!value) {
    project.avatar.speaker = null;
    return null;
  }
  const speakers = availableSpeakers();
  if (speakers.length && !speakers.includes(value)) throw new Error(`Unknown speaker: ${value}`);
  project.avatar.speaker = value;
  return value;
};

export const speakerAt = (timeMs) => {
  const now = Number(timeMs);
  if (!Number.isFinite(now)) return null;
  const turn = project.speakerTurns.find((item) => Number(item.startMs) <= now && Number(item.endMs) > now);
  return turn?.speaker || null;
};

export const isAvatarSpeaking = (timeMs) => {
  const avatarSpeaker = project.avatar.speaker;
  if (!avatarSpeaker) return false;
  return speakerAt(timeMs) === avatarSpeaker;
};

export const addVisualReference = (item) => {
  project.visualReferences.push(item);
  return item;
};

export const updateVisualReference = (id, patch) => {
  const index = project.visualReferences.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = {...project.visualReferences[index], ...patch};
  const startMs = Number(next.startMs);
  const endMs = Number(next.endMs);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs < 0 || endMs <= startMs) {
    throw new Error('画像素材の表示区間が不正です。');
  }
  const duration = Number(project.source.durationMs || 0);
  if (duration > 0 && endMs > duration) next.endMs = duration;
  project.visualReferences[index] = next;
  return next;
};

export const removeVisualReference = (id) => {
  const before = project.visualReferences.length;
  project.visualReferences = project.visualReferences.filter((item) => item.id !== id);
  return project.visualReferences.length < before;
};

export const visualReferenceAt = (timeMs) => {
  const now = Number(timeMs);
  if (!Number.isFinite(now)) return null;
  return project.visualReferences.find((item) => Number(item.startMs) <= now && Number(item.endMs) > now) || null;
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
