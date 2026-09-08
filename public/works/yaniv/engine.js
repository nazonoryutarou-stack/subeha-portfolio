/* ヤニブ / 規則と思考 ----------------------------------------------------
   規則判定は純関数。客人（CPU）は「場から何が取られたか」を憶えていて、
   その記憶から相手の手を見積もる。席ごとに癖が違う。
   ------------------------------------------------------------------- */

import { cardValue, handValue } from './deck.js';

export const PENALTY = 30;
export const LIMIT = 100;
export const DEAL = 5;

export function validGroup(g) {
  if (!g || g.length === 0) return false;
  if (g.length === 1) return true;
  const nj = []; let jk = 0;
  for (const c of g) { if (c.j) jk++; else nj.push(c); }
  if (nj.length === 0) return g.length >= 2;
  let same = true;
  for (let i = 1; i < nj.length; i++) if (nj[i].r !== nj[0].r) same = false;
  if (same && jk === 0 && g.length >= 2) return true;
  if (g.length < 3) return false;
  for (let i = 1; i < nj.length; i++) if (nj[i].s !== nj[0].s) return false;
  const rs = nj.map((c) => c.r).sort((a, b) => a - b);
  for (let i = 1; i < rs.length; i++) if (rs[i] === rs[i - 1]) return false;
  const span = rs[rs.length - 1] - rs[0] + 1;
  const gaps = span - rs.length;
  if (jk < gaps) return false;
  const extra = jk - gaps;
  const room = (rs[0] - 1) + (13 - rs[rs.length - 1]);
  return extra <= room;
}

export function arrangeGroup(g) {
  const nj = []; const jks = [];
  for (const c of g) { if (c.j) jks.push(c); else nj.push(c); }
  if (nj.length === 0 || g.length === 1) return g.slice();
  let same = true;
  for (let i = 1; i < nj.length; i++) if (nj[i].r !== nj[0].r) same = false;
  if (same && jks.length === 0) return g.slice();
  if (g.length < 3) return g.slice();
  nj.sort((a, b) => a.r - b.r);
  const out = []; let ji = 0;
  for (let i = 0; i < nj.length; i++) {
    if (i > 0) { const gap = nj[i].r - nj[i - 1].r - 1; for (let k = 0; k < gap && ji < jks.length; k++) out.push(jks[ji++]); }
    out.push(nj[i]);
  }
  let hi = nj[nj.length - 1].r;
  while (ji < jks.length) { if (hi < 13) { out.push(jks[ji++]); hi++; } else out.unshift(jks[ji++]); }
  return out;
}

export function allGroups(hand) {
  const out = []; const n = hand.length;
  for (let m = 1; m < (1 << n); m++) { const g = []; for (let i = 0; i < n; i++) if (m & (1 << i)) g.push(hand[i]); if (validGroup(g)) out.push(g); }
  return out;
}
export function pickupIdx(tableThrow) { if (tableThrow.length === 0) return []; if (tableThrow.length === 1) return [0]; return [0, tableThrow.length - 1]; }
export function settle(totals, caller) {
  const n = totals.length; let winner = caller; let assaf = false;
  for (let k = 1; k < n; k++) { const i = (caller + k) % n; if (totals[i] <= totals[caller] && (winner === caller || totals[i] < totals[winner])) { winner = i; assaf = true; } }
  const add = [];
  for (let j = 0; j < n; j++) { if (j === winner) add.push(0); else if (j === caller && assaf) add.push(totals[j] + PENALTY); else add.push(totals[j]); }
  return { add, winner, assaf };
}
export function halve(s) { if (s === 50) return 25; if (s === 100) return 50; return s; }

export const PERSONAS = {
  慎重: { label: '慎重', tell: '手を締めてくる', callSlack: 0, grabMax: 2, riskTolerance: 0.16 },
  博打: { label: '博打', tell: '線ぎりぎりで来る', callSlack: 2, grabMax: 4, riskTolerance: 0.52 },
  模倣: { label: '模倣', tell: 'こちらの手を写す', callSlack: 1, grabMax: 3, riskTolerance: 0.3 },
};

export function newMemory(playerCount) { const seen = []; for (let i = 0; i < playerCount; i++) seen.push([]); return { seen, discarded: [], humanCallLow: 0, humanCalls: 0 }; }
export function noteGrab(mem, player, card) { mem.seen[player].push(card); }
export function noteDiscard(mem, player, group) { for (const c of group) { mem.discarded.push(c); const arr = mem.seen[player]; const at = arr.findIndex((x) => x.id === c.id); if (at >= 0) arr.splice(at, 1); } }
export function estimateHand(mem, player, handSize) {
  const known = mem.seen[player].slice(0, handSize); let v = 0; for (const c of known) v += cardValue(c);
  const unknown = Math.max(0, handSize - known.length); let avg = 6.1;
  if (mem.discarded.length > 6) { let d = 0; for (const c of mem.discarded) d += cardValue(c); avg = Math.max(3.2, 6.1 - (d / mem.discarded.length - 6.1) * 0.45); }
  return v + unknown * avg;
}
export function assafRisk(mem, players, me, myTotal) {
  let worst = 0;
  for (let i = 0; i < players.length; i++) { if (i === me || players[i].out) continue; const est = estimateHand(mem, i, players[i].hand.length); const gap = est - myTotal; let p = 1 / (1 + Math.exp(gap * 0.34)); if (players[i].hand.length <= 2) p = Math.min(0.92, p + 0.22); worst = 1 - (1 - worst) * (1 - p); }
  return worst;
}
export function shouldCall(mem, players, me, threshold, pressure) {
  const p = players[me]; const total = handValue(p.hand); if (total > threshold) return false; if (total === 0) return true;
  const q = Math.max(0, Math.min(1, pressure || 0));
  if (p.persona === '模倣' && typeof p.mimicLine === 'number' && q < 0.5 && total > p.mimicLine + 1) return false;
  if (q >= 1) return true;
  const persona = PERSONAS[p.persona] || PERSONAS['慎重']; const risk = assafRisk(mem, players, me, total); const margin = (threshold - total) * 0.09 + persona.riskTolerance + q * 0.62;
  return risk <= margin;
}
export function chooseDiscard(mem, players, me, threshold) {
  const hand = players[me].hand; if (!hand.length) return []; const th = typeof threshold === 'number' ? threshold : 5; const groups = allGroups(hand); let best = null; let bestScore = -Infinity;
  for (const g of groups) {
    const rest = hand.filter((c) => !g.includes(c)); const restTotal = handValue(rest); let shape = 0;
    for (let i = 0; i < rest.length; i++) for (let k = i + 1; k < rest.length; k++) { if (rest[i].j || rest[k].j) { shape += 1.6; continue; } if (rest[i].r === rest[k].r) shape += 2.4; else if (rest[i].s === rest[k].s && Math.abs(rest[i].r - rest[k].r) <= 2) shape += 1.5; }
    const shapeW = restTotal > th + 4 ? 0.9 : 0.14; let drag = 0; for (const c of rest) if (cardValue(c) > 7) drag += 0.35;
    const score = -restTotal * 1.6 + shape * shapeW + g.length * 0.35 - drag; if (score > bestScore) { bestScore = score; best = g; }
  }
  return best || [hand[0]];
}
export function chooseDraw(mem, players, me, tableThrow, restHand) {
  const persona = PERSONAS[players[me].persona] || PERSONAS['慎重']; const ops = pickupIdx(tableThrow); let take = null, ti = -1, bestScore = 0;
  for (const idx of ops) { const c = tableThrow[idx]; const v = cardValue(c); let score = 0; if (v <= persona.grabMax) score += (persona.grabMax + 1 - v) * 0.9; if (c.j) score += 5; for (const h of restHand) { if (h.j || c.j) continue; if (h.r === c.r) score += 3.2; else if (h.s === c.s && Math.abs(h.r - c.r) <= 2) score += 1.8; } score -= v * 0.25; score -= 0.6; if (score > bestScore) { bestScore = score; take = c; ti = idx; } }
  return ti >= 0 ? { card: take, idx: ti } : null;
}
export function adaptMimic(mem, players, threshold) { if (mem.humanCalls < 2) return; const avg = mem.humanCallLow / mem.humanCalls; for (const p of players) { if (p.persona !== '模倣') continue; p.mimicLine = Math.max(0, Math.min(threshold, Math.round(avg))); } }
