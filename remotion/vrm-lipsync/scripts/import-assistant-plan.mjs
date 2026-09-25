import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const projectRoot = process.cwd();
const valueArg = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const planArg = valueArg('plan');
const audioArg = valueArg('audio');
const outputArg = valueArg('output-project');
if (!planArg || !audioArg) {
  console.error('使い方: node scripts/import-assistant-plan.mjs --plan=/path/edit-plan.json --audio=/path/source.m4a [--output-project=jobs/.generated/assistant-project.json]');
  process.exit(2);
}

const planPath = path.resolve(projectRoot, planArg);
const audioPath = path.resolve(projectRoot, audioArg);
if (!fs.existsSync(planPath)) throw new Error(`edit-plan.json がありません: ${planPath}`);
if (!fs.existsSync(audioPath)) throw new Error(`元音声がありません: ${audioPath}`);

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
if (plan?.version !== 1) throw new Error(`未対応のassistant edit plan versionです: ${plan?.version}`);

const clipStart = Number(plan?.clip?.startMs);
const clipEnd = Number(plan?.clip?.endMs);
if (!Number.isInteger(clipStart) || !Number.isInteger(clipEnd) || clipStart < 0 || clipEnd <= clipStart) {
  throw new Error('edit-plan.json のclip.startMs/endMsが不正です。');
}

const ffprobe = spawnSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioPath,
], {encoding: 'utf8'});
if (ffprobe.status !== 0) throw new Error('ffprobeで元音声長を取得できません。');
const sourceDurationMs = Math.round(Number(ffprobe.stdout.trim()) * 1000);
if (!Number.isFinite(sourceDurationMs) || sourceDurationMs <= 0) throw new Error('元音声長が不正です。');
if (clipEnd > sourceDurationMs) throw new Error(`切り抜き終端が元音声長を超えています: clip=${clipEnd}ms source=${sourceDurationMs}ms`);

const hash = createHash('sha256');
for await (const chunk of fs.createReadStream(audioPath)) hash.update(chunk);
const sourceSha256 = hash.digest('hex');

const allowedSpeakers = new Set(['HOST', 'GUEST', 'UNKNOWN']);
const captions = (Array.isArray(plan.captions) ? plan.captions : []).map((caption, index) => {
  const startMs = Number(caption?.startMs);
  const endMs = Number(caption?.endMs);
  const speaker = String(caption?.speaker || 'UNKNOWN').toUpperCase();
  const text = String(caption?.text || '').trim();
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || endMs <= startMs) {
    throw new Error(`caption ${index} の時刻が不正です。`);
  }
  if (startMs < 0 || endMs > sourceDurationMs) throw new Error(`caption ${index} が元音声範囲外です。`);
  if (!allowedSpeakers.has(speaker)) throw new Error(`caption ${index} のspeakerが不正です: ${speaker}`);
  if (!text) throw new Error(`caption ${index} のtextが空です。`);
  return {
    text,
    startMs,
    endMs,
    speaker,
    speakerConfidence: caption?.speakerConfidence == null ? null : Number(caption.speakerConfidence),
    speakerReason: String(caption?.speakerReason || '').trim() || null,
  };
}).sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

if (!captions.length) throw new Error('edit-plan.json にcaptionsがありません。');
if (!captions.some((caption) => caption.speaker === 'HOST' && caption.endMs > clipStart && caption.startMs < clipEnd)) {
  throw new Error('切り抜き範囲にHOST発話がありません。');
}

for (let index = 1; index < captions.length; index++) {
  if (captions[index].startMs < captions[index - 1].startMs) throw new Error('captionsの時刻順が不正です。');
}

const speakerTurns = [];
for (const caption of captions) {
  const previous = speakerTurns[speakerTurns.length - 1];
  if (previous && previous.speaker === caption.speaker && caption.startMs - previous.endMs <= 250) {
    previous.endMs = Math.max(previous.endMs, caption.endMs);
  } else {
    speakerTurns.push({speaker: caption.speaker, startMs: caption.startMs, endMs: caption.endMs});
  }
}

const width = Number(plan?.layout?.width || 720);
const height = Number(plan?.layout?.height || 1280);
const supported = new Set(['720x1280', '900x900', '1280x720']);
if (!supported.has(`${width}x${height}`)) throw new Error(`未対応の出力サイズです: ${width}x${height}`);
const captionBottomPx = Number(plan?.layout?.captionBottomPx ?? (height === 1280 ? 290 : Math.round(height * 0.07)));

const visualReferences = (Array.isArray(plan.visualReferences) ? plan.visualReferences : []).map((item, index) => {
  const startMs = Number(item?.startMs);
  const endMs = Number(item?.endMs);
  if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || endMs <= startMs) {
    throw new Error(`visualReference ${index} の時刻が不正です。`);
  }
  if (startMs < 0 || endMs > sourceDurationMs) throw new Error(`visualReference ${index} が元音声範囲外です。`);
  const id = String(item?.id || randomUUID());
  return {
    ...item,
    id,
    assetId: String(item?.assetId || id),
    startMs,
    endMs,
  };
});

const project = {
  version: 1,
  source: {
    name: String(plan.sourceLabel || path.basename(audioPath)),
    sha256: sourceSha256,
    durationMs: sourceDurationMs,
  },
  clip: {startMs: clipStart, endMs: clipEnd},
  avatar: {speaker: 'HOST', model: 'Subeha.vrm'},
  text: {
    title: String(plan?.text?.title || ''),
    telop: String(plan?.text?.telop || ''),
  },
  captions,
  speakerTurns,
  visualCues: [],
  visualReferences,
  layout: {
    width,
    height,
    captionBottomPx,
    showSafeArea: false,
    background: typeof plan?.layout?.background === 'string' ? plan.layout.background : null,
  },
  selection: {
    reason: String(plan?.selection?.reason || ''),
    hook: String(plan?.selection?.hook || ''),
    summary: String(plan?.selection?.summary || ''),
  },
  motion: {
    profile: String(plan?.motion?.profile || 'normal'),
    notes: String(plan?.motion?.notes || ''),
  },
  generatedBy: 'chatgpt-assistant-edit-plan-v1',
};

const outputPath = path.resolve(projectRoot, outputArg || 'jobs/.generated/assistant-project.json');
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(project, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  plan: planPath,
  audio: audioPath,
  outputProject: outputPath,
  sourceSha256,
  sourceDurationMs,
  clip: project.clip,
  captions: captions.length,
  speakerTurns: speakerTurns.length,
  hostCaptions: captions.filter((caption) => caption.speaker === 'HOST').length,
  guestCaptions: captions.filter((caption) => caption.speaker === 'GUEST').length,
  unknownCaptions: captions.filter((caption) => caption.speaker === 'UNKNOWN').length,
  visualReferences: visualReferences.length,
  motionProfile: project.motion.profile,
}, null, 2));
