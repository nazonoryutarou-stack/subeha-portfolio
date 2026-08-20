/* ヤニブ / 札の意匠 ------------------------------------------------------
   トランプではなく「剣・杯・珠・杖」の四印で組んだ自前の札。
   すべてSVGで描くので、どの解像度でも劣化しない。
   ------------------------------------------------------------------- */

export const SUIT_NAME = ['剣', '杯', '珠', '杖'];
export const SUIT_YOMI = [
  '剣の印が濃い。切るべき縁の話だ。',
  '杯の印が濃い。注がれる側の番だ。',
  '珠の印が濃い。銭の出入りに目を置け。',
  '杖の印が濃い。歩いた距離が、答えになる。',
];
/* 朱で刷る印。杯と珠。 */
export const SUIT_RED = [false, true, true, false];

const RANK_GLYPH = ['鬼', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '従', '巫', '主'];

export function rankGlyph(r) { return RANK_GLYPH[r] || '?'; }
export function cardValue(c) { return c.j ? 0 : (c.r > 10 ? 10 : c.r); }
export function handValue(hand) { let v = 0; for (const c of hand) v += cardValue(c); return v; }
export function cardName(c) { if (c.j) return '鬼札'; return SUIT_NAME[c.s] + 'の' + rankGlyph(c.r); }

const SIGIL = [
  '<path d="M12 .9 14.9 6.6V14.1H9.1V6.6Z"/><path d="M6.2 14.1h11.6v2.2H6.2z"/><path d="M10.6 16.3h2.8v4.3h-2.8z"/><path d="M9.2 20.6h5.6v2.4H9.2z"/>',
  '<path d="M4.6 2.6h14.8c0 7.6-2.9 11.8-7.4 12.6C7.5 14.4 4.6 10.2 4.6 2.6Z"/><path d="M10.6 14.8h2.8v4.8h-2.8z"/><path d="M6.4 19.6h11.2v2.8H6.4z"/>',
  '<path fill-rule="evenodd" d="M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8Zm0 6.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z"/>',
  '<g transform="rotate(19 12 12)"><circle cx="12" cy="2.6" r="2.7"/><path d="M10.5 4.4h3v18.6h-3z"/><path d="M7.9 7.6h8.2v2.1H7.9z"/><path d="M7.9 15.2h8.2v2.1H7.9z"/></g>',
];
const ONI_SIGIL = '<path fill-rule="evenodd" d="M12 1.6 14.7 5.6 17.5 2.9 17.9 8C19.7 9.4 20.7 11.5 20.7 13.8 20.7 18.4 16.8 22 12 22S3.3 18.4 3.3 13.8C3.3 11.5 4.3 9.4 6.1 8L6.5 2.9 9.3 5.6ZM8.4 11.6 11.4 13.4 8.4 15.2ZM15.6 11.6 12.6 13.4 15.6 15.2ZM7.7 17.2H16.3L14.8 19.4H9.2Z"/>';
function svg(inner, cls) { return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + '</svg>'; }
export function faceHTML(c) { if (c.j) return '<span class="fc__rk">鬼</span>' + svg(ONI_SIGIL, 'fc__sig') + '<span class="fc__pt">0</span>'; return '<span class="fc__rk">' + rankGlyph(c.r) + '</span>' + svg(SIGIL[c.s], 'fc__sig') + '<span class="fc__pt">' + cardValue(c) + '</span>'; }
export function backHTML() { return '<span class="bk__mark">視</span><span class="bk__ring" aria-hidden="true"></span>'; }
export function makeDeck() { const d = []; let id = 0; for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ id: 'c' + (id++), r, s, j: false }); d.push({ id: 'c' + (id++), r: 0, s: -1, j: true }); d.push({ id: 'c' + (id++), r: 0, s: -1, j: true }); return shuffle(d); }
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[k]; a[k] = t; } return a; }
