import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const asrDir = path.resolve(root, valueArg('asr-dir') || 'out/timed-asr');
const outputPlan = path.resolve(root, valueArg('output-plan') || 'out/full-duration-plan.json');
const sourceLabel = valueArg('source-label') || 'audio';
const title = valueArg('title') || sourceLabel;
const sectionMs = Math.max(20_000, Number(valueArg('section-ms') || 45_000));

const captionsPath = path.join(asrDir, 'timed-asr.json');
const metaPath = path.join(asrDir, 'timed-asr.meta.json');
if (!fs.existsSync(captionsPath) || !fs.existsSync(metaPath)) {
  throw new Error(`ASR artifacts missing in ${asrDir}`);
}

const sourceCaptions = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const durationMs = Math.round(Number(meta.sourceDurationSeconds) * 1000);
if (!Array.isArray(sourceCaptions) || sourceCaptions.length === 0) throw new Error('timed-asr.json is empty');
if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('invalid source duration');

const captions = sourceCaptions.map((caption, index) => {
  const text = sanitize(String(caption?.text || ''));
  const startMs = Math.max(0, Math.round(Number(caption?.startMs)));
  const endMs = Math.min(durationMs, Math.round(Number(caption?.endMs)));
  if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error(`invalid caption ${index}`);
  }
  const marker = isNonSpeechMarker(text);
  return {
    startMs,
    endMs,
    speaker: marker ? 'UNKNOWN' : 'HOST',
    text,
    speakerConfidence: marker ? 1 : 0.85,
    speakerReason: marker ? 'non-speech marker from Whisper' : 'full-duration single-host render mode',
  };
});

const visualReferences = [];
for (let startMs = 0, index = 0; startMs < durationMs; startMs += sectionMs, index++) {
  const endMs = Math.min(durationMs, startMs + sectionMs);
  const phrases = captions
    .filter((caption) => caption.startMs < endMs && caption.endMs > startMs && caption.speaker === 'HOST')
    .map((caption) => caption.text)
    .filter(Boolean)
    .slice(0, 3);
  const detail = phrases.length ? phrases.join(' / ') : '音楽・待機区間';
  visualReferences.push({
    id: `full-${String(index + 1).padStart(2, '0')}`,
    kind: 'generated',
    visualType: 'concept-card',
    title: `SECTION ${String(index + 1).padStart(2, '0')}`,
    prompt: detail,
    query: null,
    url: null,
    dataUrl: null,
    renderFile: null,
    creator: 'VTuber Full Duration Planner',
    license: 'generated',
    startMs,
    endMs,
  });
}

const plan = {
  version: 1,
  sourceLabel,
  selection: {
    reason: 'user requested full-duration render',
    hook: title,
    summary: `Render the complete ${Math.round(durationMs / 1000)} second source without highlight selection.`,
  },
  clip: {startMs: 0, endMs: durationMs},
  layout: {width: 1280, height: 720, captionBottomPx: 34, background: '#0b0e13'},
  text: {title, telop: ''},
  captions,
  visualReferences,
  motion: {
    profile: 'normal',
    notes: 'golden landscape v1 framing; non-speech markers suppress HOST lip motion',
  },
};

fs.mkdirSync(path.dirname(outputPlan), {recursive: true});
fs.writeFileSync(outputPlan, JSON.stringify(plan, null, 2) + '\n');
console.log(JSON.stringify({
  ok: true,
  outputPlan,
  durationMs,
  captions: captions.length,
  hostCaptions: captions.filter((caption) => caption.speaker === 'HOST').length,
  nonSpeechCaptions: captions.filter((caption) => caption.speaker !== 'HOST').length,
  visuals: visualReferences.length,
}, null, 2));

function isNonSpeechMarker(text) {
  return /^（(?:音楽|BGM|拍手|笑い|歓声)）$/u.test(text);
}

function sanitize(text) {
  return text.replace(/\uFFFD+/gu, '').replace(/\s+/gu, ' ').trim();
}
