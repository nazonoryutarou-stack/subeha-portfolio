import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {validateStudioProject} from './studio-project-validation.mjs';

const projectRoot = process.cwd();
const valueArg = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
};

const hashFile = async (filePath) => {
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
};

const projectArg = valueArg('project');
const audioArg = valueArg('audio');
if (!projectArg || !audioArg) {
  console.error('使い方: npm run prepare:studio -- --project=/path/project.json --audio=/path/source.m4a');
  process.exit(2);
}

const studioProjectPath = path.resolve(projectRoot, projectArg);
const sourceAudioPath = path.resolve(projectRoot, audioArg);
if (!fs.existsSync(studioProjectPath)) throw new Error(`project.json がありません: ${studioProjectPath}`);
if (!fs.existsSync(sourceAudioPath)) throw new Error(`元音声がありません: ${sourceAudioPath}`);

const studio = JSON.parse(fs.readFileSync(studioProjectPath, 'utf8'));
const {durationMs: sourceDurationMs, width, height, avatarSpeaker} = validateStudioProject(studio);

const sourceHash = await hashFile(sourceAudioPath);
if (sourceHash.toLowerCase() !== String(studio.source.sha256).toLowerCase()) {
  throw new Error(`project.json と元音声のSHA-256が一致しません。expected=${studio.source.sha256} actual=${sourceHash}`);
}

const startMs = Number(studio.clip.startMs);
const endMs = Number(studio.clip.endMs);
if (endMs > sourceDurationMs) throw new Error('project.json のclip範囲が元音声長を超えています。');

const tempJobDir = path.join(projectRoot, 'jobs', '.generated');
fs.mkdirSync(tempJobDir, {recursive: true});
const tempJobPath = path.join(tempJobDir, 'studio-current.json');
const job = {
  sourceAudio: path.relative(projectRoot, sourceAudioPath),
  sourceLabel: studio.source?.name || path.basename(sourceAudioPath),
  startMs,
  endMs,
  title: String(studio.text?.title || studio.title || studio.source?.name || 'VRM Studio'),
  telop: String(studio.text?.telop || studio.telop || ''),
  hook: String(studio.hook || ''),
  captions: studio.captions,
};
fs.writeFileSync(tempJobPath, JSON.stringify(job, null, 2) + '\n');

const runNode = (script, args = [], env = {}) => {
  const result = spawnSync(process.execPath, [path.join(projectRoot, 'scripts', script), ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {...process.env, ...env},
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (${result.status})`);
};

// prepare-clip 自身が動画用VRMを必ず検品するため、ここでは二重検品しない。
// 同じ原音から最終 voice.wav / clip.json を作る。この時点のenvelopeは本番扱いしない。
runNode('prepare-clip.mjs', [`--job=${path.relative(projectRoot, tempJobPath)}`], {REQUIRE_SPEAKER_TURNS: '0'});

const voicePath = path.join(projectRoot, 'public', 'voice.wav');
if (!fs.existsSync(voicePath)) throw new Error('prepare-clip 後に public/voice.wav がありません。');
const voiceHash = await hashFile(voicePath);

const ffprobe = spawnSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', voicePath,
], {encoding: 'utf8'});
if (ffprobe.status !== 0) throw new Error('ffprobe で最終WAV長を取得できません。');
const voiceDurationMs = Math.round(Number(ffprobe.stdout.trim()) * 1000);
if (!Number.isFinite(voiceDurationMs) || voiceDurationMs <= 0) throw new Error('最終WAV長が不正です。');

const relativeTurns = studio.speakerTurns.map((turn) => {
  const absoluteStart = Number(turn.startMs);
  const absoluteEnd = Number(turn.endMs);
  const clippedStart = Math.max(startMs, absoluteStart);
  const clippedEnd = Math.min(endMs, absoluteEnd);
  if (clippedEnd <= clippedStart) return null;
  return {
    speaker: String(turn.speaker),
    startMs: Math.max(0, Math.round(clippedStart - startMs)),
    endMs: Math.min(voiceDurationMs, Math.round(clippedEnd - startMs)),
  };
}).filter(Boolean);

if (!relativeTurns.some((turn) => turn.speaker === avatarSpeaker)) {
  throw new Error(`切り抜き範囲に本人話者 ${avatarSpeaker} の区間がありません。`);
}

const speakerPayload = {
  version: 1,
  audioSha256: voiceHash,
  durationMs: voiceDurationMs,
  avatarSpeaker,
  turns: relativeTurns,
};
fs.writeFileSync(path.join(projectRoot, 'public', 'speaker-turns.json'), JSON.stringify(speakerPayload, null, 2) + '\n');

// 一時fallback envelopeを、本番話者ゲート付きで必ず上書きする。
runNode('generate-envelope.mjs', [], {REQUIRE_SPEAKER_TURNS: '1'});

const clipPath = path.join(projectRoot, 'public', 'clip.json');
const clip = JSON.parse(fs.readFileSync(clipPath, 'utf8'));
clip.visualReferences = studio.visualReferences.map((item) => {
  const absoluteStart = Number(item.startMs);
  const absoluteEnd = Number(item.endMs);
  const clippedStart = Math.max(startMs, absoluteStart);
  const clippedEnd = Math.min(endMs, absoluteEnd);
  if (clippedEnd <= clippedStart) return null;
  return {
    ...item,
    startMs: Math.round(clippedStart - startMs),
    endMs: Math.round(clippedEnd - startMs),
  };
}).filter(Boolean);
clip.studioSourceSha256 = studio.source.sha256;
clip.avatarSpeaker = avatarSpeaker;
clip.layout = {
  width,
  height,
  captionBottomPx: Number(studio.layout?.captionBottomPx || 290),
};
const background = String(studio.layout?.background || '').trim();
clip.backgroundDataUrl = background.startsWith('data:image/') ? background : null;
fs.writeFileSync(clipPath, JSON.stringify(clip, null, 2) + '\n');

console.log(`Studio project imported: ${path.basename(studioProjectPath)}`);
console.log(`Source SHA-256: ${sourceHash}`);
console.log(`Final WAV SHA-256: ${voiceHash}`);
console.log(`Clip: ${startMs}ms - ${endMs}ms / ${width}x${height}`);
console.log(`Speaker turns: ${relativeTurns.length} / avatar=${avatarSpeaker}`);
console.log(`Visual references: ${clip.visualReferences.length}`);
console.log(`Background: ${clip.backgroundDataUrl ? 'embedded' : 'default'}`);
