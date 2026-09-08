/* ヤニブ / 卓の進行 ------------------------------------------------------
   札はDOMノードを使い回してFLIPで動かす。描き直しではなく、移動として見せる。
   ------------------------------------------------------------------- */

import {
  makeDeck, shuffle, faceHTML, backHTML, cardValue, handValue,
  cardName, rankGlyph, SUIT_RED, SUIT_YOMI, SUIT_NAME,
} from './deck.js';
import {
  validGroup, arrangeGroup, pickupIdx, settle, halve,
  PENALTY, LIMIT, DEAL, PERSONAS,
  newMemory, noteGrab, noteDiscard, shouldCall, chooseDiscard, chooseDraw, adaptMimic,
} from './engine.js';

const NUM_YOMI = [
  '空。手の中に重さが無かった。背負う物の無い夜は、よく眠れる。',
  '一。始まりの数。切り出すなら、灰が温かいうちに。',
  '二。対の数。今夜の貸し借りは、二で返ってくる。',
  '三。動く数。物の置き場所を一つ変えると、流れも変わる。',
  '四。土台の数。崩れない物を、一つ持っている。',
  '五。岐路の数。右でも左でもいい。止まるな。',
  '六。整う数。欠けた所に、人が来る。',
  '七。視る数。今夜は、見間違いが少ない。',
  '八。巡る数。手放した物が、形を変えて戻る。',
  '九。終いの数。畳んでいい。畳んだ分だけ、空く。',
];
const ONI_YOMI = '鬼が手に残った。数に入らない者が、傍に居る。';
const NAMES = ['あなた', '客人・一', '客人・二', '客人・三'];
const SEAT_PERSONA = [null, '慎重', '博打', '模倣'];
const KJ = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
function kanji(n) { if (n <= 10) return KJ[n]; if (n < 20) return '十' + (n % 10 ? KJ[n % 10] : ''); return KJ[Math.floor(n / 10)] + '十' + (n % 10 ? KJ[n % 10] : ''); }
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let motionStopped = false;
try { motionStopped = sessionStorage.getItem('yaniv-motion') === 'off'; } catch (e) {}
const mediaReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const still = mediaReduced && motionStopped;
if (!still) document.documentElement.classList.add('force-motion');
if (mediaReduced) {
  const b = document.createElement('button'); b.className = 'stopmotion'; b.type = 'button'; b.textContent = motionStopped ? '■ 演出を戻す' : '■ 演出を止める';
  b.addEventListener('click', () => { try { sessionStorage.setItem('yaniv-motion', motionStopped ? 'on' : 'off'); } catch (e) {} location.reload(); });
  document.body.appendChild(b);
}
const DUR = still ? 0 : 1;

let actx = null; let soundOn = true;
try { soundOn = localStorage.getItem('yaniv-sound') !== 'off'; } catch (e) {}
function ac() { if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); } if (actx.state === 'suspended') actx.resume(); return actx; }
function tone(freq, dur, type, gain, slideTo) { if (!soundOn) return; const c = ac(); if (!c) return; const o = c.createOscillator(); const g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(gain || 0.08, c.currentTime + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02); }
function noise(dur, freq, q, gain) { if (!soundOn) return; const c = ac(); if (!c) return; const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = c.createBufferSource(); src.buffer = buf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q || 1; const g = c.createGain(); g.gain.value = gain || 0.16; src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(); }
const SFX = { tap: () => tone(1180, 0.04, 'sine', 0.045), place: () => { noise(0.09, 1500, 1.1, 0.13); tone(112, 0.1, 'sine', 0.075); }, draw: () => noise(0.14, 2400, 0.7, 0.075), deal: () => noise(0.06, 1900, 1.3, 0.07), call: () => { tone(196, 1.7, 'sine', 0.16); tone(197.6, 1.7, 'sine', 0.13); tone(392, 1.1, 'sine', 0.05); noise(0.5, 380, 0.5, 0.08); }, assaf: () => { tone(112, 0.95, 'sawtooth', 0.1); tone(233, 0.8, 'square', 0.045); }, win: () => { tone(392, 0.28, 'sine', 0.1); setTimeout(() => tone(523, 0.28, 'sine', 0.1), 130); setTimeout(() => tone(659, 0.6, 'sine', 0.1), 270); }, lose: () => { tone(196, 0.5, 'sine', 0.09, 130); } };
function buzz(ms) { try { if (soundOn && navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

let P = [], deck = [], grave = [], tableThrow = [], pendingThrow = null;
let cur = 0, phase = 'idle', sel = [], round = 0, starter = 0, oppN = 2, TH = 5;
let mem = null, dealToken = 0, revealAll = false, turnsInRound = 0;
const nodes = new Map();
function nodeFor(card) { let el = nodes.get(card.id); if (el) return el; el = document.createElement('button'); el.type = 'button'; el.className = 'card card--down'; el.dataset.id = card.id; el.disabled = true; const inn = document.createElement('span'); inn.className = 'card__in'; const fc = document.createElement('span'); fc.className = 'fc' + (!card.j && SUIT_RED[card.s] ? ' fc--red' : ''); fc.innerHTML = faceHTML(card); const bk = document.createElement('span'); bk.className = 'bk'; bk.innerHTML = backHTML(); inn.appendChild(fc); inn.appendChild(bk); el.appendChild(inn); nodes.set(card.id, el); return el; }
function dropNode(id) { const el = nodes.get(id); if (el && el.parentNode) el.parentNode.removeChild(el); nodes.delete(id); }
function layout(build) { const first = new Map(); nodes.forEach((el, id) => { if (el.isConnected) first.set(id, el.getBoundingClientRect()); }); const deckRect = $('deckcard').getBoundingClientRect(); build(); if (!DUR) return; nodes.forEach((el, id) => { if (!el.isConnected) return; const l = el.getBoundingClientRect(); if (!l.width) return; const f = first.get(id) || deckRect; const dx = f.left - l.left; const dy = f.top - l.top; const sc = f.width / l.width; if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6 && Math.abs(sc - 1) < 0.012) return; el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${sc})` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' }); }); }

function render() {
  layout(() => {
    $('roundlab').textContent = round ? '第' + kanji(round) + '局' : '';
    for (let i = 1; i < 4; i++) {
      const seat = $('seat' + i); if (i >= P.length) { seat.hidden = true; continue; } seat.hidden = false; const p = P[i];
      seat.className = 'seat' + (cur === i && !p.out && phase !== 'roundend' ? ' seat--turn' : '') + (p.out ? ' seat--out' : '');
      seat.querySelector('.seat__nm').innerHTML = '<b>' + esc(p.name) + '</b><i>' + esc((PERSONAS[p.persona] || {}).label || '') + '</i>';
      seat.querySelector('.seat__st').innerHTML = '<span>' + esc(p.st || '') + '</span><span class="seat__sc">' + (p.out ? '脱落' : '累計 ' + p.score) + '</span>';
      const row = seat.querySelector('.seat__row');
      p.hand.forEach((c) => { const el = nodeFor(c); el.classList.toggle('card--down', !revealAll); el.disabled = true; el.classList.remove('card--live', 'card--sel', 'card--pick'); el.setAttribute('aria-label', revealAll ? cardName(c) : '伏せ札'); row.appendChild(el); });
    }
    const throwEl = $('throw'); const live = phase === 'draw' ? pickupIdx(tableThrow) : []; throwEl.querySelectorAll('.throw__none').forEach((n) => n.remove());
    tableThrow.forEach((c, i) => { const el = nodeFor(c); el.classList.remove('card--down', 'card--sel'); const pick = live.indexOf(i) >= 0; el.classList.toggle('card--pick', pick); el.classList.toggle('card--live', pick); el.disabled = !pick; el.setAttribute('aria-label', cardName(c) + (pick ? '（取れる端の札）' : '')); el.onclick = pick ? () => humanDraw(c, i) : null; throwEl.appendChild(el); });
    if (!tableThrow.length) { const s = document.createElement('span'); s.className = 'throw__none'; s.textContent = '──'; throwEl.appendChild(s); }
    $('throwlab').textContent = phase === 'draw' ? '場の札　──　端の札だけ取れる' : '場の札'; $('throwlab').classList.toggle('table__lab--live', phase === 'draw');
    $('deckcnt').textContent = '山　' + deck.length; const dc = $('deckcard'); const dlive = phase === 'draw'; dc.classList.toggle('card--pick', dlive); dc.classList.toggle('card--live', dlive); dc.disabled = !dlive;
    const stack = $('deckstack'); const layers = Math.max(0, Math.min(4, Math.round(deck.length / 12))); if (stack.childElementCount !== layers) { stack.innerHTML = ''; for (let k = layers; k > 0; k--) { const i2 = document.createElement('i'); i2.style.transform = 'translate(' + (k * 1.5) + 'px,' + (k * 1.5) + 'px)'; stack.appendChild(i2); } }
    const handEl = $('hand');
    P[0].hand.forEach((c, i) => { const el = nodeFor(c); el.classList.remove('card--down', 'card--pick'); const on = sel.indexOf(i) >= 0; el.classList.toggle('card--sel', on); const canTap = phase === 'discard'; el.classList.toggle('card--live', canTap); el.disabled = !canTap; el.style.transform = ''; el.setAttribute('aria-label', cardName(c) + '　' + cardValue(c) + '点' + (on ? '（選択中）' : '')); el.setAttribute('aria-pressed', on ? 'true' : 'false'); el.onclick = canTap ? () => tapCard(i) : null; handEl.appendChild(el); });
    const tv = handValue(P[0].hand); $('total').innerHTML = '合計 <b>' + tv + '</b>'; $('total').classList.toggle('me__tot--low', tv <= TH); $('mysc').textContent = P[0].out ? '脱落' : '累計 ' + P[0].score; $('discardBtn').disabled = !(phase === 'discard' && validGroup(selCards())); $('callBtn').disabled = !(phase === 'discard' && tv <= TH); $('callBtn').textContent = 'ヤニブ（' + TH + '以下）';
  });
}
function say(t) { $('say').textContent = t; }
let LOGS = [];
function log(t) { LOGS.push(t); if (LOGS.length > 3) LOGS.shift(); $('log').innerHTML = LOGS.join('<br>'); }
function logClear() { LOGS = []; $('log').innerHTML = ''; }
function newGame() { P = [{ name: NAMES[0], cpu: false, score: 0, out: false, hand: [], st: '' }]; for (let i = 1; i <= oppN; i++) P.push({ name: NAMES[i], cpu: true, persona: SEAT_PERSONA[i], score: 0, out: false, hand: [], st: '' }); starter = Math.floor(Math.random() * P.length); round = 0; nodes.forEach((el) => { if (el.parentNode) el.parentNode.removeChild(el); }); nodes.clear(); newRound(); }
async function newRound() { round++; const token = ++dealToken; revealAll = false; deck = makeDeck(); grave = []; tableThrow = []; pendingThrow = null; sel = []; mem = newMemory(P.length); turnsInRound = 0; for (const p of P) { p.hand = []; p.st = ''; } nodes.forEach((el, id) => dropNode(id)); $('resultOv').classList.remove('ov--on'); logClear(); log('第' + kanji(round) + '局、開始'); phase = 'deal'; say('配っている…'); render(); for (let d = 0; d < DEAL; d++) for (let p = 0; p < P.length; p++) { if (dealToken !== token) return; if (P[p].out) continue; P[p].hand.push(deck.pop()); SFX.deal(); render(); await sleep(still ? 0 : 62); } tableThrow = [deck.pop()]; SFX.place(); cur = starter; while (P[cur].out) cur = (cur + 1) % P.length; render(); await sleep(still ? 0 : 240); if (dealToken !== token) return; startTurn(); }
function startTurn() { if (phase === 'roundend' || phase === 'gameend') return; if (P[cur].cpu) { phase = 'cpu'; P[cur].st = '考えている…'; say(P[cur].name + 'の番'); render(); setTimeout(cpuTurn, still ? 60 : 780); } else { phase = 'discard'; const tv = handValue(P[0].hand); say(tv <= TH ? 'あなたの番。捨てるか──宣言するか。' : 'あなたの番。札を選んで捨てろ。'); render(); } }
function nextTurn() { if (phase === 'roundend' || phase === 'gameend') return; cur = (cur + 1) % P.length; while (P[cur].out) cur = (cur + 1) % P.length; startTurn(); }
function drawDeck() { if (deck.length === 0) { if (grave.length === 0) return tableThrow.length > 1 ? tableThrow.pop() : null; deck = shuffle(grave); grave = []; log('<b>捨て札を切り直した</b>'); } return deck.pop(); }
function tapCard(i) { if (phase !== 'discard') return; const at = sel.indexOf(i); if (at >= 0) sel.splice(at, 1); else sel.push(i); SFX.tap(); render(); }
function selCards() { return sel.map((i) => P[0].hand[i]); }
function doDiscard() { if (phase !== 'discard') return; const g = selCards(); if (!validGroup(g)) return; const idx = sel.slice().sort((a, b) => b - a); for (const i of idx) P[0].hand.splice(i, 1); sel = []; pendingThrow = g; noteDiscard(mem, 0, g); phase = 'draw'; SFX.place(); buzz(12); say('山か、端の札か。一枚引け。'); render(); }
function humanDraw(card, fromIdx) { if (phase !== 'draw') return; let c = card; if (fromIdx >= 0) { tableThrow.splice(fromIdx, 1); log('あなた　<b>' + esc(cardName(c)) + '</b> を場から取った'); noteGrab(mem, 0, c); SFX.draw(); } else { c = drawDeck(); if (!c) log('<b>札が尽きた</b>'); log('あなた　山から引いた'); SFX.draw(); } if (c) P[0].hand.push(c); for (const x of tableThrow) grave.push(x); for (const x of tableThrow) dropNode(x.id); tableThrow = arrangeGroup(pendingThrow); pendingThrow = null; phase = 'wait'; buzz(8); render(); setTimeout(nextTurn, still ? 40 : 420); }
function cpuTurn() { if (phase === 'roundend' || phase === 'gameend') return; const p = P[cur]; adaptMimic(mem, P, TH); turnsInRound++; let liveN = 0; for (const q of P) if (!q.out) liveN++; const pressure = turnsInRound / (liveN * 9); if (shouldCall(mem, P, cur, TH, pressure)) { p.st = ''; endRound(cur); return; } const g = chooseDiscard(mem, P, cur, TH); for (const c of g) { const ix = p.hand.indexOf(c); if (ix >= 0) p.hand.splice(ix, 1); } pendingThrow = g; noteDiscard(mem, cur, g); const pick = chooseDraw(mem, P, cur, tableThrow, p.hand); if (pick) { tableThrow.splice(pick.idx, 1); p.hand.push(pick.card); noteGrab(mem, cur, pick.card); p.st = cardName(pick.card) + ' を取った'; log(esc(p.name) + '　<b>' + esc(cardName(pick.card)) + '</b> を場から取った'); } else { const c = drawDeck(); if (c) p.hand.push(c); p.st = '山から引いた'; log(esc(p.name) + '　山から引いた'); } SFX.place(); for (const x of tableThrow) grave.push(x); for (const x of tableThrow) dropNode(x.id); tableThrow = arrangeGroup(pendingThrow); pendingThrow = null; render(); setTimeout(nextTurn, still ? 40 : 700); }
function strike(word, isAssaf) { return new Promise((res) => { const el = $('strike'); $('strikeWord').textContent = word; el.className = 'strike strike--on' + (isAssaf ? ' strike--assaf' : ''); setTimeout(() => { el.className = 'strike'; res(); }, still ? 40 : 1500); }); }
async function endRound(caller) { phase = 'roundend'; sel = []; const alive = []; for (let i = 0; i < P.length; i++) if (!P[i].out) alive.push(i); const totals = []; let cpos = 0; for (let i = 0; i < alive.length; i++) { totals.push(handValue(P[alive[i]].hand)); if (alive[i] === caller) cpos = i; } const res = settle(totals, cpos); if (caller === 0) { mem.humanCalls++; mem.humanCallLow += totals[cpos]; } SFX.call(); buzz([18,60,18]); await strike('ヤニブ', false); revealAll = true; render(); await sleep(still ? 0 : 900); if (res.assaf) { SFX.assaf(); buzz([30,40,90]); await strike('アサフ', true); } const notes = []; for (let i = 0; i < alive.length; i++) { const pi = alive[i]; P[pi].score += res.add[i]; let nt = ''; const h = halve(P[pi].score); if (h !== P[pi].score) { nt = '丁度' + P[pi].score + '──' + h + 'に折れた'; P[pi].score = h; } if (P[pi].score > LIMIT) { P[pi].out = true; nt += (nt ? '　' : '') + '卓を立つ'; } notes.push(nt); } starter = alive[res.winner]; $('resTitle').textContent = '第' + kanji(round) + '局　勝負'; $('resSub').textContent = 'ROUND ' + round; $('callline').innerHTML = '<span class="bl">「ヤニブ」</span>　' + esc(P[caller].name) + '（合計 ' + totals[cpos] + '）'; $('assline').textContent = res.assaf ? '「アサフ」── ' + P[alive[res.winner]].name + '　宣言は破れた（罰 ＋' + PENALTY + '）' : '宣言は通った'; let rows = ''; for (let i = 0; i < alive.length; i++) { const q = alive[i]; rows += '<div class="rrow"><div class="rrow__top"><span class="rrow__nm">' + esc(P[q].name) + '</span>' + (i === res.winner ? '<span class="tag tag--win">勝ち</span>' : '') + (P[q].out ? '<span class="tag tag--out">脱落</span>' : '') + '<span class="rrow__pts">手札 ' + totals[i] + '　＋' + res.add[i] + '　累計 <b>' + P[q].score + '</b></span></div><div class="rrow__cards">' + P[q].hand.map(staticCard).join('') + '</div>' + (notes[i] ? '<div class="rrow__note">' + notes[i] + '</div>' : '') + '</div>'; } $('resRows').innerHTML = rows; let aliveNow = 0, lastAlive = -1; for (let i = 0; i < P.length; i++) if (!P[i].out) { aliveNow++; lastAlive = i; } const over = P[0].out || aliveNow <= 1; $('nextBtn').textContent = over ? '終局を見る' : '次の局へ'; $('nextBtn').onclick = over ? () => showEnd(aliveNow === 1 ? lastAlive : -1) : () => newRound(); render(); $('resultOv').classList.add('ov--on'); $('nextBtn').focus(); }
function staticCard(c) { const red = !c.j && SUIT_RED[c.s] ? ' fc--red' : ''; return '<span class="card" role="img" aria-label="' + esc(cardName(c)) + '"><span class="card__in"><span class="fc' + red + '">' + faceHTML(c) + '</span></span></span>'; }
function digiroot(t) { if (t <= 0) return 0; while (t > 9) { let s = 0; while (t > 0) { s += t % 10; t = Math.floor(t / 10); } t = s; } return t; }
function uranaiHTML(hand) { let t = 0, jk = 0; const sc = [0,0,0,0]; for (const c of hand) { if (c.j) { jk++; continue; } t += c.r; sc[c.s]++; } const root = digiroot(t); let top = -1, tv = 0; for (let i = 0; i < 4; i++) if (sc[i] > tv) { tv = sc[i]; top = i; } let h = '<div class="ura"><div class="ura__k">手仕舞いの読み　──　最後に持っていた札</div><div class="ura__cards">'; for (const c of hand) h += staticCard(c); h += '</div><div class="ura__k">数 ' + t + '　→　根 ' + root + '</div><div class="ura__line">' + NUM_YOMI[root] + '</div>'; if (top >= 0 && tv >= 2) h += '<div class="ura__line">' + SUIT_YOMI[top] + '</div>'; if (jk > 0) h += '<div class="ura__line">' + ONI_YOMI + '</div>'; h += '<div class="ura__foot">本占いは創作である。明日の予定は、いつも通りでいい。</div></div>'; window.__yanivShare = '【ヤニブ／手仕舞いの読み】\n数 ' + t + '　根 ' + root + '\n' + NUM_YOMI[root] + (top >= 0 && tv >= 2 ? '\n' + SUIT_YOMI[top] : '') + (jk > 0 ? '\n' + ONI_YOMI : ''); return h; }
function tally(win) { let d = { games: 0, wins: 0 }; try { d = JSON.parse(localStorage.getItem('yaniv-tally') || '{}'); } catch (e) {} d.games = (d.games || 0) + 1; d.wins = (d.wins || 0) + (win ? 1 : 0); try { localStorage.setItem('yaniv-tally', JSON.stringify(d)); } catch (e) {} return d; }
function showEnd(winnerIdx) { phase = 'gameend'; $('resultOv').classList.remove('ov--on'); const win = winnerIdx >= 0 ? P[winnerIdx] : null; const youWin = !!win && !win.cpu; youWin ? SFX.win() : SFX.lose(); $('endTitle').textContent = youWin ? '勝ち' : '負け'; $('endSub').textContent = youWin ? '卓に残ったのは、あなただ' : 'あなたは卓を立った'; const ord = P.map((_, i) => i).sort((a, b) => P[a].score - P[b].score); let rows = ''; for (const q of ord) rows += '<div class="rrow"><div class="rrow__top"><span class="rrow__nm">' + esc(P[q].name) + '</span>' + (winnerIdx === q ? '<span class="tag tag--win">勝者</span>' : '') + (P[q].out ? '<span class="tag tag--out">脱落</span>' : '') + '<span class="rrow__pts">累計 <b>' + P[q].score + '</b></span></div></div>'; $('endRows').innerHTML = rows; $('endUra').innerHTML = uranaiHTML(P[0].hand); const d = tally(youWin); $('endTally').innerHTML = '卓を囲んだ回数 <b>' + d.games + '</b>　　勝ち <b>' + d.wins + '</b>'; $('endOv').classList.add('ov--on'); $('againBtn').focus(); }
$('discardBtn').addEventListener('click', doDiscard);
$('callBtn').addEventListener('click', () => { if (phase !== 'discard') return; if (handValue(P[0].hand) > TH) return; endRound(0); });
$('deckcard').addEventListener('click', () => { if (phase === 'draw') humanDraw(null, -1); });
function segInit(id, setter) { const seg = $(id); const bs = seg.querySelectorAll('button'); bs.forEach((b) => { b.addEventListener('click', () => { bs.forEach((k) => k.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); setter(parseInt(b.dataset.v, 10)); SFX.tap(); }); }); }
segInit('oppSeg', (v) => { oppN = v; }); segInit('thSeg', (v) => { TH = v; });
$('goBtn').addEventListener('click', () => { ac(); $('startOv').classList.remove('ov--on'); newGame(); });
$('againBtn').addEventListener('click', () => { $('endOv').classList.remove('ov--on'); $('startOv').classList.add('ov--on'); });
$('rulesBtn').addEventListener('click', () => $('rulesOv').classList.add('ov--on')); $('rulesBtn2').addEventListener('click', () => $('rulesOv').classList.add('ov--on')); $('rulesClose').addEventListener('click', () => $('rulesOv').classList.remove('ov--on'));
$('soundBtn').addEventListener('click', () => { soundOn = !soundOn; try { localStorage.setItem('yaniv-sound', soundOn ? 'on' : 'off'); } catch (e) {} $('soundBtn').setAttribute('aria-pressed', soundOn ? 'true' : 'false'); $('soundBtn').textContent = soundOn ? '音 入' : '音 切'; if (soundOn) { ac(); SFX.tap(); } });
$('soundBtn').setAttribute('aria-pressed', soundOn ? 'true' : 'false'); $('soundBtn').textContent = soundOn ? '音 入' : '音 切';
$('shareBtn').addEventListener('click', async () => { const t = (window.__yanivShare || '') + '\n\nヤニブ｜すべての歯が見える\n' + location.href.split('#')[0]; try { await navigator.clipboard.writeText(t); $('shareBtn').textContent = '写した'; setTimeout(() => { $('shareBtn').textContent = '読みを写す'; }, 1800); } catch (e) { $('shareBtn').textContent = '写せなかった'; } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.ov--on').forEach((o) => { if (o.id === 'rulesOv') o.classList.remove('ov--on'); }); });
window.addEventListener('resize', () => { if (phase !== 'idle') render(); });
say('席に着け。');
