import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const asrDir = path.resolve(root, valueArg('asr-dir') || 'out/timed-asr');
const outputPlan = path.resolve(root, valueArg('output') || 'out/full-audio-plan.json');
const sourceLabel = valueArg('source-label') || 'Audio / full duration';
const title = valueArg('title') || '配信161 / 冒頭3分';

const captionsPath = path.join(asrDir, 'timed-asr.json');
const metaPath = path.join(asrDir, 'timed-asr.meta.json');
if (!fs.existsSync(captionsPath) || !fs.existsSync(metaPath)) throw new Error('ASR artifacts missing');
const asr = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const durationMs = Math.round(Number(meta.sourceDurationSeconds) * 1000);
if (!Array.isArray(asr) || !asr.length || !Number.isFinite(durationMs) || durationMs <= 0) throw new Error('invalid ASR');

const captions = asr.map((c, index) => {
  const startMs = Math.max(0, Math.round(Number(c.startMs)));
  const endMs = Math.min(durationMs, Math.round(Number(c.endMs)));
  const text = String(c.text || '').trim();
  if (!text || endMs <= startMs) throw new Error(`invalid caption ${index}`);
  return {startMs, endMs, speaker:'HOST', text, speakerConfidence:0.8, speakerReason:'single-host full-duration test'};
});

const visualsDir = path.join(root, 'public', 'visuals');
fs.mkdirSync(visualsDir, {recursive:true});
const visualReferences = [];
const segmentMs = 45000;
for (let start = 0, n = 1; start < durationMs; start += segmentMs, n++) {
  const end = Math.min(durationMs, start + segmentMs);
  const text = captions.filter(c => c.endMs > start && c.startMs < end).map(c => c.text).join(' ').replace(/\s+/g,' ').trim();
  const excerpt = text.slice(0, 150) || '音声区間を解析中';
  const file = `161-segment-${String(n).padStart(2,'0')}.svg`;
  fs.writeFileSync(path.join(visualsDir, file), svgCard(n, start, end, excerpt));
  visualReferences.push({
    startMs:start,
    endMs:end,
    kind:'local',
    renderFile:`visuals/${file}`,
    title:`SECTION ${String(n).padStart(2,'0')}`,
    creator:'auto transcript card',
    license:'generated',
  });
}

const plan = {
  version:1,
  sourceLabel,
  selection:{reason:'requested full first three minutes',hook:'配信161 冒頭3分',summary:'冒頭3分を全尺VTuber化する基準テスト'},
  clip:{startMs:0,endMs:durationMs},
  layout:{width:1280,height:720,captionBottomPx:50},
  text:{title,telop:''},
  captions,
  visualReferences,
  motion:{profile:'normal',notes:'golden landscape v1 framing; full-duration test'},
};
fs.mkdirSync(path.dirname(outputPlan), {recursive:true});
fs.writeFileSync(outputPlan, JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({ok:true,outputPlan,durationMs,captions:captions.length,visuals:visualReferences.length},null,2));

function svgCard(n,start,end,excerpt){
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const lines = wrap(excerpt, 22).slice(0,6);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
  <rect width="1200" height="720" fill="#11151b"/>
  <rect x="34" y="34" width="1132" height="652" rx="24" fill="#171c24" stroke="#d2aa62" stroke-opacity=".5" stroke-width="2"/>
  <text x="74" y="105" fill="#d2aa62" font-family="Noto Sans CJK JP, sans-serif" font-size="24" letter-spacing="5">LIVE TRANSCRIPT / SECTION ${String(n).padStart(2,'0')}</text>
  <text x="74" y="162" fill="#f3f0e8" font-family="Noto Sans CJK JP, sans-serif" font-size="34" font-weight="700">${time(start)} － ${time(end)}</text>
  ${lines.map((line,i)=>`<text x="74" y="${245+i*62}" fill="#f4f2ec" font-family="Noto Sans CJK JP, sans-serif" font-size="38" font-weight="650">${esc(line)}</text>`).join('\n')}
  <line x1="74" y1="625" x2="250" y2="625" stroke="#d2aa62" stroke-width="3"/>
  <text x="1070" y="632" text-anchor="end" fill="#7d8490" font-family="monospace" font-size="18">HAISHIN 161</text>
</svg>`;
}
function wrap(text,max){
  const chars=[...text]; const out=[]; let line='';
  for(const ch of chars){line+=ch;if([...line].length>=max){out.push(line);line='';}}
  if(line)out.push(line); return out;
}
function time(ms){const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
