import fs from 'node:fs';
import path from 'node:path';

const valueArg = (name, fallback = null) => {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};

const clipPath = path.resolve(valueArg('clip', 'public/clip.json'));
const outputPath = path.resolve(valueArg('output', 'public/mpt-terms.json'));
const endpoint = String(process.env.MPT_BASE_URL || valueArg('mpt-base', '') || '').replace(/\/$/, '');
const apiKey = process.env.MPT_API_KEY || '';

if (!fs.existsSync(clipPath)) throw new Error(`clip file not found: ${clipPath}`);
const clip = JSON.parse(fs.readFileSync(clipPath, 'utf8'));
const subject = String(clip?.mpt?.subject || clip?.title || '').trim();
const script = (clip?.captions || []).map((item) => String(item?.text || '').trim()).filter(Boolean).join('。');
const fallbackTerms = Array.isArray(clip?.mpt?.fallbackTerms) ? clip.mpt.fallbackTerms.map(String).filter(Boolean) : [];

const payload = {
  video_subject: subject,
  video_script: script,
  amount: Math.max(2, Math.min(8, Number(clip?.visualReferences?.length || fallbackTerms.length || 4))),
  match_materials_to_script: true,
};

const requestTerms = async () => {
  if (!endpoint) return null;
  const headers = {'content-type': 'application/json'};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(`${endpoint}/api/v1/terms`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`MoneyPrinterTurbo /api/v1/terms failed: ${response.status} ${await response.text()}`);
  const body = await response.json();
  const terms = body?.data?.video_terms ?? body?.video_terms ?? body?.data ?? null;
  if (!Array.isArray(terms) || terms.length === 0) throw new Error('MoneyPrinterTurbo returned no video_terms');
  return terms.map(String).filter(Boolean);
};

let mode = 'fallback';
let terms;
try {
  const remote = await requestTerms();
  if (remote) {
    terms = remote;
    mode = 'moneyprinterturbo-api';
  }
} catch (error) {
  if (String(process.env.MPT_REQUIRED || '') === '1') throw error;
  console.warn(`[mpt-bridge] ${error instanceof Error ? error.message : String(error)}`);
}

if (!terms) {
  terms = fallbackTerms;
  if (!terms.length) {
    terms = (clip?.visualReferences || []).map((item) => String(item?.query || '').trim()).filter(Boolean);
  }
}
if (!terms.length) throw new Error('No material search terms available');

const result = {
  version: 1,
  provider: 'MoneyPrinterTurbo',
  mode,
  endpoint: endpoint ? `${endpoint}/api/v1/terms` : null,
  request: payload,
  video_terms: terms,
  generatedAt: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
