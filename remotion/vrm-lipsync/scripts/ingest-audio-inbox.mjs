import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const inboxArg = valueArg('inbox');
const outputArg = valueArg('output') || 'out/audio-ingest';

if (!inboxArg) {
  console.error('Usage: node scripts/ingest-audio-inbox.mjs --inbox=/path/to/jobs/vtuber-inbox/<id> [--output=out/audio-ingest]');
  process.exit(2);
}

const inbox = path.resolve(root, inboxArg);
const output = path.resolve(root, outputArg);
const manifestPath = path.join(inbox, 'manifest.json');
const payloadPath = path.join(inbox, 'audio.b64');

if (!fs.existsSync(manifestPath)) throw new Error(`manifest.json missing: ${manifestPath}`);
if (!fs.existsSync(payloadPath)) throw new Error(`audio.b64 missing: ${payloadPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest?.version !== 1) throw new Error(`unsupported inbox version: ${manifest?.version}`);
if (manifest?.encoding !== 'base64') throw new Error(`unsupported encoding: ${manifest?.encoding}`);

const expectedSha256 = String(manifest?.sha256 || '').toLowerCase();
if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('manifest.sha256 must be a 64-character lowercase hex SHA-256');

const extension = String(manifest?.extension || 'opus').replace(/^\./, '').toLowerCase();
if (!['opus', 'ogg', 'm4a', 'mp3', 'wav', 'aac'].includes(extension)) throw new Error(`unsupported audio extension: ${extension}`);

const encoded = fs.readFileSync(payloadPath, 'utf8').replace(/\s+/g, '');
if (!encoded || !/^[A-Za-z0-9+/]+=*$/.test(encoded)) throw new Error('audio.b64 is not valid base64 text');
if (encoded.length > 1_200_000) throw new Error(`audio.b64 too large for inbox transport: ${encoded.length} chars`);

const bytes = Buffer.from(encoded, 'base64');
if (!bytes.length) throw new Error('decoded audio is empty');
const actualSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
if (actualSha256 !== expectedSha256) {
  throw new Error(`audio SHA-256 mismatch: expected=${expectedSha256} actual=${actualSha256}`);
}

fs.mkdirSync(output, {recursive: true});
const sourcePath = path.join(output, `source.${extension}`);
fs.writeFileSync(sourcePath, bytes);

const probe = spawnSync('ffprobe', [
  '-v', 'error',
  '-select_streams', 'a:0',
  '-show_entries', 'format=duration,size:stream=codec_name,sample_rate,channels',
  '-of', 'json',
  sourcePath,
], {encoding: 'utf8'});
if (probe.status !== 0) throw new Error('ffprobe rejected decoded audio');
const info = JSON.parse(probe.stdout || '{}');
const durationSeconds = Number(info?.format?.duration);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('decoded audio has invalid duration');
if (!Array.isArray(info?.streams) || !info.streams.length) throw new Error('decoded file has no audio stream');

const result = {
  version: 1,
  accepted: true,
  sourceLabel: String(manifest?.sourceLabel || path.basename(inbox)),
  inboxId: path.basename(inbox),
  inputSha256: actualSha256,
  inputBytes: bytes.length,
  inputExtension: extension,
  durationSeconds,
  audioStream: info.streams[0],
  sourceFile: path.relative(root, sourcePath),
};
fs.writeFileSync(path.join(output, 'ingest-manifest.json'), JSON.stringify(result, null, 2) + '\n');

console.log(JSON.stringify(result, null, 2));
