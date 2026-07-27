"use strict";

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRA1AuFPfz23AiuyNHirTIn8pslZOn8UHyaFzB0SaBWewcErvPV6YIMBy_6tA6MyNTMLjEY11jwDL0w/pub?output=csv";
const sc = document.getElementById("scroller");
const ghostnoEl = document.getElementById("ghostno");
const loadingEl = document.getElementById("loading");
const queryEl = document.getElementById("q");
const filterEl = document.getElementById("filter");
let allRecords = [];
let viewRecords = [];
let sortNewest = true;
let shown = 0;
const BATCH = 8;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(current);
      current = "";
    } else if (char === "\n") {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else if (char !== "\r") {
      current += char;
    }
  }
  if (current !== "" || row.length) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function parseTime(value) {
  const match = String(value || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?)?/);
  if (!match) return Number.NaN;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0),
    Number(match[6] || 0)
  ).getTime();
}

function combineDigits(value) {
  const normalized = value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
  return normalized.replace(/\d+/g, (match) => {
    return match.length >= 2 && match.length <= 4 ? `<span class="tcy">${match}</span>` : match;
  });
}

function makePanel(record, index) {
  const section = document.createElement("section");
  section.className = "panel doc-panel";
  section.dataset.no = `No.${String(index + 1).padStart(4, "0")}`;
  section.innerHTML = `
    <div class="reveal doc on">
      <div class="kind">${escapeHtml(record.kind)}${record.date ? `　／　${escapeHtml(record.date)}` : ""}</div>
      <div class="doc-body">
        <div class="head">${combineDigits(escapeHtml(record.head))}</div>
        <div class="text">${escapeHtml(record.text)}</div>
      </div>
    </div>`;
  return section;
}

function makeMorePanel() {
  const section = document.createElement("section");
  section.className = "panel doc-panel more-panel";
  section.dataset.no = "続";
  const remaining = viewRecords.length - shown;
  section.innerHTML = `<div class="reveal doc on"><button class="morebtn" type="button">続きを読む　──　残り ${remaining} 件</button></div>`;
  section.querySelector("button").addEventListener("click", () => {
    section.remove();
    appendMore();
  });
  return section;
}

function clearDocs() {
  document.querySelectorAll(".doc-panel").forEach((panel) => panel.remove());
  shown = 0;
}

function appendMore() {
  const end = Math.min(shown + BATCH, viewRecords.length);
  for (let index = shown; index < end; index += 1) {
    const panel = makePanel(viewRecords[index], index);
    sc.appendChild(panel);
    observePanel(panel);
  }
  shown = end;
  if (shown < viewRecords.length) {
    const morePanel = makeMorePanel();
    sc.appendChild(morePanel);
    observePanel(morePanel);
  }
  onScrollHome();
}

function render() {
  clearDocs();
  appendMore();
}

function applyView() {
  const query = queryEl.value.trim();
  const kind = filterEl.value;
  viewRecords = allRecords.filter((record) => {
    if (kind && record.kind !== kind) return false;
    if (query && !`${record.head} ${record.text} ${record.kind}`.includes(query)) return false;
    return true;
  });
  viewRecords.sort((a, b) => (sortNewest ? b.time - a.time : a.time - b.time));
  render();
}

fetch(CSV_URL)
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  })
  .then((text) => {
    loadingEl.textContent = `取得 ${text.length}字 解析中…`;
    const rows = parseCSV(text);
    let start = 0;
    if (rows.length) {
      const header = `${rows[0][0] || ""}${rows[0][1] || ""}${rows[0][2] || ""}`;
      if (/タイムスタンプ|日付|コンテンツ|見出し|本文/.test(header)) start = 1;
    }
    for (let rowIndex = start; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const date = (row[0] || "").trim();
      const kind = (row[1] || "").trim();
      const head = (row[2] || "").trim();
      const textBody = (row[3] || "").trim();
      if (!head && !textBody) continue;
      const parsed = parseTime(date);
      allRecords.push({
        date,
        kind: kind || "記録",
        head: head || "（無題）",
        text: textBody,
        time: Number.isNaN(parsed) ? rowIndex : parsed
      });
    }
    const kinds = [...new Set(allRecords.map((record) => record.kind))];
    kinds.forEach((kind) => {
      const option = document.createElement("option");
      option.value = kind;
      option.textContent = kind;
      filterEl.appendChild(option);
    });
    document.getElementById("cnt").textContent = String(allRecords.length);
    applyView();
    loadingEl.textContent = allRecords.length ? `読込 ${allRecords.length}件 ← 左へ` : "記録はまだありません";
    setTimeout(() => { loadingEl.style.display = "none"; }, 2400);
  })
  .catch((error) => {
    loadingEl.textContent = `記録の取得に失敗しました: ${error.message}`;
  });

queryEl.addEventListener("input", applyView);
filterEl.addEventListener("change", applyView);
document.getElementById("sortNew").addEventListener("click", function sortNew() {
  sortNewest = true;
  this.classList.add("on");
  document.getElementById("sortOld").classList.remove("on");
  applyView();
});
document.getElementById("sortOld").addEventListener("click", function sortOld() {
  sortNewest = false;
  this.classList.add("on");
  document.getElementById("sortNew").classList.remove("on");
  applyView();
});

/* 公開ページに認証鍵を埋めると、隠し扉ではなく看板になるため、記録入力は無効化。 */
const admin = document.getElementById("admin");
admin.setAttribute("aria-hidden", "true");
document.getElementById("a_cancel").addEventListener("click", () => {
  admin.classList.remove("on");
  admin.setAttribute("aria-hidden", "true");
});
document.getElementById("a_send").addEventListener("click", () => {
  document.getElementById("a_stat").textContent = "公開版からの送信は停止中。スプレッドシートから追加してください。";
});

function stripTags(value) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

let fbiList = [];
function showFbi() {
  if (!fbiList.length) return;
  const item = fbiList[Math.floor(Math.random() * fbiList.length)];
  const image = item.images?.[0]?.large || item.images?.[0]?.original || item.images?.[0]?.thumb || "";
  if (image) document.getElementById("fbiimg").src = image;
  document.getElementById("fbiname").textContent = item.title || "UNKNOWN";
  const charge = (item.subjects?.length ? item.subjects.join("、") : "") || stripTags(item.description) || stripTags(item.caution);
  document.getElementById("fbicharge").textContent = charge.slice(0, 90);
  document.getElementById("fbirew").textContent = item.reward_text ? `懸賞金 ${stripTags(item.reward_text).slice(0, 60)}` : "";
}

fetch(`https://api.fbi.gov/wanted/v1/list?page=${1 + Math.floor(Math.random() * 30)}`)
  .then((response) => response.json())
  .then((data) => {
    fbiList = (data.items || []).filter((item) => item.images?.length && (item.images[0].large || item.images[0].original));
    if (fbiList.length) {
      showFbi();
      setInterval(showFbi, 9000);
    } else {
      document.getElementById("fbiname").textContent = "観測対象・該当なし";
    }
  })
  .catch(() => {
    document.getElementById("fbiname").textContent = "観測対象・通信途絶";
  });

let wispTarget = 1;
const panelObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.querySelector(".reveal")?.classList.add("on");
    const panelNo = entry.target.dataset.no || "";
    ghostnoEl.textContent = panelNo;
    wispTarget = panelNo === "序" || panelNo === "目次" ? 1 : 0.28;
    const fbi = document.getElementById("fbi");
    if (fbi) fbi.style.display = panelNo === "序" ? "block" : "none";
  });
}, { threshold: 0.4 });

function observePanel(panel) { panelObserver.observe(panel); }
document.querySelectorAll(".panel").forEach(observePanel);

const canvas = document.getElementById("void");
const context = canvas.getContext("2d");
let width;
let height;
let ratio;
function resizeCanvas() {
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

class Wisp {
  constructor() { this.reset(true); }
  reset(initial) {
    this.x = Math.random() * width;
    this.y = initial ? Math.random() * height : height + 40;
    this.radius = 4 + Math.random() * 9;
    this.velocityY = 0.15 + Math.random() * 0.5;
    this.sway = 0.3 + Math.random() * 0.9;
    this.phase = Math.random() * 6.28;
    this.phaseSpeed = 0.005 + Math.random() * 0.015;
    this.flicker = Math.random() * 6.28;
    this.trail = [];
  }
  step() {
    this.phase += this.phaseSpeed;
    this.flicker += 0.04 + Math.random() * 0.03;
    this.x += Math.sin(this.phase) * this.sway;
    this.y -= this.velocityY;
    this.trail.unshift({ x: this.x, y: this.y });
    if (this.trail.length > 16) this.trail.pop();
    if (this.y < -50) this.reset(false);
  }
  draw(brightness) {
    const flicker = 0.55 + 0.45 * Math.sin(this.flicker);
    for (let i = this.trail.length - 1; i >= 0; i -= 1) {
      const point = this.trail[i];
      const position = i / this.trail.length;
      const alpha = (1 - position) * 0.15 * flicker * brightness;
      const radius = this.radius * (0.4 + 0.6 * (1 - position));
      const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.4);
      glow.addColorStop(0, `rgba(255,255,255,${alpha})`);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(point.x, point.y, radius * 2.4, 0, Math.PI * 2);
      context.fill();
    }
    const glow = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 3.4);
    glow.addColorStop(0, `rgba(255,255,255,${0.82 * flicker * brightness})`);
    glow.addColorStop(0.22, `rgba(228,232,236,${0.42 * flicker * brightness})`);
    glow.addColorStop(1, "rgba(200,210,220,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(this.x, this.y, this.radius * 3.4, 0, Math.PI * 2);
    context.fill();
  }
}

class Fog {
  constructor() {
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = 180 + Math.random() * 260;
    this.velocityX = (Math.random() - 0.5) * 0.16;
    this.velocityY = (Math.random() - 0.5) * 0.1;
    this.alpha = 0.014 + Math.random() * 0.028;
  }
  step() {
    this.x += this.velocityX;
    this.y += this.velocityY;
    if (this.x < -this.radius) this.x = width + this.radius;
    if (this.x > width + this.radius) this.x = -this.radius;
    if (this.y < -this.radius) this.y = height + this.radius;
    if (this.y > height + this.radius) this.y = -this.radius;
  }
  draw() {
    const glow = context.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
    glow.addColorStop(0, `rgba(180,185,195,${this.alpha})`);
    glow.addColorStop(1, "rgba(180,185,195,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    context.fill();
  }
}

const wisps = Array.from({ length: window.innerWidth < 560 ? 13 : 20 }, () => new Wisp());
const fogs = Array.from({ length: 6 }, () => new Fog());
let wispBrightness = 1;
function animationLoop() {
  wispBrightness += (wispTarget - wispBrightness) * 0.05;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "source-over";
  fogs.forEach((fog) => { fog.step(); fog.draw(); });
  context.globalCompositeOperation = "lighter";
  wisps.forEach((wisp) => { wisp.step(); wisp.draw(wispBrightness); });
  context.globalCompositeOperation = "source-over";
  requestAnimationFrame(animationLoop);
}
animationLoop();

const ekgCanvas = document.getElementById("ekg");
const ekgContext = ekgCanvas.getContext("2d");
let ekgTime = 0;
function resizeEkg() {
  ekgCanvas.width = Math.max(1, ekgCanvas.clientWidth);
  ekgCanvas.height = Math.max(1, ekgCanvas.clientHeight);
}
resizeEkg();
window.addEventListener("resize", resizeEkg);
function drawEkg() {
  const w = ekgCanvas.width;
  const h = ekgCanvas.height;
  ekgContext.clearRect(0, 0, w, h);
  ekgContext.strokeStyle = "rgba(233,230,222,.75)";
  ekgContext.lineWidth = 1;
  ekgContext.beginPath();
  let peak = 0;
  for (let x = 0; x < w; x += 1) {
    const y = h / 2 + Math.sin(x * 0.05 + ekgTime) * h * 0.24 + Math.sin(x * 0.14 + ekgTime * 1.7) * h * 0.12 + (Math.random() - 0.5) * h * 0.14;
    peak = Math.max(peak, Math.abs(y - h / 2));
    if (x === 0) ekgContext.moveTo(x, y); else ekgContext.lineTo(x, y);
  }
  ekgContext.stroke();
  document.getElementById("ekgv").textContent = `±${(peak / h * 4).toFixed(2)}`;
  ekgTime += 0.07;
  requestAnimationFrame(drawEkg);
}
drawEkg();

function pad(value) { return value < 10 ? `0${value}` : String(value); }
function setMeter(id, value) { document.getElementById(id).style.width = `${Math.max(0, Math.min(100, value))}%`; }
function tick() {
  const now = new Date();
  document.getElementById("clk").textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  document.getElementById("coordHud").innerHTML = `N${(34.6 + Math.random() * 0.1).toFixed(4)}<br>E${(135.4 + Math.random() * 0.2).toFixed(4)}<br>標高 ${2 + Math.floor(Math.random() * 40)}m`;
  document.getElementById("bars").textContent = ["▮▮▮▯", "▮▮▮▮", "▮▮▯▯", "▮▮▮▯"][Math.floor(Math.random() * 4)];
  const pressure = 1004 + Math.floor(Math.random() * 16);
  document.getElementById("m1v").textContent = String(pressure); setMeter("m1", (pressure - 1000) / 30 * 100);
  const humidity = 58 + Math.floor(Math.random() * 14);
  document.getElementById("m2v").textContent = `${humidity}%`; setMeter("m2", humidity);
  const visibility = 6 + Math.floor(Math.random() * 5);
  document.getElementById("m3v").textContent = `${visibility}km`; setMeter("m3", visibility / 12 * 100);
  const temperature = 14 + Math.floor(Math.random() * 10);
  document.getElementById("m4v").textContent = `${temperature}℃`; setMeter("m4", temperature / 30 * 100);
  const wind = (1 + Math.random() * 5).toFixed(1);
  document.getElementById("m5v").textContent = `${wind}m`; setMeter("m5", Number(wind) / 8 * 100);
}
tick();
setInterval(tick, 1400);

const hexRail = document.getElementById("hexrail");
function updateHex() {
  hexRail.textContent = Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("\n");
}
updateHex();
setInterval(updateHex, 900);

const words = ["観測所", "第〇九一號", "記録", "受信", "北緯三四度", "東経一三五度", "気圧 一〇一二", "湿度 六四", "視界 良好", "現在 記録中"];
document.getElementById("run").textContent = `${words.join("　・　")}　・　${words.join("　・　")}　・　`;

const glitchLine = document.getElementById("glitch");
function glitch() {
  glitchLine.style.top = `${Math.random() * 100}%`;
  glitchLine.style.opacity = "0.5";
  setTimeout(() => { glitchLine.style.opacity = "0"; }, 90);
  setTimeout(glitch, 4000 + Math.random() * 6000);
}
setTimeout(glitch, 5000);

const progressLine = document.getElementById("prog");
const wispBar = document.getElementById("wispbar");
const wispKnob = document.getElementById("wispknob");
let draggingWisp = false;
function placeWispKnob(progress) {
  const trackWidth = Math.max(0, wispBar.clientWidth - wispKnob.offsetWidth);
  wispKnob.style.left = `${(1 - progress) * trackWidth}px`;
}
function onScrollHome() {
  const maximum = sc.scrollWidth - sc.clientWidth;
  const position = Math.abs(sc.scrollLeft);
  progressLine.style.width = `${maximum > 0 ? position / maximum * 100 : 0}%`;
  document.getElementById("edgehint").style.opacity = position > 30 ? "0" : "1";
  const index = sc.clientWidth > 0 ? Math.round(position / sc.clientWidth) : 0;
  wispBar.classList.toggle("show", index >= 2);
  if (!draggingWisp) placeWispKnob(maximum > 0 ? position / maximum : 0);
}
sc.addEventListener("scroll", onScrollHome, { passive: true });

let wheelLock = false;
sc.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  if (wheelLock || Math.abs(event.deltaY) < 6) return;
  wheelLock = true;
  const direction = event.deltaY > 0 ? -1 : 1;
  sc.scrollBy({ left: direction * sc.clientWidth, behavior: "smooth" });
  setTimeout(() => { wheelLock = false; }, 480);
}, { passive: false });

(function setupWispDrag() {
  let maximum = 0;
  let trackWidth = 1;
  let sign = -1;
  function snapNearest() {
    if (sc.clientWidth <= 0) return;
    const index = Math.round(Math.abs(sc.scrollLeft) / sc.clientWidth);
    const currentSign = sc.scrollLeft > 0 ? 1 : -1;
    sc.scrollTo({ left: currentSign * index * sc.clientWidth, behavior: "smooth" });
  }
  function start(event) {
    draggingWisp = true;
    wispKnob.style.animationPlayState = "paused";
    sc.style.scrollSnapType = "none";
    maximum = sc.scrollWidth - sc.clientWidth;
    trackWidth = Math.max(1, wispBar.clientWidth - wispKnob.offsetWidth);
    sign = sc.scrollLeft > 0 ? 1 : -1;
    try { wispKnob.setPointerCapture(event.pointerId); } catch (_) { /* noop */ }
    event.preventDefault();
  }
  function move(event) {
    if (!draggingWisp) return;
    const rectangle = wispBar.getBoundingClientRect();
    let x = event.clientX - rectangle.left - wispKnob.offsetWidth / 2;
    x = Math.max(0, Math.min(trackWidth, x));
    wispKnob.style.left = `${x}px`;
    const progress = 1 - x / trackWidth;
    sc.scrollLeft = sign * progress * maximum;
  }
  function end(event) {
    if (!draggingWisp) return;
    draggingWisp = false;
    wispKnob.style.animationPlayState = "";
    sc.style.scrollSnapType = "";
    try { wispKnob.releasePointerCapture(event.pointerId); } catch (_) { /* noop */ }
    snapNearest();
  }
  wispKnob.addEventListener("pointerdown", start);
  wispKnob.addEventListener("pointermove", move);
  wispKnob.addEventListener("pointerup", end);
  wispKnob.addEventListener("pointercancel", end);
}());

window.addEventListener("resize", onScrollHome);
onScrollHome();
