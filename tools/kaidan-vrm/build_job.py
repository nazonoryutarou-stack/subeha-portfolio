#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import html
import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

import edge_tts
import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist" / "kaidan-vrm"
WORK = OUT / "work"
AUDIO = WORK / "audio"
PUBLIC = ROOT / "remotion" / "vrm-lipsync" / "public" / "kaidan-0217"
VOICE = "ja-JP-KeitaNeural"
RATE = "-8%"
PAUSE_SECONDS = 0.28

TITLE = "創作怪談｜午前2時17分の海水浴場"
STORY = [
    "これは、数年前に閉鎖された海水浴場をめぐる、創作怪談です。",
    "そこでは午前2時17分になると、使われていない防災無線から、遊泳時間は終了しました、と流れるそうです。",
    "ある夏、大学生二人が録音しに行きました。放送が終わると、波打ち際に白い服の人が立っていました。",
    "その人は海へ入るのではなく、背中を向けたまま、海の中からゆっくり上がってきました。",
    "友人が、誰ですか、と声をかけた瞬間、防災無線がもう一度鳴りました。人数が、一人足りません。",
    "二人は車まで走って逃げました。鍵を閉めて息をついた時、助手席の足元だけが濡れた砂で汚れていました。",
    "翌朝、録音を確認すると、自分たちの声の後ろで、女の声が小さく、三人です、と答えていました。",
    "それ以来、2時17分の放送は止んだそうです。ただ今年、海開き前の点検で一度だけ、今年は四人です、と流れた、と。",
]

SCENES = [
    ("閉鎖された海水浴場", "Japan beach coast"),
    ("午前2時17分の防災無線", "Japan public address loudspeaker"),
    ("夜の波打ち際", "Japan beach coast"),
    ("海から上がってくる影", "Japan beach coast"),
    ("『人数が、一人足りません』", "Japan public address loudspeaker"),
    ("濡れた砂", "wet sand footprint beach"),
    ("録音の後ろの声", "portable audio recorder"),
    ("『今年は四人です』", "Japan beach coast"),
]

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
UA = "subeha-kaidan-vrm/1.2 (GitHub Actions)"


def run(args: list[str], *, capture: bool = False) -> str:
    print("+", " ".join(str(x) for x in args), flush=True)
    cp = subprocess.run(args, check=True, text=capture, stdout=subprocess.PIPE if capture else None)
    return cp.stdout.strip() if capture else ""


def duration(path: Path) -> float:
    return float(run([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], capture=True))


def clean_html(value: str | None) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def commons_candidates(query: str, limit: int = 36) -> list[dict]:
    params = {
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": query, "gsrnamespace": 6, "gsrlimit": limit,
        "prop": "imageinfo", "iiprop": "url|mime|extmetadata",
        "iiurlwidth": 1280, "origin": "*",
    }
    last = None
    for attempt in range(4):
        try:
            r = requests.get(COMMONS_API, params=params, timeout=25, headers={"User-Agent": UA})
            if r.status_code == 429:
                pause = max(float(r.headers.get("Retry-After") or 0), 3.0 * (attempt + 1))
                print(f"WARN Commons search rate-limited for {query!r}; retry after {pause:.1f}s", flush=True)
                time.sleep(pause)
                continue
            r.raise_for_status()
            pages = (r.json().get("query") or {}).get("pages") or {}
            rows = []
            for page in pages.values():
                info = (page.get("imageinfo") or [{}])[0]
                if str(info.get("mime") or "") not in {"image/jpeg", "image/png", "image/webp"}:
                    continue
                meta = info.get("extmetadata") or {}
                license_name = clean_html((meta.get("LicenseShortName") or {}).get("value"))
                if not license_name:
                    continue
                rows.append({
                    "pageid": page.get("pageid"),
                    "title": str(page.get("title") or ""),
                    "thumb": str(info.get("thumburl") or info.get("url") or ""),
                    "source_page": str(info.get("descriptionurl") or ""),
                    "creator": clean_html((meta.get("Artist") or {}).get("value"))[:180],
                    "license": license_name[:100],
                })
            return [x for x in rows if x["thumb"]]
        except Exception as exc:
            last = exc
            if attempt < 3:
                time.sleep(2.0 * (attempt + 1))
    raise RuntimeError(f"Commons search failed for {query!r}: {last}")


def _clean_url(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc, p.path, "", ""))


def download_as_jpeg(url: str, out: Path) -> None:
    clean = _clean_url(url)
    variants = [
        f"https://wsrv.nl/?url={quote(clean, safe='')}&output=jpg&w=1280&q=84",
        f"https://wsrv.nl/?url={quote(clean, safe='')}&output=jpg&w=960&q=82",
        clean,
    ]
    errors = []
    for attempt in range(2):
        for candidate in variants:
            try:
                r = requests.get(candidate, timeout=35, headers={"User-Agent": UA})
                r.raise_for_status()
                data = r.content
                if len(data) < 4000:
                    raise RuntimeError(f"image too small: {len(data)} bytes")
                ctype = (r.headers.get("content-type") or "").lower()
                if not any(x in ctype for x in ("jpeg", "jpg", "png", "webp")):
                    raise RuntimeError(f"not an image response: {ctype}")
                out.write_bytes(data)
                return
            except Exception as exc:
                errors.append(f"{candidate[:100]}: {exc}")
        if attempt == 0:
            time.sleep(1.5)
    raise RuntimeError(" | ".join(errors[-4:]))


async def synthesize(text: str, output: Path) -> None:
    await edge_tts.Communicate(text=text, voice=VOICE, rate=RATE).save(str(output))


def build_audio() -> tuple[Path, list[dict]]:
    AUDIO.mkdir(parents=True, exist_ok=True)
    parts: list[Path] = []
    timing: list[dict] = []
    cursor = 0.0
    for i, text in enumerate(STORY, 1):
        mp3 = AUDIO / f"voice_{i:02d}.mp3"
        wav = AUDIO / f"part_{i:02d}.wav"
        asyncio.run(synthesize(text, mp3))
        raw = duration(mp3)
        run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(mp3),
            "-af", f"apad=pad_dur={PAUSE_SECONDS}", "-ar", "44100", "-ac", "1",
            "-c:a", "pcm_s16le", str(wav),
        ])
        padded = duration(wav)
        timing.append({"text": text, "startMs": round(cursor * 1000), "endMs": round((cursor + raw) * 1000), "visualEndMs": round((cursor + padded) * 1000)})
        cursor += padded
        parts.append(wav)
    concat_file = WORK / "audio-concat.txt"
    concat_file.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
    source = OUT / "source.wav"
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat",
        "-safe", "0", "-i", str(concat_file), "-c:a", "pcm_s16le", "-ar", "44100",
        "-ac", "1", str(source),
    ])
    return source, timing


def build_visuals(timing: list[dict]) -> tuple[list[dict], list[dict]]:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    used: set[str] = set()
    refs: list[dict] = []
    sources: list[dict] = []
    cache: dict[str, list[dict]] = {}

    for index, ((label, query), t) in enumerate(zip(SCENES, timing), 1):
        if query not in cache:
            cache[query] = commons_candidates(query)
            print(f"Commons search {query!r}: {len(cache[query])} candidates", flush=True)
            time.sleep(1.2)
        candidate_pool = [c for c in cache[query] if c["title"] not in used]
        if len(candidate_pool) < 8:
            candidate_pool += [c for c in cache.get("Japan beach coast", []) if c["title"] not in used and c not in candidate_pool]

        chosen = None
        filename = f"scene_{index:02d}.jpg"
        target = PUBLIC / filename
        for candidate in candidate_pool[:8]:
            try:
                download_as_jpeg(candidate["thumb"], target)
                chosen = candidate
                break
            except Exception as exc:
                print(f"WARN skipping image candidate {candidate['title']}: {exc}", flush=True)
        if not chosen:
            raise RuntimeError(f"No downloadable Commons image found for scene {index}: {query}")

        used.add(chosen["title"])
        rel = f"kaidan-0217/{filename}"
        refs.append({
            "id": f"kaidan-{index:02d}", "assetId": f"kaidan-{index:02d}",
            "startMs": t["startMs"], "endMs": t["visualEndMs"], "kind": "repo",
            "title": label, "renderFile": rel, "creator": chosen["creator"], "license": chosen["license"],
        })
        sources.append({"scene": index, "query": query, "label": label, **chosen, "renderFile": rel})
        print(f"scene {index}: {chosen['title']} -> {rel}", flush=True)
    return refs, sources


def build_plan(source: Path, timing: list[dict], refs: list[dict]) -> dict:
    total_ms = round(duration(source) * 1000)
    captions = [{
        "startMs": t["startMs"], "endMs": t["endMs"], "speaker": "HOST", "text": t["text"],
        "speakerConfidence": 1.0,
        "speakerReason": "Single-speaker synthetic Japanese narration generated for this original fictional kaidan.",
    } for t in timing]
    for ref in refs:
        ref["endMs"] = min(ref["endMs"], total_ms)
    return {
        "version": 1,
        "sourceLabel": "創作怪談 / 実景写真はイメージ",
        "selection": {
            "reason": "最近のご当地怪談・水辺怪談の語り口を参照した完全オリジナル短編。",
            "hook": "午前2時17分、閉鎖された海水浴場の防災無線が鳴る。",
            "summary": "閉鎖海岸の防災無線が人数を数え始める創作怪談。",
        },
        "clip": {"startMs": 0, "endMs": total_ms},
        "layout": {"width": 1280, "height": 720, "captionBottomPx": 34, "background": "#07090d"},
        "text": {"title": "午前2時17分の海水浴場", "telop": ""},
        "captions": captions,
        "visualReferences": refs,
        "motion": {
            "profile": "calm",
            "notes": "怪談語り。VRMは左側バストアップ。全区間HOSTで音声エンベロープ口パク。資料写真は右側。動きは抑制し、まばたきと微細な頭胸モーションを中心にする。",
        },
    }


def main() -> None:
    for p in (OUT, WORK, AUDIO, PUBLIC):
        p.mkdir(parents=True, exist_ok=True)
    source, timing = build_audio()
    refs, sources = build_visuals(timing)
    plan = build_plan(source, timing, refs)
    (OUT / "edit-plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "sources.json").write_text(json.dumps({"title": TITLE, "fiction": True, "assets": sources}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    credits = [
        TITLE,
        "Story: original fiction generated for this project.",
        "Narration: Microsoft Edge TTS ja-JP-KeitaNeural.",
        "VRM: repository production Subeha.vrm.",
        "Images: reusable Wikimedia Commons photographs; illustrative only and not evidence of paranormal events.",
        "",
    ]
    for row in sources:
        credits.append(f"{row['scene']}. {row['title']} | {row['creator'] or 'unknown'} | {row['license']} | {row['source_page']}")
    (OUT / "CREDITS.txt").write_text("\n".join(credits) + "\n", encoding="utf-8")
    meta = {
        "title": TITLE, "fiction": True, "duration": duration(source), "scenes": len(STORY),
        "realAssets": len(refs), "generatedImages": 0, "voice": VOICE, "rate": RATE,
        "layout": "1280x720", "avatar": "Subeha.vrm",
    }
    (OUT / "metadata.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
