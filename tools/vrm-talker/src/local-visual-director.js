const MAX_CUES = 8;
const MIN_GAP_MS = 10_000;

const FILLER_RE = /^(?:[うえおあんー〜]+|はい|うん|ええ|まあ|そう|なるほど|たしかに|確かに|ありがとうございます?|ありがとう|よろしく(?:お願いします)?|へえ|ほう|ふーん)[。！？!?、,.\s]*$/i;
const ABSTRACT_RE = /(想像|イメージ|雰囲気|世界観|架空|もし|夢|未来|概念|気持ち|感情|エネルギー|霊|魂|呪い|魔法|異世界|比喩|象徴|抽象|幻想|不思議|奇妙|恐怖|怖い|宇宙|ブラックホール|神|天使|妖怪|幽霊)/;
const REAL_CLUE_RE = /(写真|画像|映像|新聞|雑誌|本|書籍|カード|ポスター|地図|駅|神社|寺|学校|大学|会社|企業|商品|建物|美術館|博物館|映画|アニメ|ゲーム|人物|俳優|作家|画家|政治家|東京|大阪|京都|熊本|日本|アメリカ|中国|韓国|ヨーロッパ|昭和|平成|令和|明治|大正|\d{4}年|[A-Z][A-Za-z0-9_-]{2,}|[ァ-ヴー]{3,})/;

const normalizeText = (value) => String(value || '')
  .replace(/\[非本人発話\]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const searchQueryFrom = (text) => normalizeText(text)
  .replace(/[「」『』“”"'()（）【】]/g, ' ')
  .replace(/[。！？!?、,]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80);

const contentScore = (text) => {
  const clean = normalizeText(text);
  if (!clean || clean === '[非本人発話]' || FILLER_RE.test(clean)) return -100;
  let score = Math.min(5, clean.length / 12);
  if (REAL_CLUE_RE.test(clean)) score += 4;
  if (ABSTRACT_RE.test(clean)) score += 2;
  if (/\d/.test(clean)) score += 1;
  if (clean.length < 8) score -= 3;
  return score;
};

const modeFor = (text) => {
  const abstract = ABSTRACT_RE.test(text);
  const real = REAL_CLUE_RE.test(text);
  if (real) return 'search';
  if (abstract) return 'generate';
  return text.length >= 18 ? 'search' : null;
};

export const suggestLocalVisualCues = (captions, {maxCues = MAX_CUES, minGapMs = MIN_GAP_MS} = {}) => {
  const all = Array.isArray(captions) ? captions : [];
  const candidates = [];
  for (let index = 0; index < all.length; index++) {
    const caption = all[index] || {};
    const text = normalizeText(caption.text);
    if (!text || text === '[非本人発話]') continue;
    const startMs = Number(caption.startMs);
    const endMs = Number(caption.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    const mode = modeFor(text);
    const score = contentScore(text);
    if (!mode || score < 1.5) continue;
    candidates.push({index, text, startMs, endMs, mode, score});
  }

  candidates.sort((a, b) => b.score - a.score || a.startMs - b.startMs);
  const selected = [];
  for (const item of candidates) {
    if (selected.some((chosen) => Math.abs(chosen.startMs - item.startMs) < minGapMs)) continue;
    selected.push(item);
    if (selected.length >= Math.max(1, Math.min(12, Number(maxCues) || MAX_CUES))) break;
  }
  selected.sort((a, b) => a.startMs - b.startMs);

  return {
    model: 'local:heuristic-visual-director-v1',
    free: true,
    cues: selected.map((item) => ({
      id: crypto.randomUUID(),
      startIndex: item.index,
      endIndex: item.index,
      startMs: Math.round(item.startMs),
      endMs: Math.round(item.endMs),
      mode: item.mode,
      query: item.mode === 'search' ? searchQueryFrom(item.text) : null,
      prompt: item.mode === 'generate' ? item.text.slice(0, 180) : null,
      reason: item.mode === 'search'
        ? '固有名詞・実在資料らしい語を含むため、無料の参考画像検索候補。'
        : '抽象・架空・比喩表現を含むため、ローカル抽象ビジュアル候補。',
    })),
  };
};

const hashString = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const rngFrom = (seed) => {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
};

const wrapText = (ctx, text, maxWidth) => {
  const chars = [...text];
  const lines = [];
  let line = '';
  for (const char of chars) {
    const next = line + char;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = char;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6);
};

const canvasToDataUrl = async (canvas) => {
  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({type: 'image/png'});
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
    return `data:image/png;base64,${btoa(binary)}`;
  }
  return canvas.toDataURL('image/png');
};

export const generateLocalReferenceImage = async ({prompt, size = '1024x1024'} = {}) => {
  const text = normalizeText(prompt);
  if (!text) throw new Error('ローカル画像の元になる文章がありません。');
  const [rawW, rawH] = String(size).split('x').map(Number);
  const width = Number.isFinite(rawW) ? Math.max(512, Math.min(1536, rawW)) : 1024;
  const height = Number.isFinite(rawH) ? Math.max(512, Math.min(1536, rawH)) : 1024;
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), {width, height});
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvasを初期化できませんでした。');

  const seed = hashString(text);
  const random = rngFrom(seed);
  const hueA = Math.floor(random() * 360);
  const hueB = (hueA + 80 + Math.floor(random() * 160)) % 360;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${hueA} 32% 8%)`);
  gradient.addColorStop(1, `hsl(${hueB} 38% 18%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.32;
  for (let i = 0; i < 24; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = width * (0.02 + random() * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `hsl(${(hueA + i * 17) % 360} 65% ${35 + random() * 35}%)`;
    ctx.lineWidth = 1 + random() * 7;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const boxX = width * 0.08;
  const boxY = height * 0.62;
  const boxW = width * 0.84;
  const boxH = height * 0.28;
  ctx.fillStyle = 'rgba(0,0,0,.56)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  const fontSize = Math.round(width * 0.045);
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.94)';
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, text, boxW * 0.88);
  const lineHeight = fontSize * 1.35;
  lines.forEach((line, index) => ctx.fillText(line, boxX + boxW * 0.06, boxY + boxH * 0.13 + index * lineHeight));

  ctx.font = `600 ${Math.round(width * 0.018)}px ui-monospace, monospace`;
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillText('LOCAL ABSTRACT VISUAL / FREE', boxX + boxW * 0.06, height * 0.94);

  const dataUrl = await canvasToDataUrl(canvas);
  const b64 = dataUrl.split(',')[1] || '';
  return {
    model: 'local:procedural-canvas-v1',
    free: true,
    data: [{b64_json: b64, revised_prompt: null}],
  };
};
