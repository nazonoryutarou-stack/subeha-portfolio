#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import html
import json
import math
import random
import re
import subprocess
import wave
from array import array
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
from urllib.parse import quote

import requests
import edge_tts

UA = "FreeShortStudio-GitHubAction/1.0 (open-source trivia video renderer)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}
BAD_TITLE_WORDS = {
    "logo", "icon", "symbol", "signature", "commons-logo", "wikidata",
    "question_book", "stub", "disambig", "edit-clear", "nuvola", "crystal_clear",
}


@dataclass
class Asset:
    file_title: str
    media_url: str
    source_page: str
    title: str
    creator: str
    license: str
    license_url: str
    width: int
    height: int
    local_path: str = ""


def run(cmd: list[str], *, capture: bool = False) -> subprocess.CompletedProcess:
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, check=True, text=True, capture_output=capture)


def http_get(url: str, *, params: dict | None = None, timeout: int = 40) -> requests.Response:
    r = requests.get(url, params=params, timeout=timeout, headers={"User-Agent": UA})
    r.raise_for_status()
    return r


def clean_markup(value) -> str:
    if isinstance(value, dict):
        value = value.get("value", "")
    text = html.unescape(re.sub(r"<[^>]+>", "", str(value or "")))
    return re.sub(r"\s+", " ", text).strip()


def resolve_wikipedia_page(topic: str, lang: str = "ja") -> dict:
    api = f"https://{lang}.wikipedia.org/w/api.php"
    search = http_get(api, params={
        "action": "query", "list": "search", "srsearch": topic,
        "srlimit": 1, "format": "json", "formatversion": 2,
    }).json()
    hits = search.get("query", {}).get("search", [])
    title = hits[0]["title"] if hits else topic

    data = http_get(api, params={
        "action": "query", "prop": "extracts|langlinks|images",
        "titles": title, "redirects": 1, "explaintext": 1,
        "imlimit": 50, "lllang": "en", "lllimit": 1,
        "format": "json", "formatversion": 2,
    }).json()
    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        raise RuntimeError(f"Wikipedia page not found: {topic}")
    page = pages[0]
    en_title = ((page.get("langlinks") or [{}])[0].get("title") or page.get("title"))
    return {
        "title": page.get("title", title),
        "en_title": en_title,
        "extract": page.get("extract", ""),
        "images": [x.get("title", "") for x in page.get("images", []) if x.get("title")],
        "source_page": f"https://{lang}.wikipedia.org/wiki/{quote(page.get('title', title).replace(' ', '_'))}",
    }


def normalize_sentence(s: str) -> str:
    s = re.sub(r"\[[^\]]+\]", "", s)
    s = re.sub(r"\([^)]{0,80}\)", "", s)
    s = re.sub(r"（[^）]{0,80}）", "", s)
    s = re.sub(r"\s+", " ", s).strip(" 。")
    return s


def shorten_sentence(s: str, limit: int = 46) -> str:
    s = normalize_sentence(s)
    if len(s) <= limit:
        return s
    for sep in ["、", "，", ",", "；", ";", "：", ":"]:
        pos = s.find(sep, max(16, limit // 2))
        if 16 <= pos <= limit + 8:
            return s[:pos].rstrip() + "。"
    return s[:limit].rstrip("、，, ") + "…"


def build_script(title: str, extract: str, fact_count: int = 6) -> list[str]:
    raw = re.split(r"(?<=[。！？!?])", extract.replace("\n", " "))
    facts: list[str] = []
    seen = set()
    for item in raw:
        s = normalize_sentence(item)
        if len(s) < 15 or len(s) > 180:
            continue
        if s.startswith(("この記事", "本項", "一覧", "曖昧")):
            continue
        s = shorten_sentence(s)
        key = re.sub(r"\W", "", s)
        if not key or key in seen:
            continue
        seen.add(key)
        facts.append(s)
        if len(facts) >= fact_count:
            break
    if len(facts) < max(3, fact_count // 2):
        raise RuntimeError("Wikipedia extract did not contain enough usable sentences")
    hook = f"{title}。30秒で、意外と知らないポイントを見ていきます。"
    end = f"{title}は、背景を追うと見え方がかなり変わります。"
    return [hook, *facts, end]


def chunks(items: list[str], n: int) -> Iterable[list[str]]:
    for i in range(0, len(items), n):
        yield items[i:i+n]


def commons_asset_from_page(page: dict) -> Asset | None:
    title = page.get("title", "")
    low = title.lower()
    if any(x in low for x in BAD_TITLE_WORDS):
        return None
    ii = (page.get("imageinfo") or [{}])[0]
    mime = ii.get("mime", "")
    if mime not in ALLOWED_MIMES:
        return None
    width, height = int(ii.get("width") or 0), int(ii.get("height") or 0)
    if width < 600 or height < 450:
        return None
    md = ii.get("extmetadata") or {}
    license_name = clean_markup(md.get("LicenseShortName")) or clean_markup(md.get("UsageTerms"))
    if not license_name:
        return None
    liclow = license_name.lower()
    if not any(x in liclow for x in ["public domain", "cc0", "cc by", "cc-by", "cc-by-sa", "attribution", "gfdl"]):
        return None
    media = ii.get("thumburl") or ii.get("url") or ""
    if not media:
        return None
    return Asset(
        file_title=title,
        media_url=media,
        source_page="https://commons.wikimedia.org/wiki/" + quote(title.replace(" ", "_"), safe=":_()-,.'"),
        title=title.removeprefix("File:"),
        creator=clean_markup(md.get("Artist")),
        license=license_name,
        license_url=clean_markup(md.get("LicenseUrl")),
        width=width, height=height,
    )


def commons_info_for_titles(file_titles: list[str], thumb_width: int = 1600) -> list[Asset]:
    out: list[Asset] = []
    for batch in chunks(file_titles, 25):
        data = http_get(COMMONS_API, params={
            "action": "query", "titles": "|".join(batch),
            "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
            "iiurlwidth": thumb_width, "format": "json", "formatversion": 2,
        }).json()
        for page in data.get("query", {}).get("pages", []):
            asset = commons_asset_from_page(page)
            if asset:
                out.append(asset)
    return out


def commons_search(query: str, limit: int = 30, thumb_width: int = 1600) -> list[Asset]:
    data = http_get(COMMONS_API, params={
        "action": "query", "generator": "search", "gsrsearch": query,
        "gsrnamespace": 6, "gsrlimit": min(limit * 2, 50),
        "prop": "imageinfo", "iiprop": "url|extmetadata|mime|size",
        "iiurlwidth": thumb_width, "format": "json", "formatversion": 2,
    }).json()
    out=[]
    for page in data.get("query", {}).get("pages", []):
        asset = commons_asset_from_page(page)
        if asset:
            out.append(asset)
        if len(out) >= limit:
            break
    return out


def dedupe_assets(items: list[Asset]) -> list[Asset]:
    out=[]; seen=set()
    for a in items:
        key=a.file_title.lower()
        if key in seen:
            continue
        seen.add(key); out.append(a)
    return out


def collect_assets(page: dict, needed: int) -> list[Asset]:
    assets = commons_info_for_titles(page["images"])
    if len(assets) < needed:
        for q in [page["en_title"], page["title"], f'{page["en_title"]} history', f'{page["en_title"]} photograph']:
            try:
                assets.extend(commons_search(q, limit=max(needed * 2, 12)))
            except Exception as exc:
                print(f"WARN Commons search {q!r}: {exc}")
            assets = dedupe_assets(assets)
            if len(assets) >= needed:
                break
    assets = dedupe_assets(assets)
    if len(assets) < max(4, min(needed, 6)):
        raise RuntimeError(f"Only {len(assets)} reusable real images found; refusing generated fallback")
    while len(assets) < needed:
        assets.extend(assets[: needed-len(assets)])
    return assets[:needed]


def download_assets(assets: list[Asset], outdir: Path) -> None:
    outdir.mkdir(parents=True, exist_ok=True)
    for i, asset in enumerate(assets, 1):
        suffix = ".png" if "png" in asset.media_url.lower() else ".jpg"
        dest = outdir / f"asset_{i:02d}{suffix}"
        r = http_get(asset.media_url, timeout=80)
        dest.write_bytes(r.content)
        asset.local_path = str(dest)
        print(f"downloaded {asset.title} -> {dest} ({len(r.content)} bytes)")


async def synthesize_one(text: str, out: Path, voice: str, rate: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(out))


def ffprobe_duration(path: Path) -> float:
    r = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)], capture=True)
    return float(r.stdout.strip())


def escape_ass(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", "\\N")


def ass_time(sec: float) -> str:
    h=int(sec//3600); m=int((sec%3600)//60); s=sec%60
    return f"{h}:{m:02d}:{s:05.2f}"


def write_ass(topic: str, texts: list[str], durations: list[float], out: Path) -> None:
    header = f"""[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Topic,Noto Sans CJK JP,44,&H00FFFFFF,&H00FFFFFF,&H00101010,&H7A000000,-1,0,0,0,100,100,0,0,3,3,0,7,50,50,70,1\nStyle: Caption,Noto Sans CJK JP,68,&H00FFFFFF,&H0000D7FF,&H00101010,&H88000000,-1,0,0,0,100,100,0,0,3,5,0,2,70,70,220,1\nStyle: Counter,Noto Sans CJK JP,34,&H0000D7FF,&H0000D7FF,&H00101010,&H7A000000,-1,0,0,0,100,100,0,0,3,3,0,9,55,55,75,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"""
    lines=[header]
    t=0.0
    total=len(texts)
    for i,(text,dur) in enumerate(zip(texts,durations),1):
        start,end=t,t+dur
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Topic,,0,0,0,,{escape_ass(topic)}\n")
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Counter,,0,0,0,,{i:02d}/{total:02d}\n")
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Caption,,0,0,0,,{escape_ass(text)}\n")
        t=end
    out.write_text("".join(lines), encoding="utf-8")


def make_bgm(out: Path, duration: float, sample_rate: int = 44100, bpm: float = 112.0) -> None:
    total=int(duration*sample_rate)
    buf=array('h')
    beat=60.0/bpm
    rnd=random.Random(1234)
    for i in range(total):
        t=i/sample_rate
        drone=0.13*math.sin(2*math.pi*110*t)+0.06*math.sin(2*math.pi*165*t)
        phase=t%beat
        pulse=0.0
        if phase<0.08:
            pulse=0.16*math.sin(2*math.pi*62*t)*math.exp(-phase*28)
        noise=(rnd.random()*2-1)*0.008
        v=max(-1,min(1,(drone+pulse+noise)*0.35))
        buf.append(int(v*32767))
    with wave.open(str(out),'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sample_rate); w.writeframes(buf.tobytes())


def render_scene(image: Path, voice: Path, out: Path, duration: float) -> None:
    fc=(
        "[0:v]split=2[bg][fg];"
        "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=34,eq=brightness=-0.20:saturation=0.70[bg2];"
        "[fg]scale=1000:1210:force_original_aspect_ratio=decrease[fg2];"
        "[bg2][fg2]overlay=(W-w)/2:165,drawbox=x=0:y=1450:w=1080:h=470:color=black@0.50:t=fill,format=yuv420p[v]"
    )
    run([
        "ffmpeg","-y","-hide_banner","-loglevel","error",
        "-loop","1","-i",str(image),"-i",str(voice),
        "-filter_complex",fc,"-map","[v]","-map","1:a:0",
        "-t",f"{duration:.3f}","-r","30","-c:v","libx264","-preset","veryfast","-crf","20",
        "-c:a","aac","-b:a","160k","-ar","44100","-ac","1","-pix_fmt","yuv420p",str(out)
    ])


def concat(files: list[Path], out: Path) -> None:
    lst=out.with_suffix('.txt')
    lst.write_text(''.join(f"file '{p.resolve()}'\n" for p in files),encoding='utf-8')
    run(["ffmpeg","-y","-hide_banner","-loglevel","error","-f","concat","-safe","0","-i",str(lst),"-c","copy",str(out)])


def final_mix(body: Path, ass: Path, bgm: Path, out: Path) -> None:
    escaped=str(ass.resolve()).replace("\\","/").replace(":","\\:").replace("'","\\'")
    fc=(
        f"[0:v]ass='{escaped}'[v];"
        "[0:a]loudnorm=I=-16:LRA=7:TP=-1.5[va];"
        "[1:a]volume=0.10[ba];"
        "[va][ba]amix=inputs=2:duration=first:dropout_transition=1[a]"
    )
    run([
        "ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(body),"-i",str(bgm),
        "-filter_complex",fc,"-map","[v]","-map","[a]","-c:v","libx264","-preset","medium","-crf","18",
        "-c:a","aac","-b:a","192k","-pix_fmt","yuv420p","-movflags","+faststart",str(out)
    ])


def make_contact_sheet(video: Path, out: Path, duration: float) -> None:
    interval=max(duration/6,0.5)
    run([
        "ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(video),
        "-vf",f"fps=1/{interval},scale=270:480,tile=3x2","-frames:v","1",str(out)
    ])


def main() -> None:
    ap=argparse.ArgumentParser()
    ap.add_argument("--topic", required=True)
    ap.add_argument("--outdir", default="dist/free-short")
    ap.add_argument("--facts", type=int, default=6)
    ap.add_argument("--voice", default="ja-JP-KeitaNeural")
    ap.add_argument("--rate", default="+25%")
    args=ap.parse_args()

    outdir=Path(args.outdir); work=outdir/"work"; assets_dir=work/"assets"; audio_dir=work/"audio"; scenes_dir=work/"scenes"
    for p in [outdir,work,assets_dir,audio_dir,scenes_dir]: p.mkdir(parents=True,exist_ok=True)

    page=resolve_wikipedia_page(args.topic)
    texts=build_script(page["title"],page["extract"],fact_count=args.facts)
    assets=collect_assets(page,len(texts))
    download_assets(assets,assets_dir)

    voice_files=[]; durations=[]
    for i,text in enumerate(texts,1):
        vf=audio_dir/f"voice_{i:02d}.mp3"
        asyncio.run(synthesize_one(text,vf,args.voice,args.rate))
        dur=max(1.5, ffprobe_duration(vf)+0.20)
        voice_files.append(vf); durations.append(dur)

    scene_files=[]
    for i,(asset,vf,dur) in enumerate(zip(assets,voice_files,durations),1):
        sf=scenes_dir/f"scene_{i:02d}.mp4"
        render_scene(Path(asset.local_path),vf,sf,dur)
        scene_files.append(sf)

    body=work/"body.mp4"; concat(scene_files,body)
    ass=work/"subtitles.ass"; write_ass(page["title"],texts,durations,ass)
    total=sum(durations)
    bgm=work/"bgm.wav"; make_bgm(bgm,total)
    final=outdir/"video.mp4"; final_mix(body,ass,bgm,final)
    make_contact_sheet(final,outdir/"contact.jpg",total)

    source_rows=[]
    for i,a in enumerate(assets,1):
        row=asdict(a); row["scene"]=i; row["narration"]=texts[i-1]
        source_rows.append(row)
    (outdir/"sources.json").write_text(json.dumps({
        "topic":page["title"], "wikipedia":page["source_page"], "assets":source_rows
    },ensure_ascii=False,indent=2),encoding="utf-8")
    credits=[f"Topic source: {page['source_page']}",""]
    for i,a in enumerate(assets,1):
        credits.append(f"{i}. {a.title} | {a.creator or 'unknown'} | {a.license} | {a.source_page}")
    (outdir/"CREDITS.txt").write_text("\n".join(credits),encoding="utf-8")
    metadata={"topic":page["title"],"duration":total,"scenes":len(texts),"real_assets":len(assets),"generated_images":0}
    (outdir/"metadata.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(metadata,ensure_ascii=False,indent=2))


if __name__ == "__main__":
    main()
