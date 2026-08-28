#!/usr/bin/env python3
from __future__ import annotations

import asyncio
import json
import textwrap
from dataclasses import asdict
from pathlib import Path

from render_topic import (
    commons_search,
    dedupe_assets,
    download_assets,
    synthesize_one,
    ffprobe_duration,
    write_ass,
    make_bgm,
    concat,
    final_mix,
    make_contact_sheet,
    run,
)

TITLE = "創作怪談｜午前2時17分の海水浴場"
VOICE = "ja-JP-KeitaNeural"
RATE = "-5%"

TEXTS = [
    "これは、数年前に閉鎖された海水浴場をめぐる、創作怪談です。",
    "そこでは午前2時17分になると、使われていない防災無線から『遊泳時間は終了しました』と流れるそうです。",
    "ある夏、大学生二人が録音しに行きました。放送が終わると、波打ち際に白い服の人が立っていました。",
    "その人は海へ入るのではなく、背中を向けたまま、海の中からゆっくり上がってきました。",
    "友人が『誰ですか』と声をかけた瞬間、防災無線がもう一度鳴りました。『人数が、一人足りません』。",
    "二人は車まで走って逃げました。鍵を閉めて息をついた時、助手席の足元だけが濡れた砂で汚れていました。",
    "翌朝、録音を確認すると、自分たちの声の後ろで、女の声が小さく『三人です』と答えていました。",
    "それ以来、2時17分の放送は止んだそうです。ただ今年、海開き前の点検で一度だけ『今年は四人です』と流れた、と。",
]

QUERIES = [
    "Japan beach coast night",
    "Japanese beach empty",
    "Japan seaside seawall",
    "Japan public address loudspeaker",
    "Japan disaster prevention speaker",
    "Japan coastal road night",
    "beach footprints wet sand",
    "Japan beach closed sign",
    "Japanese tunnel coast",
    "Japan ocean dusk",
]


def wrap_japanese_caption(text: str, width: int = 13) -> str:
    """Force vertical-video-safe line breaks for Japanese ASS subtitles."""
    return "\n".join(
        textwrap.wrap(
            text,
            width=width,
            break_long_words=True,
            break_on_hyphens=False,
            replace_whitespace=False,
            drop_whitespace=True,
        )
    )


def collect_story_assets(needed: int):
    assets = []
    for q in QUERIES:
        try:
            assets.extend(commons_search(q, limit=10, thumb_width=1280))
        except Exception as exc:
            print(f"WARN Commons search {q!r}: {exc}")
        assets = dedupe_assets(assets)
        if len(assets) >= needed * 3:
            break
    if len(assets) < needed:
        raise RuntimeError(f"Only {len(assets)} real image candidates found")
    return assets


def render_horror_scene(image: Path, voice: Path, out: Path, duration: float) -> None:
    # Dark documentary treatment: real photo, slow zoom, muted color, mild grain.
    frames = max(1, int(duration * 30))
    fc = (
        "[0:v]scale=1180:2100:force_original_aspect_ratio=increase,"
        "crop=1080:1920,"
        f"zoompan=z='min(zoom+0.0007,1.07)':d={frames}:s=1080x1920:fps=30,"
        "eq=brightness=-0.24:contrast=1.18:saturation=0.48,"
        "noise=alls=5:allf=t+u,"
        "drawbox=x=0:y=1320:w=1080:h=600:color=black@0.54:t=fill,"
        "format=yuv420p[v]"
    )
    run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-loop", "1", "-i", str(image), "-i", str(voice),
        "-filter_complex", fc,
        "-map", "[v]", "-map", "1:a:0",
        "-t", f"{duration:.3f}", "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "1",
        "-pix_fmt", "yuv420p", str(out),
    ])


def main() -> None:
    outdir = Path("dist/kaidan")
    work = outdir / "work"
    assets_dir = work / "assets"
    audio_dir = work / "audio"
    scenes_dir = work / "scenes"
    for p in [outdir, work, assets_dir, audio_dir, scenes_dir]:
        p.mkdir(parents=True, exist_ok=True)

    candidates = collect_story_assets(len(TEXTS))
    assets = download_assets(candidates, assets_dir, len(TEXTS))

    voice_files = []
    durations = []
    for i, text in enumerate(TEXTS, 1):
        vf = audio_dir / f"voice_{i:02d}.mp3"
        asyncio.run(synthesize_one(text, vf, VOICE, RATE))
        dur = max(2.0, ffprobe_duration(vf) + 0.35)
        voice_files.append(vf)
        durations.append(dur)

    scene_files = []
    for i, (asset, vf, dur) in enumerate(zip(assets, voice_files, durations), 1):
        sf = scenes_dir / f"scene_{i:02d}.mp4"
        render_horror_scene(Path(asset.local_path), vf, sf, dur)
        scene_files.append(sf)

    body = work / "body.mp4"
    concat(scene_files, body)
    ass = work / "subtitles.ass"
    display_texts = [wrap_japanese_caption(text) for text in TEXTS]
    write_ass(TITLE, display_texts, durations, ass)
    total = sum(durations)
    bgm = work / "bgm.wav"
    make_bgm(bgm, total, bpm=72.0)
    final = outdir / "video.mp4"
    final_mix(body, ass, bgm, final)
    make_contact_sheet(final, outdir / "contact.jpg", total)

    source_rows = []
    for i, a in enumerate(assets, 1):
        row = asdict(a)
        row["scene"] = i
        row["narration"] = TEXTS[i - 1]
        source_rows.append(row)

    (outdir / "sources.json").write_text(
        json.dumps({
            "title": TITLE,
            "fiction": True,
            "note": "Original fictional kaidan. Real photos are illustrative and do not depict alleged paranormal events.",
            "assets": source_rows,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    credits = [
        TITLE,
        "Story: original fiction generated for this project.",
        "Images: reusable real photographs from Wikimedia Commons; illustrative only.",
        "",
    ]
    for i, a in enumerate(assets, 1):
        credits.append(f"{i}. {a.title} | {a.creator or 'unknown'} | {a.license} | {a.source_page}")
    (outdir / "CREDITS.txt").write_text("\n".join(credits), encoding="utf-8")

    metadata = {
        "title": TITLE,
        "fiction": True,
        "duration": total,
        "scenes": len(TEXTS),
        "real_assets": len(assets),
        "generated_images": 0,
        "voice": VOICE,
        "rate": RATE,
        "caption_wrap": 13,
    }
    (outdir / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
