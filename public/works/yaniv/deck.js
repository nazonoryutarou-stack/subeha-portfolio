/* ヤニブ / 標準トランプ --------------------------------------------------
   読みやすさを優先し、一般的な ♠ ♥ ♦ ♣ / A〜K / JOKER 表記を使う。
   ------------------------------------------------------------------- */

const standardCardsCSS = document.createElement('link');
standardCardsCSS.rel = 'stylesheet';
standardCardsCSS.href = './cards-standard.css';
document.head.appendChild(standardCardsCSS);

export const SUIT_NAME = ['スペード', 'ハート', 'ダイヤ', 'クラブ'];
export const SUIT_YOMI = [
  'スペードが濃い。切るべきものを見極めろ。',
  'ハートが濃い。人との貸し借りに目を向けろ。',
  'ダイヤが濃い。金や物の出入りに目を置け。',
  'クラブが濃い。動いた分だけ状況が変わる。',
];
export const SUIT_RED = [false, true, true, false];

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const RANK_GLYPH = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function rankGlyph(r) { return RANK_GLYPH[r] || '?'; }
export function cardValue(c) { return c.j ? 0 : (c.r > 10 ? 10 : c.r); }
export function handValue(hand) { let v = 0; for (const c of hand) v += cardValue(c); return v; }
export function cardName(c) { if (c.j) return 'ジョーカー'; return SUIT_NAME[c.s] + 'の' + rankGlyph(c.r); }

export function faceHTML(c) {
  if (c.j) {
    return '<span class="fc__corner fc__corner--tl"><b>J</b><i>★</i></span>' +
      '<span class="fc__joker">JOKER</span>' +
      '<span class="fc__corner fc__corner--br"><b>J</b><i>★</i></span>' +
      '<span class="fc__pt">0</span>';
  }
  const r = rankGlyph(c.r);
  const s = SUIT_GLYPH[c.s];
  return '<span class="fc__corner fc__corner--tl"><b>' + r + '</b><i>' + s + '</i></span>' +
    '<span class="fc__pip">' + s + '</span>' +
    '<span class="fc__corner fc__corner--br"><b>' + r + '</b><i>' + s + '</i></span>' +
    '<span class="fc__pt">' + cardValue(c) + '</span>';
}

export function backHTML() {
  return '<span class="bk__pattern" aria-hidden="true"></span>';
}

export function makeDeck() {
  const d = []; let id = 0;
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ id: 'c' + (id++), r, s, j: false });
  d.push({ id: 'c' + (id++), r: 0, s: -1, j: true });
  d.push({ id: 'c' + (id++), r: 0, s: -1, j: true });
  return shuffle(d);
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[k]; a[k] = t;
  }
  return a;
}
