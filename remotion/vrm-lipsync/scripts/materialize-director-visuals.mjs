import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const valueArg = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const planArg = valueArg('plan');
if (!planArg) {
  console.error('Usage: node scripts/materialize-director-visuals.mjs --plan=/path/edit-plan.json');
  process.exit(2);
}

const planPath = path.resolve(root, planArg);
if (!fs.existsSync(planPath)) throw new Error(`plan not found: ${planPath}`);
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const refs = Array.isArray(plan.visualReferences) ? plan.visualReferences : [];
if (!refs.length) {
  console.log('Auto director visuals: 0');
  process.exit(0);
}

const visualsDir = path.join(root, 'public', 'visuals');
fs.mkdirSync(visualsDir, {recursive: true});

plan.visualReferences = refs.map((ref, index) => {
  if (ref?.renderFile) return ref;
  if (ref?.kind !== 'generated') throw new Error(`auto visual ${index} must be generated or already materialized`);
  const filename = `auto-director-${String(index + 1).padStart(2, '0')}.svg`;
  const target = path.join(visualsDir, filename);
  fs.writeFileSync(target, buildSvg(ref, index), 'utf8');
  console.log(`Auto visual ${index + 1}: visuals/${filename}`);
  return {
    ...ref,
    renderFile: `visuals/${filename}`,
    creator: ref.creator || 'VTuber Auto Director',
    license: ref.license || 'generated',
  };
});

fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
console.log(`Auto director visuals materialized: ${plan.visualReferences.length}`);

function buildSvg(ref, index) {
  const type = String(ref.visualType || 'concept-card');
  const title = String(ref.title || 'REFERENCE').trim().slice(0, 44);
  const detail = String(ref.prompt || '').trim().slice(0, 150);
  const titleLines = wrapJa(title, 18, 2);
  const detailLines = wrapJa(detail, 28, 4);
  const typeLabel = type.toUpperCase().replace(/-/g, ' ');

  const typeGraphic = type === 'timeline'
    ? timelineGraphic()
    : type === 'comparison'
      ? comparisonGraphic()
      : type === 'ui-mockup'
        ? uiGraphic()
        : conceptGraphic();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#161b24"/>
      <stop offset="1" stop-color="#0c0f15"/>
    </linearGradient>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" fill="none" stroke="#ffffff" stroke-opacity="0.045" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="900" height="600" rx="22" fill="url(#bg)"/>
  <rect width="900" height="600" rx="22" fill="url(#grid)"/>
  <rect x="1" y="1" width="898" height="598" rx="21" fill="none" stroke="#d2aa62" stroke-opacity="0.34"/>
  <text x="54" y="58" fill="#d2aa62" font-family="monospace" font-size="15" letter-spacing="4">AUTO OBSERVATION ${String(index + 1).padStart(2, '0')} / ${escapeXml(typeLabel)}</text>
  ${textLines(titleLines, 54, 116, 39, 46, '#f4f1e9', 700)}
  <line x1="54" y1="222" x2="846" y2="222" stroke="#d2aa62" stroke-opacity="0.25"/>
  ${typeGraphic}
  ${textLines(detailLines, 54, 495, 22, 31, '#cbd0d7', 500)}
  <path d="M54 548h78" stroke="#d2aa62" stroke-width="2"/>
  <text x="846" y="554" text-anchor="end" fill="#ffffff" fill-opacity="0.35" font-family="monospace" font-size="12">GENERATED FROM SOURCE AUDIO</text>
</svg>\n`;
}

function conceptGraphic() {
  return `
  <circle cx="234" cy="342" r="72" fill="#25303d" stroke="#d2aa62" stroke-opacity="0.65" stroke-width="2"/>
  <circle cx="450" cy="342" r="50" fill="#1d2631" stroke="#8da0b7" stroke-opacity="0.7"/>
  <circle cx="666" cy="342" r="72" fill="#25303d" stroke="#d2aa62" stroke-opacity="0.65" stroke-width="2"/>
  <path d="M306 342h94M500 342h94" stroke="#d2aa62" stroke-opacity="0.55" stroke-width="2"/>
  <path d="M390 334l10 8-10 8M584 334l10 8-10 8" fill="none" stroke="#d2aa62" stroke-width="2"/>
  `;
}

function timelineGraphic() {
  return `
  <line x1="160" y1="350" x2="740" y2="350" stroke="#d2aa62" stroke-opacity="0.62" stroke-width="3"/>
  <circle cx="190" cy="350" r="18" fill="#d2aa62"/><circle cx="450" cy="350" r="18" fill="#8da0b7"/><circle cx="710" cy="350" r="18" fill="#d2aa62"/>
  <text x="190" y="397" text-anchor="middle" fill="#ffffff" fill-opacity="0.55" font-family="monospace" font-size="14">01</text>
  <text x="450" y="397" text-anchor="middle" fill="#ffffff" fill-opacity="0.55" font-family="monospace" font-size="14">02</text>
  <text x="710" y="397" text-anchor="middle" fill="#ffffff" fill-opacity="0.55" font-family="monospace" font-size="14">03</text>
  `;
}

function comparisonGraphic() {
  return `
  <rect x="105" y="278" width="290" height="145" rx="16" fill="#202a36" stroke="#8da0b7" stroke-opacity="0.42"/>
  <rect x="505" y="278" width="290" height="145" rx="16" fill="#2a251d" stroke="#d2aa62" stroke-opacity="0.58"/>
  <text x="250" y="355" text-anchor="middle" fill="#dfe5ec" font-family="monospace" font-size="20">A</text>
  <text x="650" y="355" text-anchor="middle" fill="#f0d9ab" font-family="monospace" font-size="20">B</text>
  <path d="M425 350h50" stroke="#ffffff" stroke-opacity="0.28" stroke-width="2"/>
  `;
}

function uiGraphic() {
  return `
  <rect x="126" y="270" width="648" height="170" rx="14" fill="#111720" stroke="#d2aa62" stroke-opacity="0.45"/>
  <rect x="126" y="270" width="648" height="34" rx="14" fill="#252c36"/>
  <circle cx="151" cy="287" r="5" fill="#d2aa62"/><circle cx="170" cy="287" r="5" fill="#8da0b7"/><circle cx="189" cy="287" r="5" fill="#ffffff" fill-opacity="0.32"/>
  <rect x="160" y="328" width="180" height="80" rx="10" fill="#202936"/>
  <rect x="360" y="328" width="180" height="80" rx="10" fill="#2a251d"/>
  <rect x="560" y="328" width="180" height="80" rx="10" fill="#202936"/>
  `;
}

function textLines(lines, x, y, size, lineHeight, fill, weight) {
  return lines.map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" fill="${fill}" font-family="'Noto Sans JP','Noto Sans CJK JP',sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`).join('\n  ');
}

function wrapJa(value, width, maxLines) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return [''];
  const chars = Array.from(text);
  const lines = [];
  for (let offset = 0; offset < chars.length && lines.length < maxLines; offset += width) {
    let line = chars.slice(offset, offset + width).join('');
    if (lines.length === maxLines - 1 && offset + width < chars.length) line = line.replace(/.$/, '…');
    lines.push(line);
  }
  return lines;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
