const DEFAULTS = {
  gapBreakMs: 650,
  softGapBreakMs: 320,
  minCharsForSoftGap: 9,
  maxDurationMs: 3600,
  maxChars: 26,
};

const openingBrackets = new Set(['(', '（', '[', '［']);
const closingBrackets = new Set([')', '）', ']', '］']);
const standaloneMarkers = new Set(['音楽', '拍手', '笑い', '歓声', 'BGM', 'bgm']);
const sentenceEnd = /[。！？!?…]$/u;

export function aggregateTimedCaptions(input, options = {}) {
  const config = {...DEFAULTS, ...options};
  const normalized = (Array.isArray(input) ? input : [])
    .map((caption) => ({
      text: String(caption?.text || '').trim(),
      startMs: Math.max(0, Math.round(Number(caption?.startMs))),
      endMs: Math.max(0, Math.round(Number(caption?.endMs))),
      timestampMs: Math.max(0, Math.round(Number(caption?.timestampMs ?? caption?.startMs))),
      confidence: caption?.confidence == null ? null : Number(caption.confidence),
    }))
    .filter((caption) => caption.text && Number.isFinite(caption.startMs) && Number.isFinite(caption.endMs) && caption.endMs > caption.startMs)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const prepared = collapseBracketedMarkers(normalized);
  const output = [];
  let current = null;

  const flush = () => {
    if (!current) return;
    current.text = current.text.trim();
    if (current.text) output.push(current);
    current = null;
  };

  for (const token of prepared) {
    if (token.marker === true) {
      flush();
      output.push(stripInternal(token));
      continue;
    }

    if (!current) {
      current = stripInternal(token);
      continue;
    }

    const gap = Math.max(0, token.startMs - current.endMs);
    const durationIfJoined = token.endMs - current.startMs;
    const charsIfJoined = visibleLength(current.text) + visibleLength(token.text);
    const hardGap = gap >= config.gapBreakMs;
    const softGap = gap >= config.softGapBreakMs && visibleLength(current.text) >= config.minCharsForSoftGap;
    const tooLong = durationIfJoined > config.maxDurationMs && visibleLength(current.text) >= 6;
    const tooWide = charsIfJoined > config.maxChars && visibleLength(current.text) >= 8;

    if (hardGap || softGap || tooLong || tooWide) {
      flush();
      current = stripInternal(token);
      continue;
    }

    current.text = joinTokenText(current.text, token.text);
    current.endMs = Math.max(current.endMs, token.endMs);
    current.timestampMs = current.startMs;
    current.confidence = combineConfidence(current.confidence, token.confidence);

    if (sentenceEnd.test(current.text)) flush();
  }

  flush();
  return output;
}

function collapseBracketedMarkers(tokens) {
  const out = [];
  for (let index = 0; index < tokens.length; index++) {
    const first = tokens[index];
    if (!openingBrackets.has(first.text)) {
      out.push(first);
      continue;
    }

    let inner = '';
    let closeIndex = -1;
    for (let cursor = index + 1; cursor < Math.min(tokens.length, index + 7); cursor++) {
      const item = tokens[cursor];
      if (closingBrackets.has(item.text)) {
        closeIndex = cursor;
        break;
      }
      inner += item.text;
    }

    if (closeIndex > index + 1 && standaloneMarkers.has(inner)) {
      const last = tokens[closeIndex];
      const pieces = tokens.slice(index, closeIndex + 1);
      out.push({
        text: `（${inner.toUpperCase() === 'BGM' ? 'BGM' : inner}）`,
        startMs: first.startMs,
        endMs: last.endMs,
        timestampMs: first.startMs,
        confidence: averageConfidence(pieces),
        marker: true,
      });
      index = closeIndex;
      continue;
    }

    out.push(first);
  }
  return out;
}

function joinTokenText(left, right) {
  if (!left) return right;
  if (!right) return left;
  const latinBoundary = /[A-Za-z]$/u.test(left) && /^[A-Za-z]/u.test(right);
  return `${left}${latinBoundary ? ' ' : ''}${right}`;
}

function stripInternal(item) {
  return {
    text: item.text,
    startMs: item.startMs,
    endMs: item.endMs,
    timestampMs: item.startMs,
    confidence: item.confidence ?? null,
  };
}

function visibleLength(text) {
  return Array.from(String(text || '').replace(/\s+/gu, '')).length;
}

function combineConfidence(a, b) {
  if (!Number.isFinite(a)) return Number.isFinite(b) ? b : null;
  if (!Number.isFinite(b)) return a;
  return Math.min(a, b);
}

function averageConfidence(items) {
  const values = items.map((item) => item.confidence).filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
