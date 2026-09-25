const SHA256_RE = /^[a-fA-F0-9]{64}$/;
const SUPPORTED_LAYOUTS = new Set(['720x1280', '900x900', '1280x720']);

const finite = (value) => Number.isFinite(Number(value));
const number = (value) => Number(value);

const assertTimedRange = (item, label, durationMs) => {
  const startMs = number(item?.startMs);
  const endMs = number(item?.endMs);
  if (!finite(startMs) || !finite(endMs) || startMs < 0 || endMs <= startMs) {
    throw new Error(`${label} の時刻範囲が不正です。`);
  }
  if (endMs > durationMs) {
    throw new Error(`${label} が元音声長 ${durationMs}ms を超えています。`);
  }
};

export const validateProjectSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('project.json がオブジェクトではありません。');
  }
  if (number(snapshot.version) !== 1) {
    throw new Error(`未対応のproject.json version: ${snapshot.version}`);
  }
  if (!snapshot.source || !SHA256_RE.test(String(snapshot.source.sha256 || ''))) {
    throw new Error('project.json に有効な元音声SHA-256がありません。');
  }

  const durationMs = number(snapshot.source.durationMs);
  if (!finite(durationMs) || durationMs <= 0) {
    throw new Error('project.json の元音声長が不正です。');
  }

  if (!snapshot.clip) throw new Error('project.json にclip範囲がありません。');
  assertTimedRange(snapshot.clip, 'project.json のclip範囲', durationMs);

  const width = number(snapshot.layout?.width ?? 720);
  const height = number(snapshot.layout?.height ?? 1280);
  if (!SUPPORTED_LAYOUTS.has(`${width}x${height}`)) {
    throw new Error(`未対応の出力サイズです: ${width}x${height}`);
  }

  if (!Array.isArray(snapshot.captions) || !Array.isArray(snapshot.speakerTurns) || !Array.isArray(snapshot.visualReferences)) {
    throw new Error('project.json の字幕・話者・画像タイムライン形式が不正です。');
  }

  snapshot.captions.forEach((caption, index) => {
    assertTimedRange(caption, `字幕 #${index + 1}`, durationMs);
    if (!String(caption?.text || '').trim()) throw new Error(`字幕 #${index + 1} の本文が空です。`);
  });

  snapshot.speakerTurns.forEach((turn, index) => {
    assertTimedRange(turn, `話者区間 #${index + 1}`, durationMs);
    if (!String(turn?.speaker || '').trim()) throw new Error(`話者区間 #${index + 1} のspeakerが空です。`);
  });

  const avatarSpeaker = String(snapshot.avatar?.speaker || '').trim();
  if (avatarSpeaker) {
    const known = new Set(snapshot.speakerTurns.map((turn) => String(turn?.speaker || '').trim()).filter(Boolean));
    if (!known.has(avatarSpeaker)) {
      throw new Error(`本人話者 ${avatarSpeaker} がspeakerTurnsに存在しません。`);
    }
  }

  snapshot.visualReferences.forEach((ref, index) => {
    assertTimedRange(ref, `画像素材 #${index + 1}`, durationMs);
    const hasImage = Boolean(String(ref?.url || '').trim() || String(ref?.thumbnailUrl || '').trim() || String(ref?.renderFile || '').trim());
    if (!hasImage) throw new Error(`画像素材 #${index + 1} に画像データまたはURLがありません。`);
  });

  if (snapshot.visualCues != null && !Array.isArray(snapshot.visualCues)) {
    throw new Error('project.json のvisualCues形式が不正です。');
  }
  for (let index = 0; index < (snapshot.visualCues || []).length; index++) {
    const cue = snapshot.visualCues[index];
    assertTimedRange(cue, `画像候補 #${index + 1}`, durationMs);
    const startIndex = number(cue?.startIndex);
    const endIndex = number(cue?.endIndex);
    if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex) || startIndex < 0 || endIndex < startIndex || endIndex >= snapshot.captions.length) {
      throw new Error(`画像候補 #${index + 1} の字幕indexが不正です。`);
    }
  }

  return snapshot;
};

export const supportedProjectLayouts = () => [...SUPPORTED_LAYOUTS];
