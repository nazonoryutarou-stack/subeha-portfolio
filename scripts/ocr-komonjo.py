#!/usr/bin/env python3
import argparse, json, os, re, subprocess, sys, time
from pathlib import Path
from urllib.parse import quote

import requests

UA = {"User-Agent": "subeha-komonjo-ocr/1.0"}

PRINCETON_MAP = {
    "RB00033779": "5",
    "RB00033788": "14",
    "RB00033789": "15",
}

def clean_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p\s*>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&")
           .replace("&lt;", "<").replace("&gt;", ">")
           .replace("&quot;", '"').replace("&#39;", "'").replace("&apos;", "'"))
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()

def manifest_url(record_id):
    return f"https://rmda.kulib.kyoto-u.ac.jp/iiif/metadata_manifest/{quote(record_id)}/manifest.json"

def body_image_url(body):
    if not body:
        return None
    services = body.get("service") or body.get("services")
    if isinstance(services, list):
        services = services[0] if services else None
    if isinstance(services, dict):
        sid = services.get("@id") or services.get("id")
        if sid:
            return sid.rstrip("/") + "/full/2400,/0/default.jpg"
    return body.get("@id") or body.get("id")

def image_urls_from_manifest(m):
    out = []
    seqs = m.get("sequences") or []
    if seqs and (seqs[0].get("canvases") or []):
        for c in seqs[0]["canvases"]:
            imgs = c.get("images") or []
            body = imgs[0].get("resource") if imgs else None
            u = body_image_url(body)
            if u:
                out.append(u)
    elif m.get("items"):
        for c in m["items"]:
            pages = c.get("items") or []
            annos = pages[0].get("items") if pages else []
            body = annos[0].get("body") if annos else None
            u = body_image_url(body)
            if u:
                out.append(u)
    return out

def fetch_princeton():
    url = "https://komonjo.princeton.edu/suruga-date/newdata.json"
    try:
        r = requests.get(url, headers=UA, timeout=30)
        r.raise_for_status()
        obj = r.json()
        return {str(x.get("id")): x for x in obj.get("doc", [])}, url
    except Exception as e:
        print("WARN princeton:", e, flush=True)
        return {}, url

def download(url, path):
    with requests.get(url, headers=UA, timeout=90, stream=True) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)

def run_ocr(ocr_root, image, outdir):
    outdir.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, str(Path(ocr_root) / "src" / "ocr.py"),
           "--sourceimg", str(image), "--output", str(outdir)]
    print("RUN", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, timeout=1800)
    txts = sorted(outdir.rglob("*.txt"), key=lambda p: p.stat().st_mtime)
    if not txts:
        return ""
    return txts[-1].read_text(encoding="utf-8", errors="replace").strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--koten-root", required=True)
    ap.add_argument("--modern-root", required=True)
    ap.add_argument("--work", required=True)
    args = ap.parse_args()

    data_path = Path(args.data)
    data = json.loads(data_path.read_text(encoding="utf-8"))
    work = Path(args.work)
    work.mkdir(parents=True, exist_ok=True)

    princeton, princeton_url = fetch_princeton()
    exact = 0
    drafts = 0
    failed = 0

    for i, d in enumerate(data.get("documents", []), 1):
        rid = d["recordId"]
        print(f"[{i}/{len(data['documents'])}] {rid} {d['title']}", flush=True)

        # Keep manually verified/source transcription.
        if d.get("transcription") and d.get("transcriptionStatus") in {"source", "verified"}:
            print("  keep verified/source transcription", flush=True)
            exact += 1
            continue

        # Prefer the Princeton/Kyoto project transcription where available.
        pid = PRINCETON_MAP.get(rid)
        if pid and pid in princeton:
            t = clean_html(princeton[pid].get("transcription"))
            if t:
                d["transcription"] = t
                d["transcriptionStatus"] = "source"
                d["transcriptionMethod"] = "Kyoto-Princeton Project transcription"
                d["transcriptionSource"] = f"https://komonjo.princeton.edu/suruga-date/view.html?d={pid}"
                d["transcriptionReview"] = "source"
                exact += 1
                print(f"  Princeton source transcription: {len(t)} chars", flush=True)
                continue

        # Otherwise create a machine draft from the public IIIF images.
        try:
            mr = requests.get(manifest_url(rid), headers=UA, timeout=45)
            mr.raise_for_status()
            urls = image_urls_from_manifest(mr.json())
            if not urls:
                raise RuntimeError("no IIIF images")
            docdir = work / rid
            imgdir = docdir / "images"
            imgdir.mkdir(parents=True, exist_ok=True)
            pages = []
            for n, url in enumerate(urls, 1):
                img = imgdir / f"{n:03d}.jpg"
                if not img.exists():
                    print("  download", n, url, flush=True)
                    download(url, img)
                engine = args.modern_root if (d.get("year") or 0) >= 1850 else args.koten_root
                outdir = docdir / f"ocr-{n:03d}"
                t = run_ocr(engine, img, outdir)
                if t:
                    pages.append(f"【{n}】\n{t}")
            t = "\n\n".join(pages).strip()
            if not t:
                raise RuntimeError("OCR produced no text")
            d["transcription"] = t
            d["transcriptionStatus"] = "ai-draft"
            d["transcriptionMethod"] = "NDL古典籍OCR-Lite" if (d.get("year") or 0) < 1850 else "NDLOCR-Lite"
            d["transcriptionSource"] = manifest_url(rid)
            d["transcriptionReview"] = "unreviewed"
            drafts += 1
            print(f"  AI draft: {len(t)} chars / {len(urls)} images", flush=True)
        except Exception as e:
            d["transcriptionStatus"] = "failed"
            d["transcriptionError"] = str(e)
            failed += 1
            print("  ERROR:", e, flush=True)

    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    data["transcriptionBuild"] = {
        "sourceOrVerified": exact,
        "aiDraft": drafts,
        "failed": failed,
        "total": len(data.get("documents", [])),
        "note": "AI draft is machine-generated and must not be treated as a scholarly verified transcription."
    }
    data_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(data["transcriptionBuild"], ensure_ascii=False), flush=True)

if __name__ == "__main__":
    main()
