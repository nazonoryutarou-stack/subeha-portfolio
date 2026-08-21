import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const inputArg = process.argv.find((arg) => arg.startsWith('--input='));
const input = path.resolve(root, inputArg ? inputArg.slice('--input='.length) : 'out/kiritori.mp4');
if (!fs.existsSync(input)) throw new Error(`QC対象動画がありません: ${input}`);

const envelopePath = path.join(root, 'public', 'envelope.json');
if (!fs.existsSync(envelopePath)) throw new Error('public/envelope.json がありません。');
const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
const fps = Number(envelope.fps || 30);
const values = Array.isArray(envelope.values) ? envelope.values.map(Number) : [];
if (!values.length) throw new Error('envelope.values が空です。');

const duration = values.length / fps;
const firstUsableFrame = Math.min(values.length - 1, Math.round(fps * 0.5));
let peakFrame = firstUsableFrame;
for (let i = firstUsableFrame; i < values.length; i++) {
  if (values[i] > values[peakFrame]) peakFrame = i;
}

const checkpoints = [
  ['start', Math.min(3, Math.max(0, duration * 0.08))],
  ['speech-peak', peakFrame / fps],
  ['middle', Math.max(0, duration / 2)],
  ['end', Math.max(0, duration - 1)],
];

const qcDir = path.join(root, 'out', 'qc');
fs.rmSync(qcDir, {recursive: true, force: true});
fs.mkdirSync(qcDir, {recursive: true});

for (const [name, second] of checkpoints) {
  const out = path.join(qcDir, `${name}.png`);
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', Number(second).toFixed(3),
    '-i', input,
    '-frames:v', '1',
    out,
  ], {stdio: 'inherit'});
  if (result.status !== 0) throw new Error(`QCフレーム抽出に失敗: ${name}`);
}

const checklist = `VRM動画 QC\n\nこの4枚を必ず目視してから「完成」と言う。\n\n- start.png: Tポーズでない / 腕と姿勢が自然\n- speech-peak.png: 喋っている箇所で口が開いている\n- middle.png: 字幕と画面レイアウトが破綻していない\n- end.png: オチまで入っている / 最終字幕がずれていない\n\n動画: ${path.relative(root, input)}\n尺: ${duration.toFixed(2)} 秒\n口パク最大フレーム: ${peakFrame} (${(peakFrame / fps).toFixed(2)} 秒)\n`;
fs.writeFileSync(path.join(qcDir, 'CHECKLIST.txt'), checklist);

console.log(`QC frames: ${path.relative(root, qcDir)}`);
for (const [name, second] of checkpoints) console.log(`- ${name}: ${Number(second).toFixed(2)}s`);
console.log('注意: フレームを抽出しただけでは合格ではありません。4枚を実際に見て確認してください。');
