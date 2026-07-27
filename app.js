"use strict";
const COCONALA_URL = "https://coconala.com/services/4329584";
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRA1AuFPfz23AiuyNHirTIn8pslZOn8UHyaFzB0SaBWewcErvPV6YIMBy_6tA6MyNTMLjEY11jwDL0w/pub?output=csv";
const scroller = document.getElementById("scroller");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const sceneNo = document.getElementById("sceneNo");
const sceneTotal = document.getElementById("sceneTotal");
const recordStatus = document.getElementById("recordStatus");
const recordQuery = document.getElementById("recordQuery");
const recordFilter = document.getElementById("recordFilter");
const recordCount = document.getElementById("recordCount");
const BASE_SCENES = 5;
const BATCH_SIZE = 8;
let allRecords = [];
let visibleRecords = [];
let renderedCount = 0;
let newestFirst = true;
let activeSceneIndex = 0;
let wheelLocked = false;
const FALLBACK_RECORDS = [
  { date: "2026.07.27", kind: "霊務", head: "日雇い霊能者、来ず", text: "霊は来ないことがある。霊能者も来ないことがある。\n予約時間に厳しいのは神仏より人間だった。" },
  { date: "2026.07.26", kind: "短編", head: "腹に顔描く霊能者", text: "VTuberになりたかったが、機材も技術もなかった。\nそこで腹に顔を描き、生体Live2Dと呼んだ。" },
  { date: "2026.07.25", kind: "観測", head: "無料では輪郭まで", text: "無料の場で見えるのは、問題の場所と形まで。\n解決の順番を組む仕事は、個別相談で扱う。" },
  { date: "2026.07.24", kind: "制作", head: "用途未確定の勾玉", text: "効能を先に決めると、物は説明の奴隷になる。\nまずは手に残る形から始める。" },
  { date: "2026.07.23", kind: "物流", head: "本人の責任ではない荷物", text: "感情仕分け場で、宛先の違う責任が見つかった。\n返送には送り状が必要である。" }
];
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') { current += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(current); current = ""; }
    else if (char === "\n") { row.push(current); rows.push(row); row = []; current = ""; }
    else if (char !== "\r") current += char;
  }
  if (current !== "" || row.length) { row.push(current); rows.push(row); }
  return rows;
}
function parseTime(value) {
  const match = String(value || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?)?/);
  if (!match) return Number.NaN;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)).getTime();
}
function normalizeRecords(rows) {
  let start = 0;
  if (rows[0] && /タイムスタンプ|日付|コンテンツ|見出し|本文/.test(rows[0].join(""))) start = 1;
  return rows.slice(start).map((row, index) => {
    const date = String(row[0] || "").trim();
    const kind = String(row[1] || "記録").trim() || "記録";
    const head = String(row[2] || "（無題）").trim() || "（無題）";
    const text = String(row[3] || "").trim();
    const timestamp = parseTime(date);
    return { date, kind, head, text, timestamp: Number.isNaN(timestamp) ? index : timestamp };
  }).filter((record) => record.head || record.text);
}
function seedRecordInterface(records, source) {
  allRecords = records.map((record, index) => ({ ...record, timestamp: record.timestamp ?? parseTime(record.date) ?? index }));
  const kinds = [...new Set(allRecords.map((record) => record.kind))];
  recordFilter.replaceChildren(new Option("すべて", ""));
  kinds.forEach((kind) => recordFilter.add(new Option(kind, kind)));
  recordStatus.textContent = source === "remote" ? "公開記録と同期済み" : "予備記録を表示中";
  applyRecordView(false);
}
function removeRecordScenes() {
  scroller.querySelectorAll(".record-scene, .more-scene, .empty-scene").forEach((scene) => scene.remove());
  renderedCount = 0;
}
function makeRecordScene(record, index) {
  const scene = document.createElement("section");
  scene.className = "scene record-scene";
  scene.dataset.scene = `記録 ${String(index + 1).padStart(2, "0")}`;
  scene.style.setProperty("--record-tilt", `${((index % 5) - 2) * 0.22}deg`);
  scene.innerHTML = `
    <div class="scene__inner">
      <article class="record-sheet" data-record-no="OBS-${String(index + 1).padStart(4, "0")}">
        <div class="record-sheet__meta">${escapeHtml(record.kind)} / ${escapeHtml(record.date || "日付不明")}</div>
        <div class="record-sheet__content">
          <h2>${escapeHtml(record.head)}</h2>
          <p>${escapeHtml(record.text)}</p>
        </div>
      </article>
    </div>`;
  return scene;
}
function makeMoreScene() {
  const scene = document.createElement("section");
  scene.className = "scene more-scene";
  scene.dataset.scene = "記録継続";
  const remain = visibleRecords.length - renderedCount;
  scene.innerHTML = `<button type="button">続きを読む　／　残り ${remain} 件</button>`;
  scene.querySelector("button").addEventListener("click", () => {
    scene.remove();
    appendRecordBatch();
    updateSceneTotals();
  });
  return scene;
}
function appendRecordBatch() {
  const end = Math.min(renderedCount + BATCH_SIZE, visibleRecords.length);
  for (let index = renderedCount; index < end; index += 1) scroller.appendChild(makeRecordScene(visibleRecords[index], index));
  renderedCount = end;
  if (renderedCount < visibleRecords.length) scroller.appendChild(makeMoreScene());
}
function applyRecordView(keepPosition = true) {
  const query = recordQuery.value.trim();
  const kind = recordFilter.value;
  visibleRecords = allRecords.filter((record) => {
    if (kind && record.kind !== kind) return false;
    if (query && !`${record.head} ${record.text} ${record.kind}`.includes(query)) return false;
    return true;
  });
  visibleRecords.sort((a, b) => newestFirst ? b.timestamp - a.timestamp : a.timestamp - b.timestamp);
  recordCount.textContent = String(visibleRecords.length);
  removeRecordScenes();
  if (visibleRecords.length) appendRecordBatch();
  else {
    const scene = document.createElement("section");
    scene.className = "scene empty-scene";
    scene.dataset.scene = "該当なし";
    scene.innerHTML = `<div><p>該当する記録はありません。</p><small>検索語を変えてください。</small></div>`;
    scroller.appendChild(scene);
  }
  updateSceneTotals();
  if (!keepPosition) scroller.scrollTo({ left: 0, behavior: "auto" });
}
async function loadRemoteRecords() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(CSV_URL, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const records = normalizeRecords(parseCsv(text));
    if (records.length) seedRecordInterface(records, "remote");
  } catch (error) {
    recordStatus.textContent = "公開記録との通信が途絶えました";
  } finally {
    clearTimeout(timeout);
  }
}
function buildTeeth(container, lower = false) {
  const shapes = ["molar", "molar", "", "canine", "", "", "", "", "", "canine", "", "molar", "molar"];
  shapes.forEach((shape, index) => {
    const tooth = document.createElement("span");
    tooth.className = `tooth${shape ? ` tooth--${shape}` : ""}`;
    if ((!lower && index === 1) || (lower && index === 8)) tooth.classList.add("tooth--missing");
    if (lower && index === 4) tooth.classList.add("tooth--metal");
    tooth.style.setProperty("--tooth-scale", String(.88 + ((index * 7) % 5) * .035));
    tooth.style.setProperty("--tooth-y", `${(index % 3) - 1}px`);
    container.appendChild(tooth);
  });
}
buildTeeth(document.getElementById("upperTeeth"));
buildTeeth(document.getElementById("lowerTeeth"), true);
function scenes() { return [...scroller.querySelectorAll(":scope > .scene")]; }
function updateSceneTotals() { sceneTotal.textContent = String(scenes().length).padStart(2, "0"); }
function goToScene(index, behavior = "smooth") {
  const allScenes = scenes();
  const target = Math.max(0, Math.min(allScenes.length - 1, index));
  scroller.scrollTo({ left: target * scroller.clientWidth, behavior });
}
document.querySelectorAll("[data-goto]").forEach((button) => button.addEventListener("click", () => goToScene(Number(button.dataset.goto))));
document.getElementById("prevScene").addEventListener("click", () => goToScene(activeSceneIndex - 1));
document.getElementById("nextScene").addEventListener("click", () => goToScene(activeSceneIndex + 1));
document.getElementById("openFirstRecord").addEventListener("click", () => goToScene(BASE_SCENES));
scroller.addEventListener("scroll", () => {
  const max = Math.max(1, scroller.scrollWidth - scroller.clientWidth);
  const position = scroller.scrollLeft;
  const progress = Math.max(0, Math.min(1, position / max));
  const allScenes = scenes();
  activeSceneIndex = Math.max(0, Math.min(allScenes.length - 1, Math.round(position / scroller.clientWidth)));
  const active = allScenes[activeSceneIndex];
  progressBar.style.width = `${progress * 100}%`;
  sceneNo.textContent = String(activeSceneIndex + 1).padStart(2, "0");
  progressLabel.textContent = active?.dataset.scene || "観測中";
  document.documentElement.style.setProperty("--jaw-close", `${Math.min(24, progress * 24)}px`);
  document.documentElement.style.setProperty("--scene-shift", String(progress * 22));
}, { passive: true });
scroller.addEventListener("wheel", (event) => {
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  event.preventDefault();
  if (wheelLocked || Math.abs(event.deltaY) < 5) return;
  wheelLocked = true;
  goToScene(activeSceneIndex + (event.deltaY > 0 ? 1 : -1));
  setTimeout(() => { wheelLocked = false; }, 520);
}, { passive: false });
window.addEventListener("keydown", (event) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (event.key === "ArrowRight" || event.key === "PageDown") goToScene(activeSceneIndex + 1);
  if (event.key === "ArrowLeft" || event.key === "PageUp") goToScene(activeSceneIndex - 1);
  if (event.key === "Home") goToScene(0);
  if (event.key === "End") goToScene(scenes().length - 1);
});
recordQuery.addEventListener("input", () => applyRecordView());
recordFilter.addEventListener("change", () => applyRecordView());
document.getElementById("sortNew").addEventListener("click", (event) => {
  newestFirst = true;
  event.currentTarget.classList.add("is-active");
  document.getElementById("sortOld").classList.remove("is-active");
  applyRecordView();
});
document.getElementById("sortOld").addEventListener("click", (event) => {
  newestFirst = false;
  event.currentTarget.classList.add("is-active");
  document.getElementById("sortNew").classList.remove("is-active");
  applyRecordView();
});
function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":");
}
updateClock();
setInterval(updateClock, 1000);
const readouts = [
  ["唾液粘度", 34.2, ""],
  ["責任混入率", 61, "%"],
  ["説明不能率", 87, "%"],
  ["現実復帰率", 72, "%"],
  ["咬合圧", 18.4, "kg"]
];
let readoutIndex = 0;
setInterval(() => {
  readoutIndex = (readoutIndex + 1) % readouts.length;
  const [label, value, suffix] = readouts[readoutIndex];
  document.getElementById("readoutLabel").textContent = label;
  document.getElementById("readoutValue").textContent = `${value}${suffix}`;
  document.getElementById("readoutBar").style.width = `${Math.min(100, Number(value))}%`;
}, 3100);
const canvas = document.getElementById("aura");
const context = canvas.getContext("2d", { alpha: false });
let width = 0;
let height = 0;
let dpr = 1;
let animationFrame = 0;
let motionStopped = false;
const particles = [];
function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function seedParticles() {
  particles.length = 0;
  const count = width < 600 ? 12 : 22;
  for (let index = 0; index < count; index += 1) {
    particles.push({ x: Math.random() * width, y: Math.random() * height, r: 2 + Math.random() * 7, vx: (Math.random() - .5) * .16, vy: -.08 - Math.random() * .22, p: Math.random() * Math.PI * 2 });
  }
}
function drawAura() {
  context.fillStyle = "#050403";
  context.fillRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * .5, height * .52, 10, width * .5, height * .52, Math.max(width, height) * .58);
  glow.addColorStop(0, "rgba(69,23,31,.24)");
  glow.addColorStop(.42, "rgba(22,10,13,.16)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "screen";
  particles.forEach((particle) => {
    if (!motionStopped) {
      particle.x += particle.vx + Math.sin(particle.p) * .05;
      particle.y += particle.vy;
      particle.p += .018;
      if (particle.y < -20) { particle.y = height + 20; particle.x = Math.random() * width; }
      if (particle.x < -20) particle.x = width + 20;
      if (particle.x > width + 20) particle.x = -20;
    }
    const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.r * 5);
    gradient.addColorStop(0, "rgba(235,228,213,.42)");
    gradient.addColorStop(.16, "rgba(168,178,178,.18)");
    gradient.addColorStop(1, "rgba(168,178,178,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.r * 5, 0, Math.PI * 2);
    context.fill();
  });
  context.globalCompositeOperation = "source-over";
  animationFrame = requestAnimationFrame(drawAura);
}
resizeCanvas();
seedParticles();
drawAura();
window.addEventListener("resize", () => { resizeCanvas(); seedParticles(); goToScene(activeSceneIndex, "auto"); });
const mediaReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const motionToggle = document.getElementById("motionToggle");
let storedMotion = "on";
try { storedMotion = sessionStorage.getItem("subeha-motion") || "on"; } catch (_) {  }
if (storedMotion === "off") {
  motionStopped = true;
  document.documentElement.classList.add("motion-off");
}
if (mediaReduced.matches) {
  motionToggle.hidden = false;
  if (!motionStopped) document.documentElement.classList.add("force-motion");
}
motionToggle.textContent = motionStopped ? "演出を再開する" : "演出を停止する";
motionToggle.addEventListener("click", () => {
  motionStopped = !motionStopped;
  document.documentElement.classList.toggle("motion-off", motionStopped);
  document.documentElement.classList.toggle("force-motion", !motionStopped);
  motionToggle.textContent = motionStopped ? "演出を再開する" : "演出を停止する";
  try { sessionStorage.setItem("subeha-motion", motionStopped ? "off" : "on"); } catch (_) {  }
});
seedRecordInterface(FALLBACK_RECORDS, "fallback");
loadRemoteRecords();
updateSceneTotals();
requestAnimationFrame(() => scroller.dispatchEvent(new Event("scroll")));
document.querySelectorAll(`a[href="${COCONALA_URL}"]`).forEach((link) => link.setAttribute("aria-label", `${link.textContent.trim()}（ココナラの商品ページを新しいタブで開く）`));
