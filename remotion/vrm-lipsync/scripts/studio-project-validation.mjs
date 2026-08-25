const SHA256_RE = /^[a-fA-F0-9]{64}$/;
const SUPPORTED_LAYOUTS = new Set(['720x1280', '900x900', '1280x720']);

const number = (value) => Number(value);
const finite = (value) => Number.isFinite(number(value));

const assertRange = (item, label, durationMs) => {
  const startMs = number(item?.startMs);
  const endMs = number(item?.endMs);
  if (!finite(startMs) || !finite(endMs) || startMs < 0 || endMs <= startMs) {
    throw new Error(`${label} の時刻範囲が不正です。`);
  }
  if (endMs > durationMs) throw new Error(`${label} が元音声長 ${durationMs}ms を超えています。`);
};

export const validateStudioProject = (studio) => {
  if (!studio || typeof studio !== 'object' || Array.isArray(studio)) throw new Error('VRM Studio project.json がオブジェクトではありません。');
  if (number(studio.version) !== 1) throw new Error(`未対応のproject.json version: ${studio.version}`);
  if (!studio.source || !SHA256_RE.test(String(studio.source.sha256 || ''))) throw new Error('project.json に有効な元音声SHA-256がありません。');

  const durationMs = number(studio.source.durationMs);
  if (!finite(durationMs) || durationMs <= 0) throw new Error('project.json の元音声長が不正です。');
  if (!studio.clip) throw new Error('project.json にclip範囲がありません。');
  assertRange(studio.clip, 'project.json のclip範囲', durationMs);

  const width = number(studio.layout?.width || 720);
  const height = number(studio.layout?.height || 1280);
  if (!SUPPORTED_LAYOUTS.has(`${width}x${height}`)) throw new Error(`未対応の出力サイズです: ${width}x${height}`);

  if (!Array.isArray(studio.captions) || studio.captions.length === 0) throw new Error('project.json に字幕がありません。');
  if (!Array.isArray(studio.speakerTurns) || studio.speakerTurns.length === 0) throw new Error('project.json にspeakerTurnsがありません。');
  if (!Array.isArray(studio.visualReferences)) throw new Error('project.json のvisualReferences形式が不正です。');

  studio.captions.forEach((caption, index) => {
    assertRange(caption, `字幕 #${index + 1}`, durationMs);
    if (!String(caption?.text || '').trim()) throw new Error(`字幕 #${index + 1} の本文が空です。`);
  });

  studio.speakerTurns.forEach((turn, index) => {
    assertRange(turn, `話者区間 #${index + 1}`, durationMs);
    if (!String(turn?.speaker || '').trim()) throw new Error(`話者区間 #${index + 1} のspeakerが空です。`);
  });

  const avatarSpeaker = String(studio.avatar?.speaker || '').trim();
  if (!avatarSpeaker) throw new Error('project.json で本人話者が未指定です。');
  const speakers = new Set(studio.speakerTurns.map((turn) => String(turn?.speaker || '').trim()).filter(Boolean));
  if (!speakers.has(avatarSpeaker)) throw new Error(`本人話者 ${avatarSpeaker} がspeakerTurnsに存在しません。`);

  studio.visualReferences.forEach((ref, index) => {
    assertRange(ref, `画像素材 #${index + 1}`, durationMs);
    const source = String(ref?.url || ref?.thumbnailUrl || ref?.renderFile || '').trim();
    if (!source) throw new Error(`画像素材 #${index + 1} に画像データまたはURLがありません。`);
  });

  return {durationMs, width, height, avatarSpeaker};
};
