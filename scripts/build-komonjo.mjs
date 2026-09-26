import fs from "node:fs/promises";

const target = process.argv[2] || "public/komonjo/data.json";
const raw = await fs.readFile(target, "utf8");
const data = JSON.parse(raw);

function textOf(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join("\n");
  if (typeof v === "object") {
    for (const key of ["ja","en","none","@value","value"]) {
      if (key in v) return textOf(v[key]);
    }
    return Object.values(v).map(textOf).filter(Boolean).join("\n");
  }
  return String(v);
}
function cleanHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_,n)=>String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function labelText(x){ return textOf(x).toLowerCase(); }
function extractTranscript(m) {
  const meta = Array.isArray(m.metadata) ? m.metadata : [];
  const preferred = [];
  for (const row of meta) {
    const label = labelText(row.label);
    const val = cleanHtml(textOf(row.value));
    if (!val) continue;
    if (/翻刻|本文|transcription|transcript/.test(label)) preferred.push(val);
  }
  if (preferred.length) return preferred.join("\n\n");

  const desc = cleanHtml(textOf(m.description));
  if (desc) return desc;

  return "";
}

let ok = 0, missing = 0, failed = 0;
for (const d of data.documents) {
  const url = `https://rmda.kulib.kyoto-u.ac.jp/iiif/metadata_manifest/${encodeURIComponent(d.recordId)}/manifest.json`;
  d.transcriptionSource = url;
  try {
    const r = await fetch(url, {headers: {"user-agent":"subeha-komonjo-builder/1.0"}});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const manifest = await r.json();
    const t = extractTranscript(manifest);
    if (t) {
      d.transcription = t;
      d.transcriptionStatus = "source";
      ok++;
    } else {
      d.transcriptionStatus = "missing";
      const labels=(Array.isArray(manifest.metadata)?manifest.metadata:[]).map(row=>({
        label:textOf(row.label),
        len:cleanHtml(textOf(row.value)).length
      }));
      console.log("missing transcript metadata", d.recordId, JSON.stringify(labels), "descriptionLen", cleanHtml(textOf(manifest.description)).length);
      missing++;
    }
  } catch (e) {
    d.transcriptionStatus = "fetch-error";
    d.transcriptionError = String(e && e.message || e);
    failed++;
  }
}

data.updatedAt = new Date().toISOString();
data.transcriptionBuild = {ok, missing, failed, total:data.documents.length};
await fs.writeFile(target, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`komonjo transcription build: ok=${ok} missing=${missing} failed=${failed} total=${data.documents.length}`);

// PRINCETON_DIAG temporary diagnostic
try {
  const u="https://komonjo.princeton.edu/suruga-date/view.html?d=14";
  const r=await fetch(u,{headers:{"user-agent":"Mozilla/5.0"}});
  const h=await r.text();
  const p=h.toLowerCase().indexOf("trans");
  console.log("PRINCETON_DIAG", r.status, h.length, h.slice(Math.max(0,p-1200), p>=0?p+4000:4000).replace(/\s+/g," "));
} catch(e) { console.log("PRINCETON_DIAG_ERR", String(e)); }
